<?php
/**
 * Configuration Template for GitHub Repositories Manager & Explorer
 * Target: https://github.com/khaledtaha-tech/All_Repos
 *
 * HOW TO USE:
 * 1. Copy this file to "config.php" (do NOT commit config.php into git):
 *    cp config.example.php config.php
 *
 * 2. Generate a GitHub Personal Access Token (PAT):
 *    - Classic Token (Recommended):
 *      Go to https://github.com/settings/tokens
 *      Click "Generate new token (classic)"
 *      Select scope: "repo" (to view both public and private repositories)
 *      Click "Generate token" and copy it below.
 *    - Fine-Grained Token:
 *      Go to https://github.com/settings/tokens?type=beta
 *      Set Repository access to "All repositories"
 *      Under Permissions, set "Metadata" to Read-only and "Contents" to Read-only.
 *
 * 3. Paste your token into "github_token" below, or export it in your environment:
 *    export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
 */

return [
    /**
     * GitHub Personal Access Token
     * You can either hardcode it here (safe because config.php is in .gitignore),
     * or supply it via an environment variable named GITHUB_TOKEN.
     */
    'github_token' => getenv('GITHUB_TOKEN') ?: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE',

    /**
     * GitHub API Endpoint Base URL
     */
    'api_base_url' => 'https://api.github.com',

    /**
     * Repositories per page in API call (max is 100 on GitHub REST API)
     */
    'per_page' => 100,

    /**
     * Affiliation of repositories:
     * - 'owner': Repositories owned by the authenticated user
     * - 'owner,collaborator': Repositories owned and collaborated on
     * - 'all': All accessible repositories
     */
    'affiliation' => 'owner',

    /**
     * API request sorting criteria: 'created', 'updated', 'pushed', 'full_name'
     */
    'sort' => 'updated',

    /**
     * Sorting direction: 'desc' or 'asc'
     */
    'direction' => 'desc',

    /**
     * Local caching to reduce API calls and prevent rate limits.
     * When enabled, repository lists are cached in cache/repos_cache.json.
     * Use ?refresh=1 in the URL or click the "Refresh" button in UI to force update.
     */
    'cache_enabled' => true,

    /**
     * Cache Time-To-Live in seconds (e.g., 300 = 5 minutes)
     */
    'cache_ttl' => 300,

    /**
     * Request timeout in seconds for cURL requests
     */
    'timeout' => 30,

    /**
     * User-Agent header required by GitHub API policy
     */
    'user_agent' => 'All-Repos-Explorer/1.0 (GitHub: khaledtaha-tech/All_Repos)',
];
