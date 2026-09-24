/**
 * All Repos - GitHub Repositories Manager & Explorer
 * Target: https://github.com/khaledtaha-tech/All_Repos
 *
 * Vanilla JavaScript Frontend Application
 * Fully in English, zero external dependencies besides Tailwind CSS CDN.
 */

(function () {
    'use strict';

    // Application State
    const state = {
        repositories: [],
        filteredRepositories: [],
        user: null,
        stats: null,
        rateLimit: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        visibilityFilter: 'all', // 'all', 'public', 'private', 'sources', 'forks'
        languageFilter: 'all',
        sortBy: 'updated_desc', // 'updated_desc', 'updated_asc', 'pushed_desc', 'pushed_asc', 'name_asc', 'name_desc', 'stars_desc', 'size_desc'
        viewMode: localStorage.getItem('all_repos_view_mode') || 'list', // 'list' (default) or 'grid'
        lastUpdated: null,
        selectedRepo: null,
    };

    // AI Dev / Assistant Predefined Choices
    const AI_TOOLS_STORAGE_KEY = 'all_repos_ai_tools';
    const AI_TOOL_CHOICES = [
        { value: 'none', label: 'Unassigned / None' },
        { value: 'AntiGravity', label: 'AntiGravity' },
        { value: 'ChatGPT', label: 'ChatGPT' },
        { value: 'Cursor', label: 'Cursor' },
        { value: 'Claude', label: 'Claude' },
        { value: 'Other', label: 'Other' },
    ];

    /**
     * Clean and validate a live website URL from repo.homepage
     */
    function formatLiveUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
        if (/^https?:\/\//i.test(trimmed)) {
            return trimmed;
        }
        if (/^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+/i.test(trimmed)) {
            return 'https://' + trimmed;
        }
        return null;
    }

    /**
     * Get stored AI Tools dictionary from localStorage
     */
    function getAiToolsMap() {
        try {
            const stored = localStorage.getItem(AI_TOOLS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Retrieve AI tool assigned to a given repository (by name or ID)
     */
    function getRepoAiTool(repo) {
        if (!repo) return 'none';
        const map = getAiToolsMap();
        return map[repo.name] || (repo.id ? map[String(repo.id)] : null) || 'none';
    }

    /**
     * Update AI tool assigned to a repository and persist to localStorage
     */
    function setRepoAiTool(repoName, toolValue, repoId) {
        try {
            const map = getAiToolsMap();
            if (toolValue === 'none') {
                delete map[repoName];
                if (repoId) delete map[String(repoId)];
            } else {
                map[repoName] = toolValue;
                if (repoId) map[String(repoId)] = toolValue;
            }
            localStorage.setItem(AI_TOOLS_STORAGE_KEY, JSON.stringify(map));

            const choice = AI_TOOL_CHOICES.find(c => c.value === toolValue);
            const label = choice ? choice.label : toolValue;
            showToast(`AI Tool for "${repoName}" updated to ${label}`, 'success');

            // Sync all matching select elements across views without interrupting user
            const selects = document.querySelectorAll(`select[data-repo-name="${CSS.escape(repoName)}"]`);
            selects.forEach(sel => {
                sel.value = toolValue;
                updateAiSelectStyle(sel, toolValue);
            });
        } catch (e) {
            console.error('Failed to save AI tool to localStorage:', e);
            showToast('Failed to save AI tool selection.', 'error');
        }
    }

    /**
     * Update Tailwind styling on AI Select element dynamically based on selection
     */
    function updateAiSelectStyle(selectEl, toolValue) {
        if (!selectEl) return;
        if (toolValue === 'AntiGravity') {
            selectEl.className = 'bg-[#161b22] text-[#a371f7] border border-[#a371f7]/50 focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (toolValue === 'ChatGPT') {
            selectEl.className = 'bg-[#161b22] text-[#3fb950] border border-[#3fb950]/50 focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (toolValue === 'Cursor') {
            selectEl.className = 'bg-[#161b22] text-[#58a6ff] border border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (toolValue === 'Claude') {
            selectEl.className = 'bg-[#161b22] text-[#d29922] border border-[#d29922]/50 focus:border-[#d29922] focus:ring-1 focus:ring-[#d29922] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (toolValue === 'Other') {
            selectEl.className = 'bg-[#161b22] text-[#c9d1d9] border border-[#30363d] focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else {
            selectEl.className = 'bg-[#0d1117] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        }
    }

    /**
     * Build HTML markup for AI Tool dropdown selector
     */
    function buildAiSelectHtml(repo) {
        const current = getRepoAiTool(repo);
        const repoNameEsc = escapeHtml(repo.name);
        const repoId = repo.id || 0;

        let styleClasses = 'bg-[#0d1117] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        if (current === 'AntiGravity') styleClasses = 'bg-[#161b22] text-[#a371f7] border border-[#a371f7]/50 focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'ChatGPT') styleClasses = 'bg-[#161b22] text-[#3fb950] border border-[#3fb950]/50 focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'Cursor') styleClasses = 'bg-[#161b22] text-[#58a6ff] border border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'Claude') styleClasses = 'bg-[#161b22] text-[#d29922] border border-[#d29922]/50 focus:border-[#d29922] focus:ring-1 focus:ring-[#d29922] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'Other') styleClasses = 'bg-[#161b22] text-[#c9d1d9] border border-[#30363d] focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';

        return `
            <select data-repo-name="${repoNameEsc}" 
                    onchange="window.setRepoAiTool('${repoNameEsc}', this.value, ${repoId})" 
                    class="${styleClasses}">
                ${AI_TOOL_CHOICES.map(c => `
                    <option value="${c.value}" class="bg-[#161b22] text-[#e6edf3]" ${current === c.value ? 'selected' : ''}>
                        ${escapeHtml(c.label)}
                    </option>
                `).join('')}
            </select>
        `;
    }

    // Language color mapping for common programming languages
    const languageColors = {
        'JavaScript': '#f1e05a',
        'TypeScript': '#3178c6',
        'PHP': '#4f5d95',
        'Python': '#3572a5',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'C++': '#f34b7d',
        'C': '#555555',
        'C#': '#178600',
        'Java': '#b07219',
        'Go': '#00add8',
        'Rust': '#dea584',
        'Ruby': '#701516',
        'Shell': '#89e051',
        'Vue': '#41b883',
        'Dart': '#00b4ab',
        'Swift': '#f05138',
        'Kotlin': '#a97bff',
        'Unspecified': '#6e7681',
    };

    // DOM Elements Cache
    const elements = {
        loadingState: document.getElementById('loadingState'),
        errorBanner: document.getElementById('errorBanner'),
        errorMessage: document.getElementById('errorMessage'),
        errorHelp: document.getElementById('errorHelp'),
        retryBtn: document.getElementById('retryBtn'),
        mainContent: document.getElementById('mainContent'),
        repoGrid: document.getElementById('repoGrid'),
        repoList: document.getElementById('repoList'),
        emptyState: document.getElementById('emptyState'),
        searchInput: document.getElementById('searchInput'),
        clearSearchBtn: document.getElementById('clearSearchBtn'),
        visibilityFilterGroup: document.getElementById('visibilityFilterGroup'),
        languageSelect: document.getElementById('languageSelect'),
        sortSelect: document.getElementById('sortSelect'),
        viewModeGrid: document.getElementById('viewModeGrid'),
        viewModeList: document.getElementById('viewModeList'),
        copyAllNamesBtn: document.getElementById('copyAllNamesBtn'),
        batchMenuBtn: document.getElementById('batchMenuBtn'),
        batchMenuDropdown: document.getElementById('batchMenuDropdown'),
        refreshBtn: document.getElementById('refreshBtn'),
        refreshIcon: document.getElementById('refreshIcon'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),
        toastContainer: document.getElementById('toastContainer'),
        repoModal: document.getElementById('repoModal'),
        modalBackdrop: document.getElementById('modalBackdrop'),
        modalContent: document.getElementById('modalContent'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        // Stat Counters
        statTotalRepos: document.getElementById('statTotalRepos'),
        statShowingRepos: document.getElementById('statShowingRepos'),
        statPublicRepos: document.getElementById('statPublicRepos'),
        statPrivateRepos: document.getElementById('statPrivateRepos'),
        statTotalStars: document.getElementById('statTotalStars'),
        statTotalForks: document.getElementById('statTotalForks'),
        // Header info
        userProfileContainer: document.getElementById('userProfileContainer'),
        rateLimitChip: document.getElementById('rateLimitChip'),
        rateLimitText: document.getElementById('rateLimitText'),
        lastUpdatedText: document.getElementById('lastUpdatedText'),
    };

    /**
     * Format ISO 8601 date string to human-readable relative time (e.g., "15m ago", "2h ago", "yesterday")
     */
    function formatRelativeTime(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        if (diffMs < 0) return 'just now';
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);

        if (diffSec < 60) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay === 1) return 'yesterday';
        if (diffDay < 30) return `${diffDay}d ago`;
        if (diffMonth < 12) return `${diffMonth}mo ago`;
        return `${diffYear}y ago`;
    }

    /**
     * Format ISO 8601 date string to exact YYYY-MM-DD HH:mm:ss UTC
     */
    function formatExactDateTime(dateString) {
        if (!dateString) return 'Not available';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        const pad = (n) => String(n).padStart(2, '0');
        const YYYY = d.getUTCFullYear();
        const MM = pad(d.getUTCMonth() + 1);
        const DD = pad(d.getUTCDate());
        const HH = pad(d.getUTCHours());
        const mm = pad(d.getUTCMinutes());
        const ss = pad(d.getUTCSeconds());
        return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss} UTC`;
    }

    /**
     * Format ISO 8601 date string to full local and UTC readable string
     */
    function formatExactTime(dateString) {
        return formatExactDateTime(dateString);
    }

    /**
     * Find repository ID with the latest activity across the account
     */
    function getLatestActivityRepoId() {
        if (!state.repositories || state.repositories.length === 0) return null;
        let latestRepo = state.repositories[0];
        let maxTime = 0;
        state.repositories.forEach(repo => {
            const pushTime = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;
            const updateTime = repo.updated_at ? new Date(repo.updated_at).getTime() : 0;
            const recent = Math.max(pushTime, updateTime);
            if (recent > maxTime) {
                maxTime = recent;
                latestRepo = repo;
            }
        });
        return latestRepo ? latestRepo.id : null;
    }

    /**
     * Format repository size from kilobytes
     */
    function formatRepoSize(sizeInKB) {
        if (!sizeInKB || sizeInKB === 0) return '0 KB';
        if (sizeInKB < 1024) return `${sizeInKB} KB`;
        const sizeInMB = (sizeInKB / 1024).toFixed(1);
        if (sizeInMB < 1024) return `${sizeInMB} MB`;
        const sizeInGB = (sizeInMB / 1024).toFixed(2);
        return `${sizeInGB} GB`;
    }

    /**
     * Escape HTML strings to prevent XSS
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Safe Clipboard Copy with Fallback
     */
    async function copyToClipboard(text, description, customToast = null) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for non-secure / HTTP environments
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            showToast(customToast || `Copied ${description} to clipboard!`, 'success');
        } catch (err) {
            console.error('Failed to copy to clipboard: ', err);
            showToast(`Could not copy to clipboard. Please copy manually.`, 'error');
        }
    }

    /**
     * Display a floating toast notification
     */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-[#238636] border-[#3fb950]' : 'bg-[#da3633] border-[#f85149]';
        const iconSvg = type === 'success'
            ? `<svg class="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`
            : `<svg class="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

        toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium border transition-all duration-300 transform translate-y-2 opacity-0 ${bgColor}`;
        toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;

        elements.toastContainer.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        });

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Fetch Repositories from api.php
     */
    async function fetchRepositories(forceRefresh = false) {
        state.isLoading = true;
        state.error = null;
        updateLoadingState(true);

        const url = forceRefresh ? 'api.php?refresh=1' : 'api.php';

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `HTTP ${response.status}: Failed to load repositories.`);
            }

            state.repositories = data.repositories || [];
            state.user = data.user || null;
            state.stats = data.stats || null;
            state.rateLimit = data.rate_limit || null;
            state.lastUpdated = data.cached_at || new Date().toISOString();

            populateLanguageOptions();
            applyFiltersAndSort();
            renderHeaderAndStats();
            updateLoadingState(false);

            if (forceRefresh) {
                showToast(`Refreshed ${state.repositories.length} repositories successfully!`, 'success');
            }
        } catch (err) {
            console.error('API Error: ', err);
            state.error = err.message;
            updateLoadingState(false);
            showErrorBanner(err.message);
        }
    }

    /**
     * Update Loading UI visibility
     */
    function updateLoadingState(loading) {
        if (loading) {
            elements.loadingState.classList.remove('hidden');
            elements.mainContent.classList.add('opacity-40', 'pointer-events-none');
            elements.refreshIcon.classList.add('animate-spin');
            elements.errorBanner.classList.add('hidden');
        } else {
            elements.loadingState.classList.add('hidden');
            elements.mainContent.classList.remove('opacity-40', 'pointer-events-none');
            elements.refreshIcon.classList.remove('animate-spin');
        }
    }

    /**
     * Show Error Banner
     */
    function showErrorBanner(message) {
        elements.errorBanner.classList.remove('hidden');
        elements.errorMessage.textContent = message;

        // Custom help instructions
        if (message.includes('Personal Access Token') || message.includes('Authentication failed') || message.includes('config.php')) {
            elements.errorHelp.innerHTML = `
                <div class="mt-3 text-xs leading-relaxed text-[#f85149] bg-[#3d1a1f] p-3 rounded border border-[#8b1a1f]">
                    <p class="font-semibold text-white mb-1">How to configure your GitHub Token:</p>
                    <ol class="list-decimal list-inside space-y-1">
                        <li>Generate a token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" class="underline hover:text-white">GitHub Settings &rarr; Tokens (Classic)</a> with <code>repo</code> scope.</li>
                        <li>Open <code class="bg-[#161b22] px-1 py-0.5 rounded text-white">config.php</code> in your project root.</li>
                        <li>Replace <code class="bg-[#161b22] px-1 py-0.5 rounded text-white">'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE'</code> with your token.</li>
                        <li>Click <strong>"Retry Connection"</strong> below.</li>
                    </ol>
                </div>
            `;
        } else {
            elements.errorHelp.innerHTML = '';
        }
    }

    /**
     * Render Header Profile & Stats Counters
     */
    function renderHeaderAndStats() {
        // User Profile
        if (state.user && state.user.login) {
            elements.userProfileContainer.innerHTML = `
                <a href="${escapeHtml(state.user.html_url)}" target="_blank" rel="noopener noreferrer" 
                   class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-sm text-[#e6edf3] border border-[#30363d] transition">
                    <img src="${escapeHtml(state.user.avatar_url)}" alt="${escapeHtml(state.user.login)}" class="w-5 h-5 rounded-full border border-[#30363d]">
                    <span class="font-medium">${escapeHtml(state.user.name || state.user.login)}</span>
                    <span class="text-xs text-[#8b949e]">(@${escapeHtml(state.user.login)})</span>
                </a>
            `;
        }

        // Rate Limit Chip
        if (state.rateLimit && state.rateLimit.limit !== null) {
            const remaining = state.rateLimit.remaining;
            const limit = state.rateLimit.limit;
            const pct = Math.round((remaining / limit) * 100);
            const badgeColor = pct > 20 ? 'text-[#3fb950]' : (pct > 5 ? 'text-[#d29922]' : 'text-[#f85149]');
            
            elements.rateLimitChip.classList.remove('hidden');
            elements.rateLimitText.innerHTML = `
                <span class="font-semibold ${badgeColor}">${remaining.toLocaleString()}</span> / ${limit.toLocaleString()} API calls left
            `;
            elements.rateLimitChip.title = state.rateLimit.reset_formatted ? `Resets at: ${state.rateLimit.reset_formatted}` : '';
        }

        // Last updated timestamp
        if (state.lastUpdated) {
            elements.lastUpdatedText.textContent = `Synced: ${formatRelativeTime(state.lastUpdated)}`;
            elements.lastUpdatedText.title = formatExactTime(state.lastUpdated);
        }

        // Stats Counters
        if (state.stats) {
            elements.statTotalRepos.textContent = state.stats.total.toLocaleString();
            elements.statPublicRepos.textContent = state.stats.public.toLocaleString();
            elements.statPrivateRepos.textContent = state.stats.private.toLocaleString();
            elements.statTotalStars.textContent = state.stats.total_stars.toLocaleString();
            elements.statTotalForks.textContent = state.stats.total_forks.toLocaleString();
        }

        // Update Visible Counter
        elements.statShowingRepos.textContent = state.filteredRepositories.length.toLocaleString();
    }

    /**
     * Populate Dynamic Language Options in Filter Dropdown
     */
    function populateLanguageOptions() {
        const languagesMap = {};
        state.repositories.forEach(repo => {
            const lang = repo.language || 'Unspecified';
            languagesMap[lang] = (languagesMap[lang] || 0) + 1;
        });

        // Preserve current selection if valid
        const currentVal = elements.languageSelect.value || 'all';

        let html = '<option value="all">All Languages</option>';
        const sortedLangs = Object.keys(languagesMap).sort((a, b) => languagesMap[b] - languagesMap[a]);

        sortedLangs.forEach(lang => {
            html += `<option value="${escapeHtml(lang)}">${escapeHtml(lang)} (${languagesMap[lang]})</option>`;
        });

        elements.languageSelect.innerHTML = html;
        if (languagesMap[currentVal] || currentVal === 'all') {
            elements.languageSelect.value = currentVal;
            state.languageFilter = currentVal;
        } else {
            elements.languageSelect.value = 'all';
            state.languageFilter = 'all';
        }
    }

    /**
     * Apply Search, Filter, and Sort onto Repositories List
     */
    function applyFiltersAndSort() {
        let list = [...state.repositories];

        // 1. Search filter
        if (state.searchQuery.trim() !== '') {
            const q = state.searchQuery.toLowerCase().trim();
            list = list.filter(repo => {
                const name = (repo.name || '').toLowerCase();
                const desc = (repo.description || '').toLowerCase();
                const lang = (repo.language || '').toLowerCase();
                const topics = (repo.topics || []).join(' ').toLowerCase();
                const aiTool = (getRepoAiTool(repo) || '').toLowerCase();
                return name.includes(q) || desc.includes(q) || lang.includes(q) || topics.includes(q) || aiTool.includes(q);
            });
        }

        // 2. Visibility filter
        if (state.visibilityFilter === 'public') {
            list = list.filter(r => !r.private);
        } else if (state.visibilityFilter === 'private') {
            list = list.filter(r => r.private);
        } else if (state.visibilityFilter === 'sources') {
            list = list.filter(r => !r.fork);
        } else if (state.visibilityFilter === 'forks') {
            list = list.filter(r => r.fork);
        }

        // 3. Language filter
        if (state.languageFilter !== 'all') {
            list = list.filter(r => {
                if (state.languageFilter === 'Unspecified') {
                    return !r.language;
                }
                return r.language === state.languageFilter;
            });
        }

        // 4. Dynamic Sorting
        list.sort((a, b) => {
            switch (state.sortBy) {
                case 'updated_desc':
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                case 'updated_asc':
                    return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
                case 'pushed_desc':
                    return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
                case 'pushed_asc':
                    return new Date(a.pushed_at).getTime() - new Date(b.pushed_at).getTime();
                case 'created_desc':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'created_asc':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'name_asc':
                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                case 'name_desc':
                    return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
                case 'stars_desc':
                    return (b.stargazers_count || 0) - (a.stargazers_count || 0);
                case 'size_desc':
                    return (b.size || 0) - (a.size || 0);
                default:
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            }
        });

        state.filteredRepositories = list;
        elements.statShowingRepos.textContent = list.length.toLocaleString();

        // Render repositories
        renderRepositories();
    }

    /**
     * Render Repositories in Grid or List Mode
     */
    function renderRepositories() {
        const count = state.filteredRepositories.length;

        if (count === 0) {
            elements.repoGrid.classList.add('hidden');
            elements.repoList.classList.add('hidden');
            elements.emptyState.classList.remove('hidden');
            return;
        }

        elements.emptyState.classList.add('hidden');

        if (state.viewMode === 'grid') {
            elements.repoGrid.classList.remove('hidden');
            elements.repoList.classList.add('hidden');
            renderGridView();
        } else {
            elements.repoGrid.classList.add('hidden');
            elements.repoList.classList.remove('hidden');
            renderListView();
        }
    }

    /**
     * Render Grid Cards View
     */
    function renderGridView() {
        const latestActivityId = getLatestActivityRepoId();
        let cardsHtml = '';

        state.filteredRepositories.forEach(repo => {
            const isLatest = (repo.id === latestActivityId);
            const lang = repo.language || 'Unspecified';
            const langColor = languageColors[lang] || '#6e7681';
            const cardBorder = isLatest
                ? 'border-[#3fb950] ring-1 ring-[#3fb950]/40 shadow-[0_0_15px_rgba(63,185,80,0.15)]'
                : 'border-[#30363d] hover:border-[#58a6ff]/50';

            const visibilityBadge = repo.private
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#382352] text-[#d2a8ff] border border-[#a371f7]/40">
                     <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                     Private
                   </span>`
                : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1b2533] text-[#79c0ff] border border-[#388bfd]/30">
                     <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                     Public
                   </span>`;

            const forkBadge = repo.fork
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                     <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                     Fork
                   </span>`
                : '';

            const latestActivityBadge = isLatest
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#238636]/25 text-[#3fb950] border border-[#238636] shadow-sm animate-pulse" title="Most recently modified or pushed repository">
                     <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clip-rule="evenodd"/></svg>
                     Latest Activity
                   </span>`
                : '';

            const liveUrl = formatLiveUrl(repo.homepage);
            const liveSiteBadge = liveUrl
                ? `<a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer" 
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#238636]/20 hover:bg-[#238636]/35 text-[#3fb950] border border-[#238636]/50 transition shadow-sm"
                      title="Open live website: ${escapeHtml(liveUrl)}">
                     <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                     <span>Live App</span>
                   </a>`
                : '';

            const topicsHtml = (repo.topics && repo.topics.length > 0)
                ? `<div class="flex flex-wrap gap-1 mt-2">
                     ${repo.topics.slice(0, 4).map(t => `<span class="px-2 py-0.5 rounded-full text-xs bg-[#1f2937] text-[#58a6ff] hover:bg-[#2d3748] transition cursor-pointer" onclick="window.filterByTopic('${escapeHtml(t)}')">#${escapeHtml(t)}</span>`).join('')}
                     ${repo.topics.length > 4 ? `<span class="text-xs text-[#8b949e] self-center">+${repo.topics.length - 4}</span>` : ''}
                   </div>`
                : '';

            cardsHtml += `
            <div class="bg-[#161b22] ${cardBorder} rounded-xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md group">
                <div>
                    <!-- Card Top: Name, Badges & Obvious Copy Name Button -->
                    <div class="flex items-start justify-between gap-2.5">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer" 
                                   class="text-[#58a6ff] hover:underline font-semibold text-base truncate flex items-center gap-1.5"
                                   title="${escapeHtml(repo.full_name)}">
                                    <span>${escapeHtml(repo.name)}</span>
                                    <svg class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#8b949e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                </a>
                                <!-- Dedicated Obvious Copy Name Button directly beside title -->
                                <button onclick="window.copyRepoName('${escapeHtml(repo.name)}')" 
                                        title="Copy exact repository name: ${escapeHtml(repo.name)}" 
                                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border border-[#30363d] hover:border-[#58a6ff] transition active:scale-95 flex-shrink-0 shadow-sm"
                                        aria-label="Copy repository name">
                                    <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                                    <span>Copy Name</span>
                                </button>
                                ${visibilityBadge}
                                ${forkBadge}
                                ${latestActivityBadge}
                                ${liveSiteBadge}
                            </div>
                        </div>
                    </div>

                    <!-- Description -->
                    <p class="text-xs text-[#8b949e] mt-2.5 line-clamp-2 leading-relaxed h-8">
                        ${repo.description ? escapeHtml(repo.description) : '<span class="italic opacity-60">No description provided</span>'}
                    </p>

                    <!-- Topics -->
                    ${topicsHtml}
                </div>

                <div class="mt-4 pt-3 border-t border-[#21262d] space-y-3">
                    <!-- Modification Chronology Section (Relative + Exact YYYY-MM-DD HH:mm:ss on hover) -->
                    <div class="grid grid-cols-2 gap-2 text-[11px] text-[#8b949e] bg-[#0d1117] p-2.5 rounded-lg border border-[#21262d]">
                        <div title="Updated: ${formatExactDateTime(repo.updated_at)}" class="flex items-center gap-1.5 cursor-help">
                            <svg class="w-3.5 h-3.5 text-[#3fb950] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            <span class="truncate">Updated: <strong class="text-[#e6edf3] font-medium">${formatRelativeTime(repo.updated_at)}</strong></span>
                        </div>
                        <div title="Pushed: ${formatExactDateTime(repo.pushed_at)}" class="flex items-center gap-1.5 cursor-help">
                            <svg class="w-3.5 h-3.5 text-[#58a6ff] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
                            <span class="truncate">Pushed: <strong class="text-[#e6edf3] font-medium">${formatRelativeTime(repo.pushed_at)}</strong></span>
                        </div>
                    </div>

                    <!-- AI Dev / Tool Selector in Card -->
                    <div class="flex items-center justify-between text-xs pt-1">
                        <span class="text-[#8b949e] font-medium flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            <span>AI Dev / Tool:</span>
                        </span>
                        ${buildAiSelectHtml(repo)}
                    </div>

                    <!-- Language and Metadata Indicators -->
                    <div class="flex items-center justify-between text-xs text-[#8b949e]">
                        <div class="flex items-center gap-1.5">
                            <span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${langColor};"></span>
                            <span class="font-medium text-[#c9d1d9]">${escapeHtml(lang)}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="flex items-center gap-1" title="${repo.stargazers_count} stars">
                                <svg class="w-3.5 h-3.5 text-[#e3b341]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                <span>${repo.stargazers_count}</span>
                            </span>
                            <span class="flex items-center gap-1" title="${repo.forks_count} forks">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                                <span>${repo.forks_count}</span>
                            </span>
                            <span class="text-[11px] text-[#6e7681]" title="Size: ${formatRepoSize(repo.size)}">
                                ${formatRepoSize(repo.size)}
                            </span>
                        </div>
                    </div>

                    <!-- Card Bottom Actions: Clean Repo Link, Live App & Details -->
                    <div class="flex items-center justify-between gap-1.5 pt-1">
                        <!-- Clean Repo Link with quick-copy -->
                        <div class="flex-1 inline-flex items-center rounded-md bg-[#21262d] border border-[#30363d] overflow-hidden shadow-sm hover:border-[#58a6ff]/40 transition">
                            <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer" 
                               class="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition" 
                               title="Open repository on GitHub">
                                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>
                                <span>Repo Link</span>
                            </a>
                            <button onclick="window.copyToClip('${escapeHtml(repo.html_url)}', 'GitHub repository URL')" 
                                    class="px-2 py-1.5 text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#30363d] border-l border-[#30363d] transition active:scale-95" 
                                    title="Copy GitHub URL">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                        </div>

                        <!-- Live App button if available -->
                        ${liveUrl ? `
                            <a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer" 
                               class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#238636]/20 hover:bg-[#238636]/35 text-[#3fb950] border border-[#238636]/50 transition active:scale-95" 
                               title="Visit App: ${escapeHtml(liveUrl)}">
                                <span>Visit App</span>
                                <span class="text-[11px] leading-none">&nearr;</span>
                            </a>
                        ` : ''}

                        <!-- Inspect Details Modal Trigger -->
                        <button onclick="window.openRepoModal(${repo.id})" 
                                class="p-1.5 rounded-md text-[#8b949e] hover:text-white hover:bg-[#21262d] border border-[#30363d] transition active:scale-95" 
                                title="View repository details & quick commands">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            `;
        });

        elements.repoGrid.innerHTML = cardsHtml;
    }

    /**
     * Render Compact Table / List View
     */
    function renderListView() {
        const latestActivityId = getLatestActivityRepoId();
        let rowsHtml = '';

        state.filteredRepositories.forEach(repo => {
            const isLatest = (repo.id === latestActivityId);
            const lang = repo.language || 'Unspecified';
            const langColor = languageColors[lang] || '#6e7681';
            const visibilityBadge = repo.private
                ? `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-[#382352] text-[#d2a8ff] border border-[#a371f7]/40">Private</span>`
                : `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-[#1b2533] text-[#79c0ff] border border-[#388bfd]/30">Public</span>`;

            const liveUrl = formatLiveUrl(repo.homepage);
            const liveAppBadge = liveUrl 
                ? `<a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer" 
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#238636]/20 hover:bg-[#238636]/35 text-[#3fb950] border border-[#238636]/40 transition shadow-sm hover:scale-105 active:scale-95" 
                      title="Visit App: ${escapeHtml(liveUrl)}">
                     <span>Visit App</span>
                     <svg class="w-3 h-3 text-[#3fb950]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                   </a>`
                : `<span class="text-[#8b949e]/40 font-mono text-xs select-none pl-1">—</span>`;

            rowsHtml += `
            <tr class="border-b border-[#21262d] hover:bg-[#161b22]/70 transition-colors group ${isLatest ? 'bg-[#238636]/5' : ''}">
                <!-- Name & Visibility & Direct Copy Name -->
                <td class="py-3 px-4">
                    <div class="flex items-center gap-2 flex-wrap">
                        <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer" 
                           class="text-[#58a6ff] hover:underline font-semibold text-sm">
                            ${escapeHtml(repo.name)}
                        </a>

                        <!-- Dedicated Obvious Copy Name Button -->
                        <button onclick="window.copyRepoName('${escapeHtml(repo.name)}')" 
                                title="Copy exact repository name: ${escapeHtml(repo.name)}" 
                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border border-[#30363d] hover:border-[#58a6ff] transition active:scale-95 shadow-sm" 
                                aria-label="Copy repository name">
                            <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            <span>Copy</span>
                        </button>

                        ${visibilityBadge}
                        ${repo.fork ? `<span class="text-[11px] text-[#8b949e]">(Fork)</span>` : ''}
                        ${isLatest ? `
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#238636]/25 text-[#3fb950] border border-[#238636] animate-pulse">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clip-rule="evenodd"/></svg>
                                Latest Activity
                            </span>
                        ` : ''}
                    </div>
                    <div class="text-xs text-[#8b949e] truncate max-w-md mt-0.5">
                        ${escapeHtml(repo.description || 'No description')}
                    </div>
                </td>

                <!-- Language -->
                <td class="py-3 px-4 text-xs whitespace-nowrap">
                    <div class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${langColor};"></span>
                        <span class="text-[#c9d1d9]">${escapeHtml(lang)}</span>
                    </div>
                </td>

                <!-- Dedicated Live App Column -->
                <td class="py-3 px-4 whitespace-nowrap">
                    ${liveAppBadge}
                </td>

                <!-- AI Dev / Tool Column -->
                <td class="py-3 px-4 whitespace-nowrap">
                    ${buildAiSelectHtml(repo)}
                </td>

                <!-- Modification Chronology: Updated & Pushed (Relative + Exact on hover) -->
                <td class="py-3 px-4 text-xs whitespace-nowrap cursor-help" title="Updated: ${formatExactDateTime(repo.updated_at)}">
                    <span class="text-[#3fb950] font-medium">${formatRelativeTime(repo.updated_at)}</span>
                </td>
                <td class="py-3 px-4 text-xs whitespace-nowrap cursor-help" title="Pushed: ${formatExactDateTime(repo.pushed_at)}">
                    <span class="text-[#58a6ff] font-medium">${formatRelativeTime(repo.pushed_at)}</span>
                </td>

                <!-- Stars & Size -->
                <td class="py-3 px-4 text-xs whitespace-nowrap text-right">
                    <span class="text-[#e6edf3] font-medium">${repo.stargazers_count}</span>
                    <span class="text-[#8b949e] ml-2">${formatRepoSize(repo.size)}</span>
                </td>

                <!-- Clean Actions Column -->
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    <div class="inline-flex items-center gap-1.5 justify-end">
                        <div class="inline-flex items-center rounded-md bg-[#21262d] border border-[#30363d] overflow-hidden shadow-sm hover:border-[#58a6ff]/40 transition">
                            <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer" 
                               class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition" 
                               title="Open repository on GitHub">
                                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>
                                <span>Repo Link</span>
                            </a>
                            <button onclick="window.copyToClip('${escapeHtml(repo.html_url)}', 'GitHub repository URL')" 
                                    class="px-1.5 py-1 text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#30363d] border-l border-[#30363d] transition active:scale-95" 
                                    title="Copy GitHub URL">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                        </div>
                        <button onclick="window.openRepoModal(${repo.id})" 
                                class="p-1.5 rounded-md text-[#8b949e] hover:text-white hover:bg-[#21262d] border border-[#30363d] transition active:scale-95" 
                                title="View repository details & quick commands">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        });

        elements.repoList.innerHTML = `
        <div class="overflow-x-auto border border-[#30363d] rounded-xl bg-[#0d1117] shadow-sm">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-[#161b22] border-b border-[#30363d] text-xs font-semibold text-[#8b949e]">
                        <th class="py-3 px-4">Repository</th>
                        <th class="py-3 px-4">Language</th>
                        <th class="py-3 px-4">Live App</th>
                        <th class="py-3 px-4">AI Dev / Tool</th>
                        <th class="py-3 px-4">Updated</th>
                        <th class="py-3 px-4">Pushed</th>
                        <th class="py-3 px-4 text-right">Stars & Size</th>
                        <th class="py-3 px-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
        `;
    }

    /**
     * Batch Copy: Copy All Visible Names
     */
    function copyAllVisibleNames() {
        if (state.filteredRepositories.length === 0) {
            showToast('No repositories match current filters to copy.', 'error');
            return;
        }

        const namesList = state.filteredRepositories.map(r => r.name).join('\n');
        copyToClipboard(namesList, `${state.filteredRepositories.length} repository names`);
    }

    /**
     * Batch Copy: Copy All Visible HTTPS Clone URLs
     */
    function copyAllVisibleHttpsUrls() {
        if (state.filteredRepositories.length === 0) {
            showToast('No repositories match current filters to copy.', 'error');
            return;
        }

        const urlsList = state.filteredRepositories.map(r => r.clone_url).join('\n');
        copyToClipboard(urlsList, `${state.filteredRepositories.length} HTTPS clone URLs`);
    }

    /**
     * Batch Copy: Copy All Visible SSH Clone URLs
     */
    function copyAllVisibleSshUrls() {
        if (state.filteredRepositories.length === 0) {
            showToast('No repositories match current filters to copy.', 'error');
            return;
        }

        const urlsList = state.filteredRepositories.map(r => r.ssh_url).join('\n');
        copyToClipboard(urlsList, `${state.filteredRepositories.length} SSH clone URLs`);
    }

    /**
     * Open Repository Details Modal
     */
    function openRepoModal(repoId) {
        const repo = state.repositories.find(r => r.id === repoId);
        if (!repo) return;

        state.selectedRepo = repo;
        const lang = repo.language || 'Unspecified';
        const langColor = languageColors[lang] || '#6e7681';
        const liveUrl = formatLiveUrl(repo.homepage);

        elements.modalContent.innerHTML = `
            <div class="flex items-start justify-between gap-4 pb-4 border-b border-[#30363d]">
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-xl font-bold text-white">${escapeHtml(repo.name)}</h3>
                        <!-- Dedicated Obvious Copy Name Button in Modal -->
                        <button onclick="window.copyRepoName('${escapeHtml(repo.name)}')" 
                                title="Copy exact repository name: ${escapeHtml(repo.name)}" 
                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border border-[#30363d] hover:border-[#58a6ff] transition active:scale-95 shadow-sm" 
                                aria-label="Copy repository name">
                            <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            <span>Copy Name</span>
                        </button>
                        <span class="px-2.5 py-0.5 text-xs rounded-full font-medium ${repo.private ? 'bg-[#382352] text-[#d2a8ff] border border-[#a371f7]/40' : 'bg-[#1b2533] text-[#79c0ff] border border-[#388bfd]/30'}">
                            ${repo.private ? 'Private' : 'Public'}
                        </span>
                        ${repo.fork ? `<span class="px-2.5 py-0.5 text-xs rounded-full bg-[#21262d] text-[#8b949e] border border-[#30363d]">Fork</span>` : ''}
                    </div>
                    <p class="text-xs text-[#8b949e] mt-1 font-mono">${escapeHtml(repo.full_name)}</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap flex-shrink-0">
                    ${liveUrl ? `
                        <a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer" 
                           class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#238636]/25 hover:bg-[#238636]/40 text-[#3fb950] border border-[#238636]/50 transition shadow-sm" 
                           title="Visit App: ${escapeHtml(liveUrl)}">
                            <span>Visit App</span>
                            <span class="text-[11px] leading-none">&nearr;</span>
                        </a>
                    ` : ''}
                    <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer" 
                       class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#238636] hover:bg-[#2ea043] text-white transition">
                        <span>Open on GitHub</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    </a>
                </div>
            </div>

            <!-- Description -->
            <div class="py-4 border-b border-[#30363d]">
                <h4 class="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-1">Description</h4>
                <p class="text-sm text-[#e6edf3] leading-relaxed">
                    ${repo.description ? escapeHtml(repo.description) : '<span class="italic text-[#8b949e]">No description available for this repository.</span>'}
                </p>
            </div>

            <!-- Modification Chronology Grid -->
            <div class="py-4 border-b border-[#30363d]">
                <h4 class="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Chronology & Timestamps</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="bg-[#0d1117] p-3 rounded-lg border border-[#30363d]">
                        <span class="text-xs text-[#8b949e] block">Last Updated:</span>
                        <strong class="text-sm text-[#3fb950] block mt-0.5">${formatRelativeTime(repo.updated_at)}</strong>
                        <span class="text-[11px] text-[#6e7681] block mt-1 font-mono">${formatExactDateTime(repo.updated_at)}</span>
                    </div>
                    <div class="bg-[#0d1117] p-3 rounded-lg border border-[#30363d]">
                        <span class="text-xs text-[#8b949e] block">Last Push:</span>
                        <strong class="text-sm text-[#58a6ff] block mt-0.5">${formatRelativeTime(repo.pushed_at)}</strong>
                        <span class="text-[11px] text-[#6e7681] block mt-1 font-mono">${formatExactDateTime(repo.pushed_at)}</span>
                    </div>
                    <div class="bg-[#0d1117] p-3 rounded-lg border border-[#30363d]">
                        <span class="text-xs text-[#8b949e] block">Created On:</span>
                        <strong class="text-sm text-[#d2a8ff] block mt-0.5">${formatRelativeTime(repo.created_at)}</strong>
                        <span class="text-[11px] text-[#6e7681] block mt-1 font-mono">${formatExactDateTime(repo.created_at)}</span>
                    </div>
                </div>
            </div>

            <!-- Git Clone Commands -->
            <div class="py-4 border-b border-[#30363d] space-y-3">
                <h4 class="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">Git Clone Commands</h4>
                
                <div>
                    <label class="text-xs text-[#8b949e] mb-1 flex items-center justify-between">
                        <span>HTTPS Clone</span>
                        <button onclick="window.copyToClip('git clone ${escapeHtml(repo.clone_url)}', 'HTTPS clone command')" class="text-[#58a6ff] hover:underline text-xs">Copy Command</button>
                    </label>
                    <div class="flex items-center gap-2 bg-[#0d1117] px-3 py-2 rounded-lg border border-[#30363d]">
                        <code class="text-xs font-mono text-[#79c0ff] flex-1 truncate">git clone ${escapeHtml(repo.clone_url)}</code>
                        <button onclick="window.copyToClip('${escapeHtml(repo.clone_url)}', 'HTTPS URL')" class="text-xs text-[#8b949e] hover:text-white" title="Copy URL Only">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                        </button>
                    </div>
                </div>

                <div>
                    <label class="text-xs text-[#8b949e] mb-1 flex items-center justify-between">
                        <span>SSH Clone</span>
                        <button onclick="window.copyToClip('git clone ${escapeHtml(repo.ssh_url)}', 'SSH clone command')" class="text-[#a371f7] hover:underline text-xs">Copy Command</button>
                    </label>
                    <div class="flex items-center gap-2 bg-[#0d1117] px-3 py-2 rounded-lg border border-[#30363d]">
                        <code class="text-xs font-mono text-[#d2a8ff] flex-1 truncate">git clone ${escapeHtml(repo.ssh_url)}</code>
                        <button onclick="window.copyToClip('${escapeHtml(repo.ssh_url)}', 'SSH URL')" class="text-xs text-[#8b949e] hover:text-white" title="Copy URL Only">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Repository Meta Details -->
            <div class="pt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-[#8b949e]">
                <div>
                    <span class="block">Language</span>
                    <strong class="text-white flex items-center gap-1.5 mt-0.5">
                        <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${langColor};"></span>
                        ${escapeHtml(lang)}
                    </strong>
                </div>
                <div>
                    <span class="block">AI Dev / Tool</span>
                    <div class="mt-1">${buildAiSelectHtml(repo)}</div>
                </div>
                <div>
                    <span class="block">Default Branch</span>
                    <strong class="text-white mt-0.5 block font-mono">${escapeHtml(repo.default_branch)}</strong>
                </div>
                <div>
                    <span class="block">License</span>
                    <strong class="text-white mt-0.5 block">${repo.license ? escapeHtml(repo.license.spdx_id || repo.license.name) : 'None'}</strong>
                </div>
                <div>
                    <span class="block">Disk Size</span>
                    <strong class="text-white mt-0.5 block">${formatRepoSize(repo.size)}</strong>
                </div>
            </div>
        `;

        elements.repoModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    /**
     * Close Repository Details Modal
     */
    function closeRepoModal() {
        elements.repoModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        state.selectedRepo = null;
    }

    /**
     * Batch Copy: Copy All Visible GitHub URLs
     */
    function copyAllVisibleRepoUrls() {
        if (state.filteredRepositories.length === 0) {
            showToast('No repositories match current filters to copy.', 'error');
            return;
        }

        const urlsList = state.filteredRepositories.map(r => r.html_url).join('\n');
        copyToClipboard(urlsList, `${state.filteredRepositories.length} GitHub repository URLs`);
    }

    /**
     * Event Listeners Registration
     */
    function setupEventListeners() {
        // Search bar
        elements.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            elements.clearSearchBtn.classList.toggle('hidden', state.searchQuery === '');
            applyFiltersAndSort();
        });

        // Clear search
        elements.clearSearchBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            state.searchQuery = '';
            elements.clearSearchBtn.classList.add('hidden');
            elements.searchInput.focus();
            applyFiltersAndSort();
        });

        // Reset filters button in empty state
        elements.resetFiltersBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            state.searchQuery = '';
            state.visibilityFilter = 'all';
            state.languageFilter = 'all';
            elements.clearSearchBtn.classList.add('hidden');
            elements.languageSelect.value = 'all';
            updateVisibilityFilterUI();
            applyFiltersAndSort();
        });

        // Visibility Filter Buttons
        elements.visibilityFilterGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-filter]');
            if (!btn) return;
            state.visibilityFilter = btn.dataset.filter;
            updateVisibilityFilterUI();
            applyFiltersAndSort();
        });

        // Language Select Filter
        elements.languageSelect.addEventListener('change', (e) => {
            state.languageFilter = e.target.value;
            applyFiltersAndSort();
        });

        // Sort Select
        elements.sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            applyFiltersAndSort();
        });

        // Sync initial view mode button states
        if (state.viewMode === 'list') {
            elements.viewModeList.classList.add('bg-[#30363d]', 'text-white');
            elements.viewModeList.classList.remove('text-[#8b949e]');
            elements.viewModeGrid.classList.remove('bg-[#30363d]', 'text-white');
            elements.viewModeGrid.classList.add('text-[#8b949e]');
        } else {
            elements.viewModeGrid.classList.add('bg-[#30363d]', 'text-white');
            elements.viewModeGrid.classList.remove('text-[#8b949e]');
            elements.viewModeList.classList.remove('bg-[#30363d]', 'text-white');
            elements.viewModeList.classList.add('text-[#8b949e]');
        }

        // View Mode Switchers
        elements.viewModeGrid.addEventListener('click', () => {
            state.viewMode = 'grid';
            localStorage.setItem('all_repos_view_mode', 'grid');
            elements.viewModeGrid.classList.add('bg-[#30363d]', 'text-white');
            elements.viewModeGrid.classList.remove('text-[#8b949e]');
            elements.viewModeList.classList.remove('bg-[#30363d]', 'text-white');
            elements.viewModeList.classList.add('text-[#8b949e]');
            renderRepositories();
        });

        elements.viewModeList.addEventListener('click', () => {
            state.viewMode = 'list';
            localStorage.setItem('all_repos_view_mode', 'list');
            elements.viewModeList.classList.add('bg-[#30363d]', 'text-white');
            elements.viewModeList.classList.remove('text-[#8b949e]');
            elements.viewModeGrid.classList.remove('bg-[#30363d]', 'text-white');
            elements.viewModeGrid.classList.add('text-[#8b949e]');
            renderRepositories();
        });

        // Clipboard: Copy All Visible Names
        elements.copyAllNamesBtn.addEventListener('click', () => {
            copyAllVisibleNames();
        });

        // Batch Menu toggle
        if (elements.batchMenuBtn && elements.batchMenuDropdown) {
            elements.batchMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.batchMenuDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', () => {
                elements.batchMenuDropdown.classList.add('hidden');
            });
        }

        // Refresh Button
        elements.refreshBtn.addEventListener('click', () => {
            fetchRepositories(true);
        });

        // Retry Button on error
        elements.retryBtn.addEventListener('click', () => {
            fetchRepositories(true);
        });

        // Modal close
        elements.closeModalBtn.addEventListener('click', closeRepoModal);
        elements.modalBackdrop.addEventListener('click', closeRepoModal);

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Esc to close modal
            if (e.key === 'Escape' && !elements.repoModal.classList.contains('hidden')) {
                closeRepoModal();
            }
            // Press '/' to focus search bar (if not typing in input)
            if (e.key === '/' && document.activeElement !== elements.searchInput) {
                e.preventDefault();
                elements.searchInput.focus();
                elements.searchInput.select();
            }
        });
    }

    /**
     * Update active styles on visibility filter group
     */
    function updateVisibilityFilterUI() {
        const buttons = elements.visibilityFilterGroup.querySelectorAll('button[data-filter]');
        buttons.forEach(btn => {
            if (btn.dataset.filter === state.visibilityFilter) {
                btn.className = 'px-3 py-1.5 rounded-md text-xs font-semibold bg-[#238636] text-white border border-[#2ea043] shadow-sm transition';
            } else {
                btn.className = 'px-3 py-1.5 rounded-md text-xs font-medium bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] hover:text-white border border-[#30363d] transition';
            }
        });
    }

    // Expose global helpers for inline button handlers
    window.copyRepoName = function (name) {
        copyToClipboard(name, `"${name}"`, `Copied: ${name}`);
    };

    window.copyHttpsClone = function (url, name) {
        copyToClipboard(url, `HTTPS clone URL for "${name}"`);
    };

    window.copySshClone = function (url, name) {
        copyToClipboard(url, `SSH clone URL for "${name}"`);
    };

    window.copyToClip = function (text, desc) {
        copyToClipboard(text, desc);
    };

    window.setRepoAiTool = function (name, val, id) {
        setRepoAiTool(name, val, id);
    };

    window.copyAllVisibleRepoLinks = function () {
        copyAllVisibleRepoUrls();
    };

    window.openRepoModal = function (repoId) {
        openRepoModal(repoId);
    };

    window.filterByTopic = function (topic) {
        elements.searchInput.value = topic;
        state.searchQuery = topic;
        elements.clearSearchBtn.classList.remove('hidden');
        applyFiltersAndSort();
    };

    window.copyAllVisibleHttps = function () {
        copyAllVisibleHttpsUrls();
    };

    window.copyAllVisibleSsh = function () {
        copyAllVisibleSshUrls();
    };

    // Initialize application
    function init() {
        setupEventListeners();
        fetchRepositories(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
