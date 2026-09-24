# All Repos &mdash; GitHub Repositories Manager & Explorer

A web-based GitHub Repositories Manager and Explorer built with **PHP**, **HTML5**, **Vanilla JavaScript**, and **Tailwind CSS**.

Designed for developers with extensive repository portfolios who need complete account visibility, precise modification chronology, fast search & filtering, and single-click clipboard operations for repository names and clone URLs.

Target Repository: [https://github.com/khaledtaha-tech/All_Repos](https://github.com/khaledtaha-tech/All_Repos)

---

## Key Features

### 1. Full Account Visibility
- **Complete Pagination**: Seamlessly traverses the GitHub REST API (`GET /user/repos?per_page=100&affiliation=owner&sort=updated`) without truncating accounts with hundreds of repositories.
- **Public & Private Repositories**: View all repositories owned by the authenticated account with clear visibility badges.
- **Detailed Metadata**: Displays stars, forks, primary programming language, topics/tags, license, and repository size.

### 2. Modification Chronology
- **Dual Timestamps**: Displays both `updated_at` (metadata/settings updates) and `pushed_at` (latest code commit pushed).
- **Human-Friendly Relative Times**: Intuitive relative time formatting (e.g., "3 hours ago", "yesterday", "2 weeks ago") with hover tooltips displaying the exact ISO 8601 UTC timestamp.
- **Dynamic Chronological Sorting**:
  - Recently Updated (Newest first)
  - Least Recently Updated (Oldest first)
  - Recently Pushed (Newest commit first)
  - Least Recently Pushed (Oldest commit first)
  - Recently Created / Oldest Created
  - Repository Name (A &rarr; Z and Z &rarr; A)
  - Most Stars & Largest Disk Size

### 3. Clipboard Utilities
- **Single-Click Repo Name**: Click the copy icon next to any repository title to copy its name to the clipboard.
- **Single-Click Clone URLs**: Dedicated buttons on every repository card to instantly copy **HTTPS** (`https://github.com/...git`) or **SSH** (`git@github.com:...git`) clone URLs.
- **"Copy All Visible Names"**: Instantly copies a newline-separated list of all repository names currently visible under the active search query and filter criteria.
- **Batch Clone Exporters**: Export all visible HTTPS or SSH clone URLs in a single action.
- **Toast Notifications**: Non-intrusive floating feedback confirms every successful copy operation.

### 4. Live Search & Visibility Filtering
- **Real-Time Instant Search**: Filter by repository name, description, primary language, or topic tags with instant feedback.
- **Visibility Toggle**: Filter between **All**, **Public**, **Private**, **Sources Only**, and **Forks**.
- **Dynamic Language Filter**: Automatically discovers and aggregates all languages present across your repositories, showing counts for each.
- **View Modes**: Switch between responsive Grid Cards and a compact Table List view.

### 5. API Resilience & Rate Limit Monitoring
- **Live Rate Limit Monitor**: Tracks GitHub API quota usage (`remaining / limit`) with countdown reset timers.
- **Built-In Local Caching**: Optional JSON-based caching to conserve API rate limits while allowing one-click manual refresh.
- **Secure Secret Architecture**: Access tokens are kept strictly in `config.php` (which is excluded from Git via `.gitignore`) or loaded from environment variables (`GITHUB_TOKEN`).

---

## Project Structure

```
All_Repos/
├── .gitignore             # Excludes config.php, .env, cache, and system files
├── LICENSE                # MIT License
├── README.md              # Comprehensive setup and usage documentation
├── api.php                # Backend cURL logic with pagination & rate limit headers
├── config.example.php     # Template configuration file with setup instructions
├── config.php             # Local configuration with token (Git-ignored)
├── index.php              # Modern GitHub dark theme dashboard UI
└── assets/
    └── js/
        └── app.js         # Vanilla JavaScript client state and clipboard manager
```

---

## Getting Started

### Prerequisites
- **PHP 7.4+** or **PHP 8.x** with the `curl` and `json` extensions enabled.
- A **GitHub Personal Access Token (PAT)**.

### Step 1: Clone the Repository
```bash
git clone https://github.com/khaledtaha-tech/All_Repos.git
cd All_Repos
```

### Step 2: Configure Your GitHub Personal Access Token
1. Generate a token at [GitHub Settings &rarr; Tokens (classic)](https://github.com/settings/tokens):
   - Select scope: **`repo`** (Full control of private repositories).
   - Alternatively, for public-only repositories, select **`public_repo`**.
2. Create your local `config.php` by copying the template:
   ```bash
   cp config.example.php config.php
   ```
3. Open `config.php` in your text editor and insert your token:
   ```php
   return [
       'github_token' => 'ghp_yourActualGitHubTokenGoesHere',
       // ... other optional settings
   ];
   ```
   *Note: You can alternatively set the `GITHUB_TOKEN` environment variable:*
   ```bash
   export GITHUB_TOKEN="ghp_yourActualGitHubTokenGoesHere"
   ```

### Step 3: Start the PHP Built-In Server
Run the built-in development server from the project directory:
```bash
php -S localhost:8000
```

### Step 4: Open in Your Browser
Navigate to:
```
http://localhost:8000
```

---

## Keyboard Shortcuts
- <kbd>/</kbd> &mdash; Focus search bar.
- <kbd>Esc</kbd> &mdash; Close repository details modal.

---

## Security Best Practices
- Never commit `config.php` to version control. The repository includes `.gitignore` pre-configured to ignore `config.php`, `.env`, and all cache folders.
- GitHub Personal Access Tokens should follow the principle of least privilege. Use fine-grained tokens with read-only repository permissions (`Metadata: Read`, `Contents: Read`) whenever possible.

---

## License
This project is licensed under the [MIT License](LICENSE).
