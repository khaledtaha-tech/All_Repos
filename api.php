<?php
/**
 * GitHub Repositories Manager & Explorer - Backend API
 * Target: https://github.com/khaledtaha-tech/All_Repos
 *
 * Handles:
 * - GitHub REST API authentication and communication
 * - Complete pagination (fetching all pages without truncation)
 * - Rate limit inspection and reporting
 * - Secure token handling from config.php or environment
 * - Local file caching for performance and rate-limit conservation
 */

// Set JSON output headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Disable error display in JSON stream; errors are returned as JSON
error_reporting(E_ALL);
ini_set('display_errors', '0');

// Load configuration
$configFile = __DIR__ . '/config.php';
$exampleConfigFile = __DIR__ . '/config.example.php';

if (file_exists($configFile)) {
    $config = require $configFile;
} elseif (file_exists($exampleConfigFile)) {
    $config = require $exampleConfigFile;
} else {
    echo json_encode([
        'success' => false,
        'error' => 'Configuration file missing. Please create config.php based on config.example.php.',
        'code' => 'CONFIG_MISSING'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Token validation
$token = trim($config['github_token'] ?? '');
if (empty($token) || $token === 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE') {
    $envToken = getenv('GITHUB_TOKEN');
    if (!empty($envToken)) {
        $token = trim($envToken);
    }
}

$action = $_GET['action'] ?? 'repos';
$forceRefresh = isset($_GET['refresh']) && ($_GET['refresh'] === '1' || $_GET['refresh'] === 'true');

// If action is checking status/health
if ($action === 'status') {
    $isConfigured = !empty($token) && $token !== 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE';
    echo json_encode([
        'success' => true,
        'configured' => $isConfigured,
        'cache_enabled' => !empty($config['cache_enabled']),
        'cache_ttl' => $config['cache_ttl'] ?? 300,
        'target_repo' => 'https://github.com/khaledtaha-tech/All_Repos'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// If token is still unconfigured
if (empty($token) || $token === 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE') {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'GitHub Personal Access Token is not configured. Please add your token to config.php or set the GITHUB_TOKEN environment variable.',
        'code' => 'TOKEN_REQUIRED',
        'help' => 'Generate a token at https://github.com/settings/tokens with "repo" scope, then paste it in config.php.'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Cache setup
$cacheDir = __DIR__ . '/cache';
$cacheFile = $cacheDir . '/repos_cache.json';
$cacheEnabled = !empty($config['cache_enabled']);
$cacheTtl = (int)($config['cache_ttl'] ?? 300);

if ($cacheEnabled && !$forceRefresh && file_exists($cacheFile)) {
    $cacheMtime = filemtime($cacheFile);
    if ((time() - $cacheMtime) < $cacheTtl) {
        $cachedData = file_get_contents($cacheFile);
        $decodedCache = json_decode($cachedData, true);
        if (is_array($decodedCache) && isset($decodedCache['repositories'])) {
            $decodedCache['cached'] = true;
            $decodedCache['cached_age_seconds'] = time() - $cacheMtime;
            $decodedCache['cached_at'] = date('c', $cacheMtime);
            echo json_encode($decodedCache, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            exit;
        }
    }
}

/**
 * Execute a GitHub API cURL request
 *
 * @param string $endpoint Full API URL or relative path
 * @param string $token GitHub PAT
 * @param array $config Configuration settings
 * @return array [ 'status' => int, 'body' => string, 'headers' => array, 'error' => string ]
 */
function makeGitHubRequest(string $endpoint, string $token, array $config): array {
    $url = (strpos($endpoint, 'http') === 0) ? $endpoint : rtrim($config['api_base_url'] ?? 'https://api.github.com', '/') . '/' . ltrim($endpoint, '/');

    $ch = curl_init();
    $responseHeaders = [];

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, (int)($config['timeout'] ?? 30));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, $config['user_agent'] ?? 'All-Repos-Explorer/1.0');
    
    // HTTP Headers for GitHub REST API v3 / 2022-11-28
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Accept: application/vnd.github+json',
        'X-GitHub-Api-Version: 2022-11-28',
    ]);

    // Parse header fields into an associative array
    curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($curl, $headerLine) use (&$responseHeaders) {
        $len = strlen($headerLine);
        $parts = explode(':', $headerLine, 2);
        if (count($parts) === 2) {
            $key = strtolower(trim($parts[0]));
            $val = trim($parts[1]);
            // If duplicate header (like Link), preserve or concatenate
            if (isset($responseHeaders[$key])) {
                $responseHeaders[$key] .= ', ' . $val;
            } else {
                $responseHeaders[$key] = $val;
            }
        }
        return $len;
    });

    $body = curl_exec($ch);
    $curlError = curl_error($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'status' => $statusCode,
        'body' => $body,
        'headers' => $responseHeaders,
        'error' => $curlError,
    ];
}

/**
 * Format rate limit information from GitHub response headers
 */
function parseRateLimits(array $headers): array {
    $limit = isset($headers['x-ratelimit-limit']) ? (int)$headers['x-ratelimit-limit'] : null;
    $remaining = isset($headers['x-ratelimit-remaining']) ? (int)$headers['x-ratelimit-remaining'] : null;
    $reset = isset($headers['x-ratelimit-reset']) ? (int)$headers['x-ratelimit-reset'] : null;
    $used = isset($headers['x-ratelimit-used']) ? (int)$headers['x-ratelimit-used'] : null;

    $resetFormatted = null;
    $secondsUntilReset = null;
    if ($reset) {
        $resetFormatted = gmdate('Y-m-d H:i:s \U\T\C', $reset);
        $secondsUntilReset = max(0, $reset - time());
    }

    return [
        'limit' => $limit,
        'remaining' => $remaining,
        'reset' => $reset,
        'reset_formatted' => $resetFormatted,
        'seconds_until_reset' => $secondsUntilReset,
        'used' => $used,
    ];
}

// 1. Fetch authenticated user profile
$userRes = makeGitHubRequest('/user', $token, $config);

if ($userRes['status'] === 401) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Authentication failed: Invalid or expired GitHub token. Please verify your token in config.php.',
        'code' => 'BAD_CREDENTIALS',
        'rate_limit' => parseRateLimits($userRes['headers']),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($userRes['status'] === 403) {
    $rateLimit = parseRateLimits($userRes['headers']);
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'GitHub API Access Forbidden: Rate limit exceeded or insufficient token permissions.',
        'code' => 'RATE_LIMITED_OR_FORBIDDEN',
        'rate_limit' => $rateLimit,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($userRes['status'] !== 200 || !empty($userRes['error'])) {
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to connect to GitHub API: ' . ($userRes['error'] ?: 'HTTP ' . $userRes['status']),
        'code' => 'NETWORK_ERROR',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

$userData = json_decode($userRes['body'], true);
$userProfile = [
    'login' => $userData['login'] ?? 'Unknown',
    'name' => $userData['name'] ?? $userData['login'] ?? 'GitHub User',
    'avatar_url' => $userData['avatar_url'] ?? '',
    'html_url' => $userData['html_url'] ?? '',
    'bio' => $userData['bio'] ?? '',
    'public_repos' => $userData['public_repos'] ?? 0,
    'total_private_repos' => $userData['total_private_repos'] ?? 0,
    'owned_private_repos' => $userData['owned_private_repos'] ?? 0,
];

// 2. Fetch all repositories with complete pagination (no truncation)
$perPage = min(100, max(1, (int)($config['per_page'] ?? 100)));
$affiliation = $config['affiliation'] ?? 'owner';
$apiSort = $config['sort'] ?? 'updated';
$apiDirection = $config['direction'] ?? 'desc';

$allRepositories = [];
$page = 1;
$maxPages = 50; // Safety cap allowing up to 5,000 repositories
$lastRateLimitHeaders = [];

while ($page <= $maxPages) {
    $endpoint = sprintf(
        '/user/repos?per_page=%d&affiliation=%s&sort=%s&direction=%s&page=%d',
        $perPage,
        urlencode($affiliation),
        urlencode($apiSort),
        urlencode($apiDirection),
        $page
    );

    $repoRes = makeGitHubRequest($endpoint, $token, $config);
    $lastRateLimitHeaders = $repoRes['headers'];

    if ($repoRes['status'] !== 200) {
        $errorDetails = json_decode($repoRes['body'], true);
        $errorMessage = $errorDetails['message'] ?? ($repoRes['error'] ?: 'HTTP ' . $repoRes['status']);
        
        http_response_code($repoRes['status']);
        echo json_encode([
            'success' => false,
            'error' => 'Error fetching repositories on page ' . $page . ': ' . $errorMessage,
            'code' => 'PAGE_FETCH_ERROR',
            'rate_limit' => parseRateLimits($lastRateLimitHeaders),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $pageRepos = json_decode($repoRes['body'], true);
    if (!is_array($pageRepos) || empty($pageRepos)) {
        // No more repositories
        break;
    }

    foreach ($pageRepos as $repo) {
        // Build clean and consistent repository entity
        $allRepositories[] = [
            'id' => $repo['id'],
            'name' => $repo['name'],
            'full_name' => $repo['full_name'],
            'description' => $repo['description'] ?? '',
            'private' => (bool)($repo['private'] ?? false),
            'visibility' => $repo['visibility'] ?? ($repo['private'] ? 'private' : 'public'),
            'fork' => (bool)($repo['fork'] ?? false),
            'html_url' => $repo['html_url'],
            'clone_url' => $repo['clone_url'], // HTTPS clone URL
            'ssh_url' => $repo['ssh_url'],     // SSH clone URL
            'default_branch' => $repo['default_branch'] ?? 'main',
            'language' => $repo['language'] ?? null,
            'languages_url' => $repo['languages_url'] ?? '',
            'stargazers_count' => (int)($repo['stargazers_count'] ?? 0),
            'watchers_count' => (int)($repo['watchers_count'] ?? 0),
            'forks_count' => (int)($repo['forks_count'] ?? 0),
            'open_issues_count' => (int)($repo['open_issues_count'] ?? 0),
            'size' => (int)($repo['size'] ?? 0), // in KB
            'archived' => (bool)($repo['archived'] ?? false),
            'disabled' => (bool)($repo['disabled'] ?? false),
            'is_template' => (bool)($repo['is_template'] ?? false),
            'topics' => $repo['topics'] ?? [],
            'license' => isset($repo['license']) && is_array($repo['license']) ? [
                'key' => $repo['license']['key'] ?? '',
                'name' => $repo['license']['name'] ?? '',
                'spdx_id' => $repo['license']['spdx_id'] ?? '',
            ] : null,
            // Modification chronology timestamps (ISO 8601 strings)
            'created_at' => $repo['created_at'] ?? '',
            'updated_at' => $repo['updated_at'] ?? '',
            'pushed_at' => $repo['pushed_at'] ?? '',
        ];
    }

    // Inspect Link header for next page
    $linkHeader = $repoRes['headers']['link'] ?? '';
    $hasNextPage = (strpos($linkHeader, 'rel="next"') !== false);

    // If fewer items than perPage were returned or no next link, we have reached the end
    if (!$hasNextPage || count($pageRepos) < $perPage) {
        break;
    }

    $page++;
}

// 3. Compute summary statistics
$totalRepos = count($allRepositories);
$publicCount = 0;
$privateCount = 0;
$forkCount = 0;
$archivedCount = 0;
$totalStars = 0;
$totalForks = 0;
$languagesBreakdown = [];

foreach ($allRepositories as $r) {
    if ($r['private']) {
        $privateCount++;
    } else {
        $publicCount++;
    }
    if ($r['fork']) {
        $forkCount++;
    }
    if ($r['archived']) {
        $archivedCount++;
    }
    $totalStars += $r['stargazers_count'];
    $totalForks += $r['forks_count'];

    $lang = $r['language'] ?: 'Unspecified';
    $languagesBreakdown[$lang] = ($languagesBreakdown[$lang] ?? 0) + 1;
}

arsort($languagesBreakdown);

$rateLimitInfo = parseRateLimits($lastRateLimitHeaders);

$responsePayload = [
    'success' => true,
    'user' => $userProfile,
    'stats' => [
        'total' => $totalRepos,
        'public' => $publicCount,
        'private' => $privateCount,
        'forks' => $forkCount,
        'archived' => $archivedCount,
        'sources' => ($totalRepos - $forkCount),
        'total_stars' => $totalStars,
        'total_forks' => $totalForks,
        'languages' => $languagesBreakdown,
    ],
    'rate_limit' => $rateLimitInfo,
    'pagination' => [
        'pages_fetched' => $page,
        'per_page' => $perPage,
        'total_repositories' => $totalRepos,
    ],
    'cached' => false,
    'cached_at' => date('c'),
    'cached_age_seconds' => 0,
    'repositories' => $allRepositories,
];

// Save to local cache file if caching is enabled
if ($cacheEnabled) {
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }
    if (is_dir($cacheDir) && is_writable($cacheDir)) {
        @file_put_contents($cacheFile, json_encode($responsePayload, JSON_UNESCAPED_SLASHES));
    }
}

echo json_encode($responsePayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
