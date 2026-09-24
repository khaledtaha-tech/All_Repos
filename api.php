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

/**
 * Automated Feature & Architecture Detection via GitHub API
 *
 * Inspects:
 * 1. Database: .sql files, migrations folder, schema.prisma, sqlite, or DB packages
 * 2. Login / Auth: login.*, auth.*, signin.*, or auth dependencies
 * 3. Tech Stack: runtime & frameworks (React, Next.js, Express, Native PHP, Vite, etc.)
 *
 * Caches results to cache/inspections/{repo}.json to conserve API rate limits.
 */
function inspectRepository(string $owner, string $repoName, string $branch, string $pushedAt, string $token, array $config, bool $forceRefresh = false): array {
    $inspectionsDir = __DIR__ . '/cache/inspections';
    if (!is_dir($inspectionsDir)) {
        @mkdir($inspectionsDir, 0755, true);
    }

    $cleanRepoName = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $repoName);
    $cacheFile = $inspectionsDir . '/' . $cleanRepoName . '.json';

    if (!$forceRefresh && file_exists($cacheFile)) {
        $raw = @file_get_contents($cacheFile);
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && isset($decoded['database'])) {
            if (empty($pushedAt) || empty($decoded['pushed_at']) || $decoded['pushed_at'] === $pushedAt) {
                $decoded['cached'] = true;
                return $decoded;
            }
        }
    }

    // Attempt to fetch git tree recursively
    $targetBranch = !empty($branch) ? $branch : 'main';
    $treeEndpoint = sprintf('/repos/%s/%s/git/trees/%s?recursive=1', urlencode($owner), urlencode($repoName), urlencode($targetBranch));
    $treeRes = makeGitHubRequest($treeEndpoint, $token, $config);

    // If main returned 404, fallback to master
    if ($treeRes['status'] === 404 && $targetBranch === 'main') {
        $targetBranch = 'master';
        $treeEndpoint = sprintf('/repos/%s/%s/git/trees/%s?recursive=1', urlencode($owner), urlencode($repoName), urlencode($targetBranch));
        $treeRes = makeGitHubRequest($treeEndpoint, $token, $config);
    }

    // If empty repo or not found
    if ($treeRes['status'] !== 200) {
        $emptyResult = [
            'repo' => $repoName,
            'pushed_at' => $pushedAt,
            'inspected_at' => date('c'),
            'cached' => false,
            'database' => [
                'detected' => false,
                'type' => 'No',
                'evidence' => '',
            ],
            'auth' => [
                'detected' => false,
                'evidence' => '',
            ],
            'tech_stack' => [
                'name' => 'None',
                'framework' => 'None',
                'runtime' => 'None',
                'evidence' => 'No tree or empty repository',
            ],
        ];
        return $emptyResult;
    }

    $treeData = json_decode($treeRes['body'], true);
    $treeList = is_array($treeData) && isset($treeData['tree']) && is_array($treeData['tree']) ? $treeData['tree'] : [];

    $filePaths = [];
    $hasPackageJson = false;
    $hasComposerJson = false;

    foreach ($treeList as $item) {
        $p = $item['path'] ?? '';
        if ($p) {
            $filePaths[] = $p;
            if ($p === 'package.json') $hasPackageJson = true;
            if ($p === 'composer.json') $hasComposerJson = true;
        }
    }

    $packageDeps = [];
    if ($hasPackageJson) {
        $pkgRes = makeGitHubRequest(sprintf('/repos/%s/%s/contents/package.json', urlencode($owner), urlencode($repoName)), $token, $config);
        if ($pkgRes['status'] === 200) {
            $pkgData = json_decode($pkgRes['body'], true);
            if (!empty($pkgData['content'])) {
                $pkgJson = json_decode(base64_decode($pkgData['content']), true);
                if (is_array($pkgJson)) {
                    $packageDeps = array_merge(
                        array_keys($pkgJson['dependencies'] ?? []),
                        array_keys($pkgJson['devDependencies'] ?? [])
                    );
                }
            }
        }
    }

    $composerDeps = [];
    if ($hasComposerJson) {
        $compRes = makeGitHubRequest(sprintf('/repos/%s/%s/contents/composer.json', urlencode($owner), urlencode($repoName)), $token, $config);
        if ($compRes['status'] === 200) {
            $compData = json_decode($compRes['body'], true);
            if (!empty($compData['content'])) {
                $compJson = json_decode(base64_decode($compData['content']), true);
                if (is_array($compJson)) {
                    $composerDeps = array_merge(
                        array_keys($compJson['require'] ?? []),
                        array_keys($compJson['require-dev'] ?? [])
                    );
                }
            }
        }
    }

    $allDeps = array_map('strtolower', array_merge($packageDeps, $composerDeps));

    // 1. Analyze Database
    $dbDetected = false;
    $dbType = 'No';
    $dbEvidence = '';

    if (in_array('@prisma/client', $allDeps) || in_array('prisma', $allDeps)) {
        $dbDetected = true;
        $dbType = 'Prisma';
        $dbEvidence = 'Prisma ORM dependency';
    } elseif (in_array('drizzle-orm', $allDeps)) {
        $dbDetected = true;
        $dbType = 'Drizzle';
        $dbEvidence = 'Drizzle ORM dependency';
    } elseif (in_array('better-sqlite3', $allDeps) || in_array('sqlite3', $allDeps)) {
        $dbDetected = true;
        $dbType = 'SQLite';
        $dbEvidence = 'SQLite driver dependency';
    } elseif (in_array('@supabase/supabase-js', $allDeps) || in_array('supabase', $allDeps)) {
        $dbDetected = true;
        $dbType = 'Supabase';
        $dbEvidence = 'Supabase client';
    } elseif (in_array('firebase', $allDeps) || in_array('firebase-admin', $allDeps)) {
        $dbDetected = true;
        $dbType = 'Firebase';
        $dbEvidence = 'Firebase / Firestore dependency';
    } elseif (in_array('mongoose', $allDeps) || in_array('mongodb', $allDeps)) {
        $dbDetected = true;
        $dbType = 'MongoDB';
        $dbEvidence = 'MongoDB / Mongoose dependency';
    } elseif (in_array('pg', $allDeps) || in_array('postgres', $allDeps)) {
        $dbDetected = true;
        $dbType = 'PostgreSQL';
        $dbEvidence = 'PostgreSQL pg client';
    } elseif (in_array('mysql', $allDeps) || in_array('mysql2', $allDeps)) {
        $dbDetected = true;
        $dbType = 'MySQL';
        $dbEvidence = 'MySQL driver dependency';
    } elseif (in_array('sequelize', $allDeps)) {
        $dbDetected = true;
        $dbType = 'Sequelize';
        $dbEvidence = 'Sequelize ORM';
    } elseif (in_array('illuminate/database', $allDeps)) {
        $dbDetected = true;
        $dbType = 'Eloquent';
        $dbEvidence = 'Laravel / Eloquent ORM';
    }

    if (!$dbDetected) {
        foreach ($filePaths as $path) {
            $lower = strtolower($path);
            $base = basename($lower);
            if ($base === 'schema.prisma') {
                $dbDetected = true;
                $dbType = 'Prisma';
                $dbEvidence = 'schema.prisma';
                break;
            } elseif (preg_match('/\.sqlite3?$/i', $lower) || preg_match('/\.db$/i', $lower)) {
                $dbDetected = true;
                $dbType = 'SQLite';
                $dbEvidence = basename($path);
                break;
            } elseif (strpos($base, 'drizzle.config') !== false) {
                $dbDetected = true;
                $dbType = 'Drizzle';
                $dbEvidence = basename($path);
                break;
            } elseif (strpos($lower, 'supabase/') === 0) {
                $dbDetected = true;
                $dbType = 'Supabase';
                $dbEvidence = 'supabase/ schema';
                break;
            } elseif ($base === 'firestore.rules') {
                $dbDetected = true;
                $dbType = 'Firestore';
                $dbEvidence = 'firestore.rules';
                break;
            } elseif (preg_match('/(^|\/)(migrations?|database\/migrations)\//i', $lower)) {
                $dbDetected = true;
                $dbType = 'Migrations';
                $dbEvidence = 'migrations/ folder';
                break;
            } elseif (preg_match('/\.sql$/i', $lower)) {
                $dbDetected = true;
                $dbType = 'SQL';
                $dbEvidence = basename($path);
                break;
            } elseif (strpos($lower, 'alembic') !== false) {
                $dbDetected = true;
                $dbType = 'Alembic';
                $dbEvidence = 'alembic migrations';
                break;
            }
        }
    }

    // 2. Analyze Login / Auth
    $authDetected = false;
    $authEvidence = '';

    $authDepsList = ['next-auth', '@auth/core', 'passport', 'jsonwebtoken', 'bcrypt', 'bcryptjs', '@clerk/nextjs', 'lucia', 'auth0', '@auth0/nextjs-auth0', 'supertokens-node', 'laravel/sanctum', 'laravel/breeze', 'laravel/jetstream', 'firebase/php-jwt'];
    foreach ($authDepsList as $ad) {
        if (in_array(strtolower($ad), $allDeps)) {
            $authDetected = true;
            $authEvidence = $ad . ' package';
            break;
        }
    }

    if (!$authDetected) {
        foreach ($filePaths as $path) {
            $lower = strtolower($path);
            $base = basename($lower);
            if (preg_match('/^(login|signin|signup|register|logout|auth|oauth|session)\.[a-z0-9]+$/i', $base)) {
                $authDetected = true;
                $authEvidence = basename($path);
                break;
            }
            if (preg_match('/[\/\._](auth|login|signin|session|oauth|jwt)[\/\._]/i', $lower) || preg_match('/(^|\/)(auth|login|sessions)\//i', $lower)) {
                $authDetected = true;
                $authEvidence = $path;
                break;
            }
        }
    }

    // 3. Analyze Tech Stack
    $techName = 'HTML5 / JS';
    $techFramework = 'Vanilla';
    $techRuntime = 'Web';
    $techEvidence = '';

    if (in_array('next', $allDeps)) {
        $techName = 'Next.js';
        $techFramework = 'Next.js';
        $techRuntime = 'Node.js';
        $techEvidence = 'next dependency';
    } elseif (in_array('nuxt', $allDeps)) {
        $techName = 'Nuxt';
        $techFramework = 'Nuxt';
        $techRuntime = 'Node.js';
        $techEvidence = 'nuxt dependency';
    } elseif (in_array('astro', $allDeps)) {
        $techName = 'Astro';
        $techFramework = 'Astro';
        $techRuntime = 'Node.js';
        $techEvidence = 'astro dependency';
    } elseif (in_array('@remix-run/react', $allDeps)) {
        $techName = 'Remix';
        $techFramework = 'Remix';
        $techRuntime = 'Node.js';
        $techEvidence = 'remix dependency';
    } elseif (in_array('@sveltejs/kit', $allDeps) || in_array('svelte', $allDeps)) {
        $techName = 'Svelte';
        $techFramework = 'SvelteKit';
        $techRuntime = 'Node.js';
        $techEvidence = 'svelte dependency';
    } elseif (in_array('laravel/framework', $allDeps)) {
        $techName = 'Laravel';
        $techFramework = 'Laravel';
        $techRuntime = 'PHP';
        $techEvidence = 'laravel/framework';
    } elseif (in_array('express', $allDeps)) {
        $techName = 'Express';
        $techFramework = 'Express';
        $techRuntime = 'Node.js';
        $techEvidence = 'express dependency';
    } elseif (in_array('fastify', $allDeps)) {
        $techName = 'Fastify';
        $techFramework = 'Fastify';
        $techRuntime = 'Node.js';
        $techEvidence = 'fastify dependency';
    } elseif (in_array('@nestjs/core', $allDeps)) {
        $techName = 'NestJS';
        $techFramework = 'NestJS';
        $techRuntime = 'Node.js';
        $techEvidence = '@nestjs/core';
    } elseif (in_array('react', $allDeps)) {
        $techName = in_array('vite', $allDeps) ? 'Vite / React' : 'React';
        $techFramework = 'React';
        $techRuntime = 'Browser';
        $techEvidence = 'react dependency';
    } elseif (in_array('vue', $allDeps)) {
        $techName = in_array('vite', $allDeps) ? 'Vite / Vue' : 'Vue';
        $techFramework = 'Vue';
        $techRuntime = 'Browser';
        $techEvidence = 'vue dependency';
    } elseif (in_array('vite', $allDeps)) {
        $techName = 'Vite';
        $techFramework = 'Vite';
        $techRuntime = 'Browser';
        $techEvidence = 'vite dependency';
    }

    if ($techName === 'HTML5 / JS') {
        foreach ($filePaths as $path) {
            $lower = strtolower($path);
            $base = basename($lower);
            if (strpos($base, 'next.config.') === 0) {
                $techName = 'Next.js';
                $techFramework = 'Next.js';
                $techRuntime = 'Node.js';
                $techEvidence = $base;
                break;
            } elseif (strpos($base, 'vite.config.') === 0) {
                $techName = 'Vite';
                $techFramework = 'Vite';
                $techRuntime = 'Browser';
                $techEvidence = $base;
                break;
            } elseif (strpos($base, 'nuxt.config.') === 0) {
                $techName = 'Nuxt';
                $techFramework = 'Nuxt';
                $techRuntime = 'Node.js';
                $techEvidence = $base;
                break;
            } elseif ($base === 'artisan') {
                $techName = 'Laravel';
                $techFramework = 'Laravel';
                $techRuntime = 'PHP';
                $techEvidence = 'artisan file';
                break;
            } elseif ($base === 'pubspec.yaml') {
                $techName = 'Flutter';
                $techFramework = 'Flutter';
                $techRuntime = 'Dart';
                $techEvidence = 'pubspec.yaml';
                break;
            } elseif ($base === 'cargo.toml') {
                $techName = 'Rust';
                $techFramework = 'Cargo';
                $techRuntime = 'Rust';
                $techEvidence = 'Cargo.toml';
                break;
            } elseif ($base === 'go.mod') {
                $techName = 'Go';
                $techFramework = 'Go Modules';
                $techRuntime = 'Go';
                $techEvidence = 'go.mod';
                break;
            } elseif ($base === 'manage.py') {
                $techName = 'Django';
                $techFramework = 'Django';
                $techRuntime = 'Python';
                $techEvidence = 'manage.py';
                break;
            } elseif ($base === 'requirements.txt' || $base === 'pyproject.toml') {
                $techName = 'Python';
                $techFramework = 'Python';
                $techRuntime = 'Python';
                $techEvidence = $base;
            }
        }
    }

    if ($techName === 'HTML5 / JS') {
        $hasPhp = false;
        foreach ($filePaths as $path) {
            if (preg_match('/\.php$/i', $path)) {
                $hasPhp = true;
                break;
            }
        }
        if ($hasPhp) {
            $techName = 'Native PHP';
            $techFramework = 'PHP';
            $techRuntime = 'PHP';
            $techEvidence = 'PHP scripts';
        }
    }

    $inspectionResult = [
        'repo' => $repoName,
        'pushed_at' => $pushedAt,
        'inspected_at' => date('c'),
        'cached' => false,
        'database' => [
            'detected' => $dbDetected,
            'type' => $dbType,
            'evidence' => $dbEvidence,
        ],
        'auth' => [
            'detected' => $authDetected,
            'evidence' => $authEvidence,
        ],
        'tech_stack' => [
            'name' => $techName,
            'framework' => $techFramework,
            'runtime' => $techRuntime,
            'evidence' => $techEvidence,
        ],
    ];

    @file_put_contents($cacheFile, json_encode($inspectionResult, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return $inspectionResult;
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

// If action is repository inspection
if ($action === 'inspect') {
    $repoName = trim($_GET['repo'] ?? '');
    if (empty($repoName)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing "repo" parameter for inspection.',
            'code' => 'PARAM_MISSING'
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $owner = trim($_GET['owner'] ?? '') ?: ($userProfile['login'] ?? '');
    $branch = trim($_GET['branch'] ?? 'main');
    $pushedAt = trim($_GET['pushed_at'] ?? '');

    $inspection = inspectRepository($owner, $repoName, $branch, $pushedAt, $token, $config, $forceRefresh);
    echo json_encode([
        'success' => true,
        'inspection' => $inspection,
        'rate_limit' => parseRateLimits($userRes['headers'] ?? []),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

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
        $inspectionsDir = __DIR__ . '/cache/inspections';
        $cleanRepoName = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $repo['name']);
        $inspectFile = $inspectionsDir . '/' . $cleanRepoName . '.json';
        $inspectionData = null;
        if (file_exists($inspectFile)) {
            $rawInspect = @file_get_contents($inspectFile);
            $decodedInspect = json_decode($rawInspect, true);
            if (is_array($decodedInspect) && isset($decodedInspect['database'])) {
                if (empty($repo['pushed_at']) || empty($decodedInspect['pushed_at']) || $decodedInspect['pushed_at'] === $repo['pushed_at']) {
                    $decodedInspect['cached'] = true;
                    $inspectionData = $decodedInspect;
                }
            }
        }

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
            'homepage' => !empty($repo['homepage']) ? trim($repo['homepage']) : null,
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
            'inspection' => $inspectionData,
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
