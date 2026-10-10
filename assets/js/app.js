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
        inspections: {},
        inspectingRepos: new Set(),
        metadata: {
            database: {},
            auth: {},
            ai_tool: {},
            prompt_tool: {},
            live_url: {},
            deployed_branch: {}
        },
        editingLiveUrlRepo: null,
        editingBranchRepo: null,
        hasUnsavedChanges: false,
        isSyncingMetadata: false,
    };

    // Automated Architecture Detection Persistence Key
    const INSPECTIONS_STORAGE_KEY = 'all_repos_inspections_v2';

    /**
     * Get cached repository inspections from localStorage
     */
    function getCachedInspections() {
        try {
            const raw = localStorage.getItem(INSPECTIONS_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Persist cached repository inspections to localStorage
     */
    function saveCachedInspections() {
        try {
            localStorage.setItem(INSPECTIONS_STORAGE_KEY, JSON.stringify(state.inspections));
        } catch (e) {
            console.error('Failed to save inspections cache:', e);
        }
    }

    const inspectionQueue = [];
    let activeInspectionsCount = 0;
    const MAX_CONCURRENT_INSPECTIONS = 3;

    /**
     * Queue a repository for architecture inspection
     */
    function queueRepoInspection(repo) {
        if (!repo || !repo.name) return;
        const existing = state.inspections[repo.name];
        if (existing && (!repo.pushed_at || !existing.pushed_at || existing.pushed_at === repo.pushed_at)) {
            return; // Already inspected and up to date
        }
        if (state.inspectingRepos.has(repo.name)) {
            return; // In flight
        }
        if (!inspectionQueue.some(r => r.name === repo.name)) {
            inspectionQueue.push(repo);
        }
        processInspectionQueue();
    }

    /**
     * Process background inspection queue with controlled concurrency
     */
    async function processInspectionQueue() {
        if (activeInspectionsCount >= MAX_CONCURRENT_INSPECTIONS || inspectionQueue.length === 0) {
            return;
        }

        const repo = inspectionQueue.shift();
        if (!repo) return;

        state.inspectingRepos.add(repo.name);
        activeInspectionsCount++;

        // Update UI to show scanning state
        updateRepoInspectionUI(repo.name);

        try {
            const branch = repo.default_branch || 'main';
            const pushedAt = repo.pushed_at || '';
            const url = `api.php?action=inspect&repo=${encodeURIComponent(repo.name)}&branch=${encodeURIComponent(branch)}&pushed_at=${encodeURIComponent(pushedAt)}`;

            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            const data = await res.json();

            if (data.success && data.inspection) {
                state.inspections[repo.name] = data.inspection;
                saveCachedInspections();
            }
        } catch (e) {
            console.warn(`Failed to inspect repository "${repo.name}":`, e);
        } finally {
            state.inspectingRepos.delete(repo.name);
            activeInspectionsCount--;
            updateRepoInspectionUI(repo.name);
            processInspectionQueue();
        }
    }

    /**
     * Update inspection badges in DOM dynamically for a specific repository
     */
    function updateRepoInspectionUI(repoName) {
        const repo = state.repositories.find(r => r.name === repoName);
        if (!repo) return;

        const techCells = document.querySelectorAll(`td[data-cell-tech="${CSS.escape(repoName)}"]`);
        techCells.forEach(cell => { cell.innerHTML = renderTechStackCell(repo); });

        const cardTechs = document.querySelectorAll(`div[data-card-tech="${CSS.escape(repoName)}"]`);
        cardTechs.forEach(el => { el.innerHTML = renderTechStackCell(repo); });

        // Only update database cells if no user/saved metadata exists yet
        const hasManualDb = getMetadataValue(state.metadata.database, repo) !== undefined;
        if (!hasManualDb) {
            const dbCells = document.querySelectorAll(`td[data-cell-db="${CSS.escape(repoName)}"]`);
            dbCells.forEach(cell => { cell.innerHTML = renderDatabaseCell(repo); });

            const cardDbs = document.querySelectorAll(`div[data-card-db="${CSS.escape(repoName)}"]`);
            cardDbs.forEach(el => { el.innerHTML = renderDatabaseCell(repo); });
        }

        // Only update auth cells if no user/saved metadata exists yet
        const hasManualAuth = getMetadataValue(state.metadata.auth, repo) !== undefined;
        if (!hasManualAuth) {
            const authCells = document.querySelectorAll(`td[data-cell-auth="${CSS.escape(repoName)}"]`);
            authCells.forEach(cell => { cell.innerHTML = renderAuthCell(repo); });

            const cardAuths = document.querySelectorAll(`div[data-card-auth="${CSS.escape(repoName)}"]`);
            cardAuths.forEach(el => { el.innerHTML = renderAuthCell(repo); });
        }

        // Update branch tracking cells
        const depCells = document.querySelectorAll(`td[data-cell-dep-branch="${CSS.escape(repoName)}"]`);
        depCells.forEach(cell => { cell.innerHTML = renderDeployedBranchCell(repo); });

        const actCells = document.querySelectorAll(`td[data-cell-act-branch="${CSS.escape(repoName)}"]`);
        actCells.forEach(cell => { cell.innerHTML = renderLatestActiveBranchCell(repo); });
    }

    /**
     * Render Tech Stack badge
     */
    function renderTechStackCell(repo) {
        const inspection = state.inspections[repo.name] || repo.inspection;
        const isScanning = state.inspectingRepos.has(repo.name);

        if (isScanning && !inspection) {
            return `
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-[#8b949e] bg-[#161b22] border border-[#30363d] animate-pulse">
                    <svg class="w-3 h-3 animate-spin text-[#58a6ff]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Scanning</span>
                </span>
            `;
        }

        if (inspection && inspection.tech_stack && inspection.tech_stack.name && inspection.tech_stack.name !== 'None') {
            const name = inspection.tech_stack.name;
            const evidence = inspection.tech_stack.evidence || name;
            return `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1f2937] text-[#79c0ff] border border-[#388bfd]/30 shadow-sm" title="Tech Stack: ${escapeHtml(evidence)}">
                    <svg class="w-3 h-3 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                    <span>${escapeHtml(name)}</span>
                </span>
            `;
        }

        const fallback = repo.language || '—';
        return `<span class="text-[#8b949e]/60 font-mono text-xs select-none pl-1" title="Language fallback">${escapeHtml(fallback)}</span>`;
    }

    // =========================================================================
    // Persistent Repository Metadata (Database, Auth, AI Dev, Prompt Explainer)
    // Hybrid Architecture: Memory State + LocalStorage + Server File (api.php)
    // =========================================================================

    const DB_TRACKER_STORAGE_KEY = 'all_repos_db_tracker';
    const AUTH_TRACKER_STORAGE_KEY = 'all_repos_auth_tracker';
    const AI_TOOLS_STORAGE_KEY = 'all_repos_ai_tools';
    const PROMPT_TOOLS_STORAGE_KEY = 'all_repos_prompt_tools';

    const DB_TRACKER_CHOICES = [
        { value: 'none', label: 'None' },
        { value: 'MySQL', label: 'MySQL' },
        { value: 'SQLite', label: 'SQLite' },
        { value: 'MongoDB', label: 'MongoDB' },
        { value: 'PostgreSQL', label: 'PostgreSQL' },
        { value: 'Other', label: 'Other' },
    ];

    const AI_TOOL_CHOICES = [
        { value: 'none', label: 'Unassigned / None' },
        { value: 'AntiGravity', label: 'AntiGravity' },
        { value: 'ChatGPT', label: 'ChatGPT' },
        { value: 'Cursor', label: 'Cursor' },
        { value: 'Claude', label: 'Claude' },
        { value: 'Other', label: 'Other' },
    ];

    const PROMPT_TOOL_CHOICES = [
        { value: 'none', label: 'None' },
        { value: 'Gemini', label: 'Gemini' },
        { value: 'ChatGPT', label: 'ChatGPT' },
        { value: 'Claude', label: 'Claude' },
        { value: 'Other', label: 'Other' },
    ];

    /**
     * Retrieve local dictionaries from browser localStorage
     */
    function getDbTrackerMap() {
        try {
            const stored = localStorage.getItem(DB_TRACKER_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    function getAuthTrackerMap() {
        try {
            const stored = localStorage.getItem(AUTH_TRACKER_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    function getAiToolsMap() {
        try {
            const stored = localStorage.getItem(AI_TOOLS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    function getPromptToolsMap() {
        try {
            const stored = localStorage.getItem(PROMPT_TOOLS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    const LIVE_URLS_STORAGE_KEY = 'all_repos_custom_live_urls';

    function getCustomLiveUrlsMap() {
        try {
            const stored = localStorage.getItem(LIVE_URLS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    const DEPLOYED_BRANCH_STORAGE_KEY = 'all_repos_deployed_branches';

    function getDeployedBranchesMap() {
        try {
            const stored = localStorage.getItem(DEPLOYED_BRANCH_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Save current state.metadata to browser localStorage
     */
    function saveAllMetadataToLocalStorage() {
        try {
            localStorage.setItem(DB_TRACKER_STORAGE_KEY, JSON.stringify(state.metadata.database || {}));
            localStorage.setItem(AUTH_TRACKER_STORAGE_KEY, JSON.stringify(state.metadata.auth || {}));
            localStorage.setItem(AI_TOOLS_STORAGE_KEY, JSON.stringify(state.metadata.ai_tool || {}));
            localStorage.setItem(PROMPT_TOOLS_STORAGE_KEY, JSON.stringify(state.metadata.prompt_tool || {}));
            localStorage.setItem(LIVE_URLS_STORAGE_KEY, JSON.stringify(state.metadata.live_url || {}));
            localStorage.setItem(DEPLOYED_BRANCH_STORAGE_KEY, JSON.stringify(state.metadata.deployed_branch || {}));
        } catch (e) {
            console.error('Failed to save metadata to localStorage:', e);
        }
    }

    /**
     * Load initial state.metadata from localStorage into memory
     */
    function loadLocalMetadata() {
        state.metadata.database = getDbTrackerMap();
        state.metadata.auth = getAuthTrackerMap();
        state.metadata.ai_tool = getAiToolsMap();
        state.metadata.prompt_tool = getPromptToolsMap();
        state.metadata.live_url = getCustomLiveUrlsMap();
        state.metadata.deployed_branch = getDeployedBranchesMap();
    }

    /**
     * Synchronize and hydrate metadata from server response and localStorage
     */
    function hydrateMetadata(serverMetadata) {
        if (!serverMetadata || typeof serverMetadata !== 'object') {
            serverMetadata = {};
        }

        const localDb = getDbTrackerMap();
        const localAuth = getAuthTrackerMap();
        const localAi = getAiToolsMap();
        const localPrompt = getPromptToolsMap();
        const localLiveUrl = getCustomLiveUrlsMap();
        const localBranch = getDeployedBranchesMap();

        const sDb = (serverMetadata && serverMetadata.database) || {};
        const sAuth = (serverMetadata && serverMetadata.auth) || {};
        const sAi = (serverMetadata && serverMetadata.ai_tool) || {};
        const sPrompt = (serverMetadata && serverMetadata.prompt_tool) || {};
        const sLiveUrl = (serverMetadata && (serverMetadata.live_url || serverMetadata.custom_live_url)) || {};
        const sBranch = (serverMetadata && serverMetadata.deployed_branch) || {};

        // Merge: combine local and server, preserving all explicit entries
        state.metadata.database = { ...localDb, ...sDb };
        state.metadata.auth = { ...localAuth, ...sAuth };
        state.metadata.ai_tool = { ...localAi, ...sAi };
        state.metadata.prompt_tool = { ...localPrompt, ...sPrompt };
        state.metadata.live_url = { ...localLiveUrl, ...sLiveUrl };
        state.metadata.deployed_branch = { ...localBranch, ...sBranch };

        // Also check if any repository entity from API has embedded user_metadata
        if (Array.isArray(state.repositories)) {
            state.repositories.forEach(repo => {
                if (repo && repo.user_metadata) {
                    const name = repo.name;
                    const id = repo.id ? String(repo.id) : null;
                    if (repo.user_metadata.database !== null && repo.user_metadata.database !== undefined) {
                        if (state.metadata.database[name] === undefined) state.metadata.database[name] = repo.user_metadata.database;
                        if (id && state.metadata.database[id] === undefined) state.metadata.database[id] = repo.user_metadata.database;
                    }
                    if (repo.user_metadata.auth !== null && repo.user_metadata.auth !== undefined) {
                        if (state.metadata.auth[name] === undefined) state.metadata.auth[name] = repo.user_metadata.auth;
                        if (id && state.metadata.auth[id] === undefined) state.metadata.auth[id] = repo.user_metadata.auth;
                    }
                    if (repo.user_metadata.ai_tool !== null && repo.user_metadata.ai_tool !== undefined) {
                        if (state.metadata.ai_tool[name] === undefined) state.metadata.ai_tool[name] = repo.user_metadata.ai_tool;
                        if (id && state.metadata.ai_tool[id] === undefined) state.metadata.ai_tool[id] = repo.user_metadata.ai_tool;
                    }
                    if (repo.user_metadata.prompt_tool !== null && repo.user_metadata.prompt_tool !== undefined) {
                        if (state.metadata.prompt_tool[name] === undefined) state.metadata.prompt_tool[name] = repo.user_metadata.prompt_tool;
                        if (id && state.metadata.prompt_tool[id] === undefined) state.metadata.prompt_tool[id] = repo.user_metadata.prompt_tool;
                    }
                    if (repo.user_metadata.live_url !== null && repo.user_metadata.live_url !== undefined) {
                        if (state.metadata.live_url[name] === undefined) state.metadata.live_url[name] = repo.user_metadata.live_url;
                        if (id && state.metadata.live_url[id] === undefined) state.metadata.live_url[id] = repo.user_metadata.live_url;
                    }
                    if (repo.user_metadata.deployed_branch !== null && repo.user_metadata.deployed_branch !== undefined) {
                        if (state.metadata.deployed_branch[name] === undefined) state.metadata.deployed_branch[name] = repo.user_metadata.deployed_branch;
                        if (id && state.metadata.deployed_branch[id] === undefined) state.metadata.deployed_branch[id] = repo.user_metadata.deployed_branch;
                    }
                }
            });
        }

        // Hydrate notes if local notes in localStorage are currently empty
        const sNotes = (serverMetadata && serverMetadata.notes) || null;
        if (sNotes && typeof sNotes === 'object') {
            try {
                const currentLocalCompleted = localStorage.getItem(NOTES_COMPLETED_KEY) || '';
                const currentLocalNextSteps = localStorage.getItem(NOTES_NEXT_STEPS_KEY) || '';
                if (!currentLocalCompleted && sNotes.completed) {
                    localStorage.setItem(NOTES_COMPLETED_KEY, sNotes.completed);
                    if (elements.notesCompletedText) elements.notesCompletedText.value = sNotes.completed;
                }
                if (!currentLocalNextSteps && sNotes.next_steps) {
                    localStorage.setItem(NOTES_NEXT_STEPS_KEY, sNotes.next_steps);
                    if (elements.notesNextStepsText) elements.notesNextStepsText.value = sNotes.next_steps;
                }
                updateNotesStats();
            } catch (e) {
                // Ignore localStorage errors
            }
        }

        // Save unified merged state back to localStorage
        saveAllMetadataToLocalStorage();

        // Check if client had local selections that the server file was missing
        let hasUnsyncedKeys = false;
        ['database', 'auth', 'ai_tool', 'prompt_tool', 'live_url', 'deployed_branch'].forEach(field => {
            const local = field === 'database' ? localDb : (field === 'auth' ? localAuth : (field === 'ai_tool' ? localAi : (field === 'prompt_tool' ? localPrompt : (field === 'live_url' ? localLiveUrl : localBranch))));
            const server = field === 'database' ? sDb : (field === 'auth' ? sAuth : (field === 'ai_tool' ? sAi : (field === 'prompt_tool' ? sPrompt : (field === 'live_url' ? sLiveUrl : sBranch))));
            for (const k in local) {
                if (local[k] !== undefined && server[k] === undefined) {
                    hasUnsyncedKeys = true;
                    break;
                }
            }
        });

        if (hasUnsyncedKeys) {
            syncMetadataBatchToServer(state.metadata);
        }
    }

    /**
     * Mark that there are unsaved local modifications
     */
    function markUnsavedChanges() {
        state.hasUnsavedChanges = true;
        if (elements.syncMetadataBadge) {
            elements.syncMetadataBadge.classList.remove('hidden');
        }
        if (elements.syncMetadataBtn) {
            elements.syncMetadataBtn.classList.add('border-[#f0883e]/60');
        }
    }

    /**
     * Clear unsaved modifications status
     */
    function clearUnsavedChanges() {
        state.hasUnsavedChanges = false;
        if (elements.syncMetadataBadge) {
            elements.syncMetadataBadge.classList.add('hidden');
        }
        if (elements.syncMetadataBtn) {
            elements.syncMetadataBtn.classList.remove('border-[#f0883e]/60');
        }
    }

    /**
     * Full batch sync of all metadata and work notes to api.php with atomic persistence
     */
    async function syncAllMetadataToServer(manual = true) {
        if (state.isSyncingMetadata) return;
        state.isSyncingMetadata = true;

        if (elements.syncMetadataBtn) {
            elements.syncMetadataBtn.disabled = true;
        }
        if (elements.syncMetadataIcon) {
            elements.syncMetadataIcon.classList.add('animate-spin');
        }
        if (elements.syncMetadataText) {
            elements.syncMetadataText.textContent = 'Saving...';
        }

        const completedNotes = elements.notesCompletedText ? elements.notesCompletedText.value : (localStorage.getItem(NOTES_COMPLETED_KEY) || '');
        const nextStepsNotes = elements.notesNextStepsText ? elements.notesNextStepsText.value : (localStorage.getItem(NOTES_NEXT_STEPS_KEY) || '');

        saveAllMetadataToLocalStorage();
        try {
            localStorage.setItem(NOTES_COMPLETED_KEY, completedNotes);
            localStorage.setItem(NOTES_NEXT_STEPS_KEY, nextStepsNotes);
        } catch (e) {}

        const payload = {
            full_sync: true,
            batch: true,
            metadata: {
                database: state.metadata.database || {},
                auth: state.metadata.auth || {},
                ai_tool: state.metadata.ai_tool || {},
                prompt_tool: state.metadata.prompt_tool || {},
                live_url: state.metadata.live_url || {},
                deployed_branch: state.metadata.deployed_branch || {},
                notes: {
                    completed: completedNotes,
                    next_steps: nextStepsNotes
                }
            }
        };

        try {
            const response = await fetch('api.php?action=save_metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error((data && data.error) || `HTTP ${response.status}: Failed to persist metadata.`);
            }

            clearUnsavedChanges();

            // Visual feedback: green status on button for 2.5 seconds
            if (elements.syncMetadataBtn) {
                elements.syncMetadataBtn.classList.add('!bg-[#238636]', '!border-[#2ea043]', '!text-white');
            }
            if (elements.syncMetadataIcon) {
                elements.syncMetadataIcon.classList.remove('animate-spin');
                elements.syncMetadataIcon.classList.add('text-white');
            }
            if (elements.syncMetadataText) {
                elements.syncMetadataText.textContent = 'Saved \u2713';
            }

            if (manual) {
                showToast('All metadata, trackers, and notes saved to server!', 'success');
            }

            setTimeout(() => {
                if (elements.syncMetadataBtn) {
                    elements.syncMetadataBtn.classList.remove('!bg-[#238636]', '!border-[#2ea043]', '!text-white');
                    elements.syncMetadataBtn.disabled = false;
                }
                if (elements.syncMetadataIcon) {
                    elements.syncMetadataIcon.classList.remove('text-white');
                }
                if (elements.syncMetadataText) {
                    elements.syncMetadataText.textContent = 'Save Changes';
                }
            }, 2500);

        } catch (e) {
            console.error('Failed to save metadata to server:', e);
            if (manual) {
                showToast('Failed to save metadata to server: ' + (e.message || 'Network error'), 'error');
            }
            if (elements.syncMetadataIcon) {
                elements.syncMetadataIcon.classList.remove('animate-spin');
            }
            if (elements.syncMetadataText) {
                elements.syncMetadataText.textContent = 'Save Changes';
            }
            if (elements.syncMetadataBtn) {
                elements.syncMetadataBtn.disabled = false;
            }
        } finally {
            state.isSyncingMetadata = false;
        }
    }

    /**
     * Dispatch background update for a single metadata field to api.php
     */
    async function saveMetadataToServer(repoName, field, value, repoId) {
        try {
            await fetch('api.php?action=metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    repo: repoName,
                    repo_id: repoId || null,
                    field: field,
                    value: value
                })
            });
        } catch (e) {
            console.warn(`Failed to sync metadata for "${repoName}" to server:`, e);
        }
    }

    /**
     * Dispatch background batch metadata update to api.php
     */
    async function syncMetadataBatchToServer(allMetadata) {
        try {
            await fetch('api.php?action=metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    batch: true,
                    metadata: allMetadata
                })
            });
        } catch (e) {
            console.warn('Failed to batch sync metadata to server:', e);
        }
    }

    /**
     * Uniform lookup across repository name, numeric ID, and full name
     */
    function getMetadataValue(map, repo) {
        if (!map || typeof map !== 'object' || !repo) return undefined;
        const nameKey = typeof repo === 'string' ? repo.trim() : (repo.name ? String(repo.name).trim() : '');
        const idKey = (typeof repo === 'object' && repo && repo.id) ? String(repo.id) : '';
        const fullNameKey = (typeof repo === 'object' && repo && repo.full_name) ? String(repo.full_name).trim() : '';

        if (nameKey && map[nameKey] !== undefined) return map[nameKey];
        if (idKey && map[idKey] !== undefined) return map[idKey];
        if (fullNameKey && map[fullNameKey] !== undefined) return map[fullNameKey];
        return undefined;
    }

    /**
     * Set a metadata field uniformly in state, localStorage, and server file
     */
    function setMetadataField(field, repoName, value, repoId) {
        if (!state.metadata[field]) {
            state.metadata[field] = {};
        }

        state.metadata[field][repoName] = value;
        if (repoId) {
            state.metadata[field][String(repoId)] = value;
        }

        saveAllMetadataToLocalStorage();
        markUnsavedChanges();
        saveMetadataToServer(repoName, field, value, repoId);
    }

    /**
     * Retrieve assigned database for a repository (by name or ID)
     */
    function getRepoDbTracker(repo) {
        if (!repo) return 'none';
        const val = getMetadataValue(state.metadata.database, repo);
        if (val !== undefined && val !== null) {
            return val;
        }

        // Intelligent initial fallback from cached inspection if present and unassigned
        const repoName = typeof repo === 'string' ? repo : repo.name;
        const inspection = (repoName && state.inspections[repoName]) || (typeof repo === 'object' && repo ? repo.inspection : null);
        if (inspection && inspection.database && inspection.database.detected) {
            const type = (inspection.database.type || '').toLowerCase();
            if (type.includes('mysql') || type.includes('mariadb')) return 'MySQL';
            if (type.includes('sqlite')) return 'SQLite';
            if (type.includes('mongo')) return 'MongoDB';
            if (type.includes('postgre') || type.includes('pg') || type.includes('supabase')) return 'PostgreSQL';
            return 'Other';
        }
        return 'none';
    }

    /**
     * Update Database tracker for a repository and persist to localStorage & server
     */
    function setRepoDbTracker(repoName, dbValue, repoId) {
        try {
            setMetadataField('database', repoName, dbValue, repoId);

            const choice = DB_TRACKER_CHOICES.find(c => c.value === dbValue);
            const label = choice ? choice.label : dbValue;
            showToast(`Database for "${repoName}" updated to ${label}`, 'success');

            syncDbSelectsInDOM(repoName, dbValue, repoId);
        } catch (e) {
            console.error('Failed to save database tracker:', e);
            showToast('Failed to save database selection.', 'error');
        }
    }

    /**
     * Sync Database select element styles across list, grid, and modal
     */
    function syncDbSelectsInDOM(repoName, dbValue, repoId) {
        const selector = `select[data-repo-db-name="${CSS.escape(repoName)}"]` + (repoId ? `, select[data-repo-db-id="${CSS.escape(String(repoId))}"]` : '');
        const selects = document.querySelectorAll(selector);
        selects.forEach(sel => {
            sel.value = dbValue;
            updateDbSelectStyle(sel, dbValue);
        });
    }

    /**
     * Update Tailwind styling on Database Select element dynamically based on selection
     */
    function updateDbSelectStyle(selectEl, dbValue) {
        if (!selectEl) return;
        if (dbValue === 'MySQL') {
            selectEl.className = 'bg-[#161b22] text-[#f0883e] border border-[#f0883e]/50 focus:border-[#f0883e] focus:ring-1 focus:ring-[#f0883e] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (dbValue === 'SQLite') {
            selectEl.className = 'bg-[#161b22] text-[#79c0ff] border border-[#388bfd]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (dbValue === 'MongoDB') {
            selectEl.className = 'bg-[#161b22] text-[#3fb950] border border-[#3fb950]/50 focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (dbValue === 'PostgreSQL') {
            selectEl.className = 'bg-[#161b22] text-[#58a6ff] border border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (dbValue === 'Other') {
            selectEl.className = 'bg-[#161b22] text-[#d2a8ff] border border-[#a371f7]/50 focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else {
            selectEl.className = 'bg-[#0d1117] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        }
    }

    /**
     * Build HTML markup for Database dropdown selector
     */
    function buildDbSelectHtml(repo) {
        const current = getRepoDbTracker(repo);
        const repoNameEsc = escapeHtml(repo.name);
        const repoId = repo.id || 0;

        let styleClasses = 'bg-[#0d1117] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        if (current === 'MySQL') styleClasses = 'bg-[#161b22] text-[#f0883e] border border-[#f0883e]/50 focus:border-[#f0883e] focus:ring-1 focus:ring-[#f0883e] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'SQLite') styleClasses = 'bg-[#161b22] text-[#79c0ff] border border-[#388bfd]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'MongoDB') styleClasses = 'bg-[#161b22] text-[#3fb950] border border-[#3fb950]/50 focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'PostgreSQL') styleClasses = 'bg-[#161b22] text-[#58a6ff] border border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'Other') styleClasses = 'bg-[#161b22] text-[#d2a8ff] border border-[#a371f7]/50 focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';

        return `
            <select data-repo-db-name="${repoNameEsc}" 
                    data-repo-db-id="${repoId}" 
                    onchange="window.setRepoDbTracker('${repoNameEsc}', this.value, ${repoId})" 
                    class="${styleClasses}">
                ${DB_TRACKER_CHOICES.map(c => `
                    <option value="${c.value}" class="bg-[#161b22] text-[#e6edf3]" ${current === c.value ? 'selected' : ''}>
                        ${escapeHtml(c.label)}
                    </option>
                `).join('')}
            </select>
        `;
    }

    /**
     * Retrieve assigned Auth status for a repository ('None', 'Done', 'In Progress')
     */
    function getRepoAuthStatus(repo) {
        if (!repo) return 'None';
        const val = getMetadataValue(state.metadata.auth, repo);
        if (val !== undefined && val !== null) {
            return val;
        }

        // Intelligent initial fallback from cached inspection if present and unassigned
        const repoName = typeof repo === 'string' ? repo : repo.name;
        const inspection = (repoName && state.inspections[repoName]) || (typeof repo === 'object' && repo ? repo.inspection : null);
        if (inspection && inspection.auth && inspection.auth.detected) {
            return 'Done';
        }
        return 'None';
    }

    /**
     * Cycle through Auth status: None -> In Progress -> Done -> None
     */
    function toggleRepoAuthStatus(repoName, repoId) {
        try {
            const current = getRepoAuthStatus(repoName);
            let next = 'In Progress';
            if (current === 'None') next = 'In Progress';
            else if (current === 'In Progress') next = 'Done';
            else if (current === 'Done') next = 'None';

            setMetadataField('auth', repoName, next, repoId);
            showToast(`Auth status for "${repoName}": ${next}`, 'success');

            syncAuthButtonsInDOM(repoName, next, repoId);
        } catch (e) {
            console.error('Failed to toggle auth status:', e);
            showToast('Failed to update auth status.', 'error');
        }
    }

    /**
     * Sync Auth buttons in DOM across list, grid, and modal
     */
    function syncAuthButtonsInDOM(repoName, status, repoId) {
        const selector = `button[data-auth-tracker="${CSS.escape(repoName)}"]` + (repoId ? `, button[data-auth-id="${CSS.escape(String(repoId))}"]` : '');
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(btn => {
            btn.className = getAuthStatusBadgeClasses(status);
            btn.innerHTML = buildAuthStatusBadgeInnerHtml(status);
            btn.title = `Auth / Login status: ${status} (Click to toggle: None → In Progress → Done)`;
        });
    }

    /**
     * Return Tailwind classes for Auth status badge button
     */
    function getAuthStatusBadgeClasses(status) {
        if (status === 'Done') {
            return 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40 hover:brightness-110 active:scale-95 transition cursor-pointer shadow-sm select-none';
        } else if (status === 'In Progress') {
            return 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#d29922]/20 text-[#d29922] border border-[#d29922]/40 hover:brightness-110 active:scale-95 transition cursor-pointer shadow-sm select-none';
        } else {
            return 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#161b22] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff]/50 active:scale-95 transition cursor-pointer select-none';
        }
    }

    /**
     * Build inner HTML for Auth status badge button
     */
    function buildAuthStatusBadgeInnerHtml(status) {
        if (status === 'Done') {
            return `
                <svg class="w-3.5 h-3.5 text-[#3fb950]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>Done</span>
            `;
        } else if (status === 'In Progress') {
            return `
                <span class="w-2 h-2 rounded-full bg-[#d29922] animate-pulse"></span>
                <span>In Progress</span>
            `;
        } else {
            return `
                <span class="opacity-50 text-[10px]">&bull;</span>
                <span>None</span>
            `;
        }
    }

    /**
     * Build HTML markup for Auth status toggle button
     */
    function buildAuthStatusToggleHtml(repo) {
        const status = getRepoAuthStatus(repo);
        const repoNameEsc = escapeHtml(repo.name);
        const repoId = repo.id || 0;
        const classes = getAuthStatusBadgeClasses(status);
        const inner = buildAuthStatusBadgeInnerHtml(status);

        return `
            <button type="button" 
                    data-auth-tracker="${repoNameEsc}" 
                    data-auth-id="${repoId}" 
                    onclick="window.toggleRepoAuthStatus('${repoNameEsc}', ${repoId})" 
                    class="${classes}" 
                    title="Auth / Login status: ${status} (Click to toggle: None → In Progress → Done)">
                ${inner}
            </button>
        `;
    }

    // Retain compatibility aliases
    function renderDatabaseCell(repo) { return buildDbSelectHtml(repo); }
    function renderAuthCell(repo) { return buildAuthStatusToggleHtml(repo); }

    /**
     * Clean and validate a live website URL
     */
    function formatLiveUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
        if (/^https?:\/\//i.test(trimmed)) {
            return trimmed;
        }
        if (/^localhost(:\d+)?/i.test(trimmed)) {
            return 'http://' + trimmed;
        }
        if (/^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+/i.test(trimmed)) {
            return 'https://' + trimmed;
        }
        return null;
    }

    /**
     * Get effective live URL for a repository, giving precedence to manual override
     * Returns: { url: string|null, isCustom: boolean }
     */
    function getRepoEffectiveLiveUrl(repo) {
        if (!repo) return { url: null, isCustom: false };

        const customVal = getMetadataValue(state.metadata.live_url, repo);
        const formattedCustom = customVal ? formatLiveUrl(customVal) : null;

        if (formattedCustom) {
            return { url: formattedCustom, isCustom: true };
        }

        const formattedDefault = formatLiveUrl(repo.homepage);
        if (formattedDefault) {
            return { url: formattedDefault, isCustom: false };
        }

        return { url: null, isCustom: false };
    }

    /**
     * Set or clear custom Live App URL for a repository, persisting to localStorage and api.php
     */
    function setRepoCustomLiveUrl(repoName, customUrl, repoId) {
        try {
            const cleanedUrl = customUrl ? formatLiveUrl(customUrl) : '';
            setMetadataField('live_url', repoName, cleanedUrl || '', repoId);

            const targetRepo = state.repositories.find(r => r.name === repoName || (repoId && r.id === repoId));
            if (targetRepo && targetRepo.user_metadata) {
                targetRepo.user_metadata.live_url = cleanedUrl || null;
            }

            updateLiveUrlDOM(repoName, targetRepo || { name: repoName, id: repoId });

            if (cleanedUrl) {
                showToast(`Live App URL for "${repoName}" updated.`, 'success');
            } else {
                showToast(`Live App URL for "${repoName}" reset to default.`, 'info');
            }
        } catch (e) {
            console.error('Failed to set custom live URL:', e);
            showToast('Failed to save Live App URL.', 'error');
        }
    }

    /**
     * Update Live URL cell DOM across table, grid, and modal
     */
    function updateLiveUrlDOM(repoName, repo) {
        const listCells = document.querySelectorAll(`[data-live-cell="${CSS.escape(repoName)}"]`);
        listCells.forEach(cell => {
            const parentTd = cell.closest('td');
            if (parentTd) {
                parentTd.innerHTML = renderLiveAppCell(repo);
            } else {
                cell.outerHTML = renderLiveAppCell(repo);
            }
        });

        if (state.viewMode === 'grid') {
            renderGridView();
        }
        if (state.selectedRepo && state.selectedRepo.name === repoName && elements.repoModal && !elements.repoModal.classList.contains('hidden')) {
            openRepoModal(state.selectedRepo.id);
        }
    }

    /**
     * Render Live App Table Cell
     */
    function renderLiveAppCell(repo) {
        const info = getRepoEffectiveLiveUrl(repo);
        const effectiveUrl = info.url;
        const isCustom = info.isCustom;

        let badgeHtml = '';
        if (effectiveUrl) {
            const badgeClasses = isCustom
                ? 'bg-[#1f6feb]/20 hover:bg-[#1f6feb]/35 text-[#58a6ff] border-[#388bfd]/50'
                : 'bg-[#238636]/20 hover:bg-[#238636]/35 text-[#3fb950] border-[#238636]/40';
            const badgeTitle = isCustom
                ? `Visit App (Custom Override): ${escapeHtml(effectiveUrl)}`
                : `Visit App: ${escapeHtml(effectiveUrl)}`;

            badgeHtml = `
                <a href="${escapeHtml(effectiveUrl)}" target="_blank" rel="noopener noreferrer" 
                   class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${badgeClasses} border transition shadow-sm hover:scale-105 active:scale-95" 
                   title="${badgeTitle}">
                   <span>Visit App</span>
                   <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </a>
            `;
        } else {
            badgeHtml = `<span class="text-[#8b949e]/40 font-mono text-xs select-none pl-1">—</span>`;
        }

        const editBtn = `
            <button onclick="window.editLiveUrl('${escapeHtml(repo.name)}', ${repo.id})" 
                    class="p-1 rounded text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#21262d] transition opacity-70 group-hover:opacity-100" 
                    title="${isCustom ? 'Edit custom Live App URL (Override Active)' : 'Set custom Live App URL'}">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
        `;

        const customTag = isCustom ? `
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#1f6feb]/20 text-[#79c0ff] border border-[#388bfd]/30 select-none" title="Custom manual override: ${escapeHtml(effectiveUrl)}">Custom</span>
        ` : '';

        return `
            <div class="flex items-center gap-1.5" data-live-cell="${escapeHtml(repo.name)}" ondblclick="window.editLiveUrl('${escapeHtml(repo.name)}', ${repo.id})">
                ${badgeHtml}
                ${customTag}
                ${editBtn}
            </div>
        `;
    }

    /**
     * Open Edit Live App URL Modal Dialog
     */
    function openLiveUrlModal(repoName, repoId) {
        const repo = state.repositories.find(r => r.name === repoName || (repoId && r.id === repoId));
        if (!repo) return;

        state.editingLiveUrlRepo = { name: repo.name, id: repo.id };

        if (elements.liveUrlModalRepoName) {
            elements.liveUrlModalRepoName.textContent = repo.full_name || repo.name;
        }

        const info = getRepoEffectiveLiveUrl(repo);
        const defaultHomepage = formatLiveUrl(repo.homepage);

        if (elements.liveUrlInput) {
            elements.liveUrlInput.value = info.isCustom ? (info.url || '') : '';
        }

        if (elements.liveUrlDefaultValue) {
            elements.liveUrlDefaultValue.textContent = defaultHomepage ? defaultHomepage : 'None specified in GitHub';
        }

        if (elements.resetLiveUrlBtn) {
            if (info.isCustom) {
                elements.resetLiveUrlBtn.classList.remove('hidden');
            } else {
                elements.resetLiveUrlBtn.classList.add('hidden');
            }
        }

        if (elements.liveUrlModal) {
            elements.liveUrlModal.classList.remove('hidden');
            setTimeout(() => {
                if (elements.liveUrlInput) {
                    elements.liveUrlInput.focus();
                    elements.liveUrlInput.select();
                }
            }, 50);
        }
    }

    /**
     * Close Edit Live App URL Modal Dialog
     */
    function closeLiveUrlModal() {
        if (elements.liveUrlModal) {
            elements.liveUrlModal.classList.add('hidden');
        }
        state.editingLiveUrlRepo = null;
    }

    /**
     * Handle Live App URL Form Submission
     */
    function handleLiveUrlFormSubmit(e) {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        if (!state.editingLiveUrlRepo) return;
        const val = elements.liveUrlInput ? elements.liveUrlInput.value.trim() : '';
        setRepoCustomLiveUrl(state.editingLiveUrlRepo.name, val, state.editingLiveUrlRepo.id);
        closeLiveUrlModal();
    }

    /**
     * Handle Reset Live App URL to Default
     */
    function handleResetLiveUrl() {
        if (!state.editingLiveUrlRepo) return;
        setRepoCustomLiveUrl(state.editingLiveUrlRepo.name, '', state.editingLiveUrlRepo.id);
        closeLiveUrlModal();
    }

    /**
     * Retrieve Deployed Branch info for a repository:
     * Returns: { branch: string, isCustom: boolean, isPages: boolean, defaultBranch: string }
     */
    function getRepoDeployedBranchInfo(repo) {
        if (!repo) return { branch: 'main', isCustom: false, isPages: false, defaultBranch: 'main' };
        const defaultBranch = repo.default_branch || 'main';
        const customVal = getMetadataValue(state.metadata.deployed_branch, repo);

        if (customVal && typeof customVal === 'string' && customVal.trim()) {
            return {
                branch: customVal.trim(),
                isCustom: true,
                isPages: false,
                defaultBranch: defaultBranch
            };
        }

        const repoName = typeof repo === 'string' ? repo : repo.name;
        const inspection = (repoName && state.inspections[repoName]) || (typeof repo === 'object' && repo ? repo.inspection : null);
        if (inspection && inspection.pages_branch) {
            return {
                branch: inspection.pages_branch,
                isCustom: false,
                isPages: true,
                defaultBranch: defaultBranch
            };
        }

        return {
            branch: defaultBranch,
            isCustom: false,
            isPages: false,
            defaultBranch: defaultBranch
        };
    }

    /**
     * Retrieve the effective deployed branch name
     */
    function getRepoDeployedBranch(repo) {
        return getRepoDeployedBranchInfo(repo).branch;
    }

    /**
     * Retrieve latest active branch (from GitHub events or default branch)
     */
    function getRepoLatestActiveBranch(repo) {
        if (!repo) return 'main';
        const repoName = typeof repo === 'string' ? repo : repo.name;
        const inspection = (repoName && state.inspections[repoName]) || (typeof repo === 'object' && repo ? repo.inspection : null);
        if (inspection && inspection.latest_active_branch) {
            return inspection.latest_active_branch;
        }
        return repo.default_branch || 'main';
    }

    /**
     * Collect known and common branches for dropdown options
     */
    function getRepoKnownBranches(repo) {
        if (!repo) return ['main'];
        const repoName = typeof repo === 'string' ? repo : repo.name;
        const defaultBranch = repo.default_branch || 'main';
        const inspection = (repoName && state.inspections[repoName]) || (typeof repo === 'object' && repo ? repo.inspection : null);

        const list = new Set();
        list.add(defaultBranch);

        if (inspection && Array.isArray(inspection.branches)) {
            inspection.branches.forEach(b => {
                if (b && typeof b === 'string') list.add(b.trim());
            });
        }

        // Standard conventions
        ['main', 'master', 'production', 'gh-pages', 'release', 'develop'].forEach(b => list.add(b));

        const current = getRepoDeployedBranch(repo);
        if (current) list.add(current);

        return Array.from(list);
    }

    /**
     * Set or clear custom deployed branch for a repository
     */
    function setRepoDeployedBranch(repoName, branchName, repoId) {
        try {
            const cleaned = (branchName || '').trim();
            setMetadataField('deployed_branch', repoName, cleaned, repoId);

            const targetRepo = state.repositories.find(r => r.name === repoName || (repoId && r.id === repoId));
            if (targetRepo && targetRepo.user_metadata) {
                targetRepo.user_metadata.deployed_branch = cleaned || null;
            }

            updateRepoBranchDOM(repoName, targetRepo || { name: repoName, id: repoId });

            if (cleaned) {
                showToast(`Deployed branch for "${repoName}" set to "${cleaned}".`, 'success');
            } else {
                showToast(`Deployed branch for "${repoName}" reset to default.`, 'info');
            }
        } catch (e) {
            console.error('Failed to set deployed branch:', e);
            showToast('Failed to save deployed branch.', 'error');
        }
    }

    /**
     * Update branch cells in DOM across list, grid, and modal
     */
    function updateRepoBranchDOM(repoName, repo) {
        const depCells = document.querySelectorAll(`[data-cell-dep-branch="${CSS.escape(repoName)}"]`);
        depCells.forEach(cell => {
            cell.outerHTML = renderDeployedBranchCell(repo);
        });

        const actCells = document.querySelectorAll(`[data-cell-act-branch="${CSS.escape(repoName)}"]`);
        actCells.forEach(cell => {
            cell.outerHTML = renderLatestActiveBranchCell(repo);
        });

        if (state.viewMode === 'grid') {
            renderGridView();
        }
    }

    /**
     * Render Deployed Branch table cell with inline dropdown and custom override pencil
     */
    function renderDeployedBranchCell(repo) {
        const info = getRepoDeployedBranchInfo(repo);
        const repoNameEsc = escapeHtml(repo.name);
        const repoId = repo.id || 0;
        const currentBranch = info.branch;
        const knownBranches = getRepoKnownBranches(repo);

        let borderClass = 'border-[#30363d] text-[#c9d1d9]';
        if (info.isCustom) {
            borderClass = 'border-[#a371f7]/60 text-[#d2a8ff] bg-[#221735]';
        } else if (info.isPages) {
            borderClass = 'border-[#388bfd]/50 text-[#79c0ff] bg-[#102038]';
        }

        return `
            <div class="flex items-center gap-1.5" data-cell-dep-branch="${repoNameEsc}">
                <div class="relative inline-flex items-center">
                    <select data-repo-branch-name="${repoNameEsc}"
                            data-repo-branch-id="${repoId}"
                            onchange="window.handleDeployedBranchSelectChange('${repoNameEsc}', this.value, ${repoId})"
                            class="bg-[#161b22] ${borderClass} focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-mono max-w-[130px] truncate"
                            title="Deployed Branch: ${escapeHtml(currentBranch)}${info.isCustom ? ' (Custom Override)' : (info.isPages ? ' (GitHub Pages)' : ' (Default)')}">
                        ${knownBranches.map(b => `
                            <option value="${escapeHtml(b)}" class="bg-[#161b22] text-[#e6edf3]" ${currentBranch === b ? 'selected' : ''}>
                                ${escapeHtml(b)}${b === repo.default_branch ? ' *' : ''}
                            </option>
                        `).join('')}
                        <option value="__CUSTOM__" class="bg-[#21262d] text-[#58a6ff] font-sans">+ Custom...</option>
                    </select>
                </div>
                ${info.isCustom ? `<span class="text-[9px] px-1 py-0.5 rounded bg-[#a371f7]/20 text-[#d2a8ff] border border-[#a371f7]/30 select-none" title="Custom branch override">Custom</span>` : ''}
                <button type="button" 
                        onclick="window.editDeployedBranch('${repoNameEsc}', ${repoId})" 
                        class="p-1 rounded text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#21262d] transition" 
                        title="Set custom branch name or reset to default">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
            </div>
        `;
    }

    /**
     * Render Latest Active Branch table cell with comparison badge
     */
    function renderLatestActiveBranchCell(repo) {
        const repoNameEsc = escapeHtml(repo.name);
        const depInfo = getRepoDeployedBranchInfo(repo);
        const activeBranch = getRepoLatestActiveBranch(repo);
        const isMatching = (activeBranch === depInfo.branch);

        if (isMatching) {
            return `
                <div class="inline-flex items-center gap-1.5" data-cell-act-branch="${repoNameEsc}">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#161b22] text-[#3fb950] border border-[#238636]/40 select-none shadow-sm" 
                          title="Latest push matches deployed branch (${escapeHtml(activeBranch)})">
                        <svg class="w-3 h-3 text-[#3fb950]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                        <span>${escapeHtml(activeBranch)}</span>
                        <svg class="w-2.5 h-2.5 text-[#3fb950] ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    </span>
                </div>
            `;
        } else {
            return `
                <div class="inline-flex items-center gap-1.5" data-cell-act-branch="${repoNameEsc}">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#2a1708] text-[#f0883e] border border-[#f0883e]/50 select-none shadow-sm" 
                          title="Recent activity detected on different branch: ${escapeHtml(activeBranch)} (Deployed is: ${escapeHtml(depInfo.branch)})">
                        <svg class="w-3 h-3 text-[#f0883e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                        <span>${escapeHtml(activeBranch)}</span>
                        <span class="text-[9px] bg-[#f0883e]/25 text-[#f0883e] border border-[#f0883e]/40 px-1 rounded font-sans ml-0.5 animate-pulse">Active</span>
                    </span>
                </div>
            `;
        }
    }

    /**
     * Open Set Deployed Branch Modal Dialog
     */
    function openBranchModal(repoName, repoId) {
        const repo = state.repositories.find(r => r.name === repoName || (repoId && r.id === repoId));
        if (!repo) return;

        state.editingBranchRepo = { name: repo.name, id: repo.id };

        if (elements.branchModalRepoName) {
            elements.branchModalRepoName.textContent = repo.full_name || repo.name;
        }

        const info = getRepoDeployedBranchInfo(repo);
        const defaultBranch = repo.default_branch || 'main';

        if (elements.branchInput) {
            elements.branchInput.value = info.isCustom ? info.branch : '';
        }

        if (elements.branchDefaultValue) {
            elements.branchDefaultValue.textContent = defaultBranch;
        }

        if (elements.resetBranchBtn) {
            if (info.isCustom) {
                elements.resetBranchBtn.classList.remove('hidden');
            } else {
                elements.resetBranchBtn.classList.add('hidden');
            }
        }

        // Render quick suggestion pills
        if (elements.branchQuickPills) {
            const known = getRepoKnownBranches(repo);
            elements.branchQuickPills.innerHTML = known.map(b => `
                <button type="button" 
                        onclick="window.selectBranchPill('${escapeHtml(b)}')"
                        class="px-2 py-0.5 rounded text-xs font-mono bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] hover:text-white border border-[#30363d] hover:border-[#58a6ff] transition">
                    ${escapeHtml(b)}
                </button>
            `).join('');
        }

        if (elements.branchModal) {
            elements.branchModal.classList.remove('hidden');
            setTimeout(() => {
                if (elements.branchInput) {
                    elements.branchInput.focus();
                    elements.branchInput.select();
                }
            }, 50);
        }
    }

    /**
     * Close Set Deployed Branch Modal Dialog
     */
    function closeBranchModal() {
        if (elements.branchModal) {
            elements.branchModal.classList.add('hidden');
        }
        state.editingBranchRepo = null;
    }

    /**
     * Handle Deployed Branch Form Submission
     */
    function handleBranchFormSubmit(e) {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        if (!state.editingBranchRepo) return;
        const val = elements.branchInput ? elements.branchInput.value.trim() : '';
        setRepoDeployedBranch(state.editingBranchRepo.name, val, state.editingBranchRepo.id);
        closeBranchModal();
    }

    /**
     * Handle Reset Deployed Branch to Default
     */
    function handleResetBranch() {
        if (!state.editingBranchRepo) return;
        setRepoDeployedBranch(state.editingBranchRepo.name, '', state.editingBranchRepo.id);
        closeBranchModal();
    }

    /**
     * Handle quick branch selection pill in branch modal
     */
    function selectBranchPill(branchName) {
        if (elements.branchInput) {
            elements.branchInput.value = branchName;
            elements.branchInput.focus();
        }
    }

    /**
     * Handle Deployed Branch select dropdown change
     */
    function handleDeployedBranchSelectChange(repoName, val, repoId) {
        if (val === '__CUSTOM__') {
            openBranchModal(repoName, repoId);
            const repo = state.repositories.find(r => r.name === repoName || (repoId && r.id === repoId));
            if (repo) {
                updateRepoBranchDOM(repo);
            }
            return;
        }
        const repo = state.repositories.find(r => r.name === repoName || (repoId && r.id === repoId));
        const defaultBranch = repo ? (repo.default_branch || 'main') : 'main';
        if (val === defaultBranch) {
            setRepoDeployedBranch(repoName, '', repoId);
        } else {
            setRepoDeployedBranch(repoName, val, repoId);
        }
    }

    /**
     * Retrieve AI tool assigned to a given repository (by name or ID)
     */
    function getRepoAiTool(repo) {
        if (!repo) return 'none';
        const val = getMetadataValue(state.metadata.ai_tool, repo);
        return (val !== undefined && val !== null) ? val : 'none';
    }

    /**
     * Update AI tool assigned to a repository and persist to localStorage & server
     */
    function setRepoAiTool(repoName, toolValue, repoId) {
        try {
            setMetadataField('ai_tool', repoName, toolValue, repoId);

            const choice = AI_TOOL_CHOICES.find(c => c.value === toolValue);
            const label = choice ? choice.label : toolValue;
            showToast(`AI Tool for "${repoName}" updated to ${label}`, 'success');

            syncAiSelectsInDOM(repoName, toolValue, repoId);
        } catch (e) {
            console.error('Failed to save AI tool:', e);
            showToast('Failed to save AI tool selection.', 'error');
        }
    }

    /**
     * Sync AI Tool select elements in DOM across views
     */
    function syncAiSelectsInDOM(repoName, toolValue, repoId) {
        const selector = `select[data-repo-name="${CSS.escape(repoName)}"]` + (repoId ? `, select[data-repo-id="${CSS.escape(String(repoId))}"]` : '');
        const selects = document.querySelectorAll(selector);
        selects.forEach(sel => {
            sel.value = toolValue;
            updateAiSelectStyle(sel, toolValue);
        });
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
                    data-repo-id="${repoId}" 
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

    /**
     * Retrieve Prompt Explainer tool assigned to a given repository (by name or ID)
     */
    function getRepoPromptTool(repo) {
        if (!repo) return 'none';
        const val = getMetadataValue(state.metadata.prompt_tool, repo);
        return (val !== undefined && val !== null) ? val : 'none';
    }

    /**
     * Update Prompt Explainer tool assigned to a repository and persist to localStorage & server
     */
    function setRepoPromptTool(repoName, toolValue, repoId) {
        try {
            setMetadataField('prompt_tool', repoName, toolValue, repoId);

            const choice = PROMPT_TOOL_CHOICES.find(c => c.value === toolValue);
            const label = choice ? choice.label : toolValue;
            showToast(`Prompt / Explainer for "${repoName}" updated to ${label}`, 'success');

            syncPromptSelectsInDOM(repoName, toolValue, repoId);
        } catch (e) {
            console.error('Failed to save prompt explainer:', e);
            showToast('Failed to save prompt explainer selection.', 'error');
        }
    }

    /**
     * Sync Prompt select elements in DOM across views
     */
    function syncPromptSelectsInDOM(repoName, toolValue, repoId) {
        const selector = `select[data-repo-prompt-name="${CSS.escape(repoName)}"]` + (repoId ? `, select[data-repo-prompt-id="${CSS.escape(String(repoId))}"]` : '');
        const selects = document.querySelectorAll(selector);
        selects.forEach(sel => {
            sel.value = toolValue;
            updatePromptSelectStyle(sel, toolValue);
        });
    }

    /**
     * Update Tailwind styling on Prompt Select element dynamically based on selection
     */
    function updatePromptSelectStyle(selectEl, toolValue) {
        if (!selectEl) return;
        if (toolValue === 'Gemini') {
            selectEl.className = 'bg-[#161b22] text-[#58a6ff] border border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (toolValue === 'ChatGPT') {
            selectEl.className = 'bg-[#161b22] text-[#3fb950] border border-[#3fb950]/50 focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (toolValue === 'Claude') {
            selectEl.className = 'bg-[#161b22] text-[#d29922] border border-[#d29922]/50 focus:border-[#d29922] focus:ring-1 focus:ring-[#d29922] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else if (toolValue === 'Other') {
            selectEl.className = 'bg-[#161b22] text-[#c9d1d9] border border-[#30363d] focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        } else {
            selectEl.className = 'bg-[#0d1117] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        }
    }

    /**
     * Build HTML markup for Prompt Explainer dropdown selector
     */
    function buildPromptSelectHtml(repo) {
        const current = getRepoPromptTool(repo);
        const repoNameEsc = escapeHtml(repo.name);
        const repoId = repo.id || 0;

        let styleClasses = 'bg-[#0d1117] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        if (current === 'Gemini') styleClasses = 'bg-[#161b22] text-[#58a6ff] border border-[#58a6ff]/50 focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'ChatGPT') styleClasses = 'bg-[#161b22] text-[#3fb950] border border-[#3fb950]/50 focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'Claude') styleClasses = 'bg-[#161b22] text-[#d29922] border border-[#d29922]/50 focus:border-[#d29922] focus:ring-1 focus:ring-[#d29922] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';
        else if (current === 'Other') styleClasses = 'bg-[#161b22] text-[#c9d1d9] border border-[#30363d] focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer transition shadow-sm font-medium';

        return `
            <select data-repo-prompt-name="${repoNameEsc}" 
                    data-repo-prompt-id="${repoId}" 
                    onchange="window.setRepoPromptTool('${repoNameEsc}', this.value, ${repoId})" 
                    class="${styleClasses}">
                ${PROMPT_TOOL_CHOICES.map(c => `
                    <option value="${c.value}" class="bg-[#161b22] text-[#e6edf3]" ${current === c.value ? 'selected' : ''}>
                        ${escapeHtml(c.label)}
                    </option>
                `).join('')}
            </select>
        `;
    }

    // Work Notes & Progress Persistence Keys
    const NOTES_COMPLETED_KEY = 'all_repos_notes_completed';
    const NOTES_NEXT_STEPS_KEY = 'all_repos_notes_next_steps';
    let notesSaveTimeout = null;

    /**
     * Open Work Notes & Progress side drawer
     */
    function openNotesDrawer() {
        if (!elements.notesDrawer) return;
        elements.notesDrawer.classList.remove('invisible', 'pointer-events-none');
        elements.notesDrawer.classList.add('visible', 'pointer-events-auto');
        elements.notesDrawerBackdrop.classList.remove('opacity-0', 'pointer-events-none');
        elements.notesDrawerBackdrop.classList.add('opacity-100', 'pointer-events-auto');
        elements.notesDrawerPanel.classList.remove('translate-x-full');
        elements.notesDrawerPanel.classList.add('translate-x-0');
        document.body.classList.add('overflow-hidden');
    }

    /**
     * Close Work Notes & Progress side drawer
     */
    function closeNotesDrawer() {
        if (!elements.notesDrawer) return;
        elements.notesDrawerPanel.classList.remove('translate-x-0');
        elements.notesDrawerPanel.classList.add('translate-x-full');
        elements.notesDrawerBackdrop.classList.remove('opacity-100', 'pointer-events-auto');
        elements.notesDrawerBackdrop.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            if (elements.notesDrawerPanel && elements.notesDrawerPanel.classList.contains('translate-x-full')) {
                elements.notesDrawer.classList.remove('visible', 'pointer-events-auto');
                elements.notesDrawer.classList.add('invisible', 'pointer-events-none');
                document.body.classList.remove('overflow-hidden');
            }
        }, 300);
    }

    /**
     * Load persisted notes from localStorage into textareas
     */
    function loadNotes() {
        try {
            const completed = localStorage.getItem(NOTES_COMPLETED_KEY) || '';
            const nextSteps = localStorage.getItem(NOTES_NEXT_STEPS_KEY) || '';
            if (elements.notesCompletedText) elements.notesCompletedText.value = completed;
            if (elements.notesNextStepsText) elements.notesNextStepsText.value = nextSteps;
            updateNotesStats();
        } catch (e) {
            console.error('Failed to load work notes from localStorage:', e);
        }
    }

    /**
     * Handle auto-save on user input in notes textareas
     */
    function handleNotesInput() {
        const completed = elements.notesCompletedText ? elements.notesCompletedText.value : '';
        const nextSteps = elements.notesNextStepsText ? elements.notesNextStepsText.value : '';

        try {
            localStorage.setItem(NOTES_COMPLETED_KEY, completed);
            localStorage.setItem(NOTES_NEXT_STEPS_KEY, nextSteps);
        } catch (e) {
            console.error('Failed to save notes to localStorage:', e);
        }

        markUnsavedChanges();
        updateNotesStats();

        if (elements.notesAutoSaveStatus) {
            elements.notesAutoSaveStatus.innerHTML = `
                <span class="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-ping"></span>
                <span class="text-[#58a6ff]">Saving...</span>
            `;
            clearTimeout(notesSaveTimeout);
            notesSaveTimeout = setTimeout(() => {
                if (elements.notesAutoSaveStatus) {
                    elements.notesAutoSaveStatus.innerHTML = `
                        <span class="w-1.5 h-1.5 rounded-full bg-[#3fb950]"></span>
                        <span class="text-[#3fb950]">Saved locally</span>
                    `;
                }
            }, 400);
        }
    }

    /**
     * Update character counts and navbar active indicator dot
     */
    function updateNotesStats() {
        const completed = elements.notesCompletedText ? elements.notesCompletedText.value : '';
        const nextSteps = elements.notesNextStepsText ? elements.notesNextStepsText.value : '';

        if (elements.notesCompletedCount) {
            elements.notesCompletedCount.textContent = `${completed.length.toLocaleString()} chars`;
        }
        if (elements.notesNextStepsCount) {
            elements.notesNextStepsCount.textContent = `${nextSteps.length.toLocaleString()} chars`;
        }

        const hasNotes = Boolean(completed.trim() || nextSteps.trim());
        if (elements.notesIndicator) {
            if (hasNotes) {
                elements.notesIndicator.classList.remove('hidden');
            } else {
                elements.notesIndicator.classList.add('hidden');
            }
        }
    }

    /**
     * Copy formatted Markdown notes to clipboard
     */
    function copyFormattedNotes() {
        const completed = elements.notesCompletedText ? elements.notesCompletedText.value.trim() : '';
        const nextSteps = elements.notesNextStepsText ? elements.notesNextStepsText.value.trim() : '';

        if (!completed && !nextSteps) {
            showToast('Work notes are currently empty.', 'info');
            return;
        }

        const formatted = [
            '# All Repos - Work Notes & Progress',
            '',
            '## What Was Done / Completed:',
            completed || '_No completed items recorded yet._',
            '',
            '## In Progress / Next Steps:',
            nextSteps || '_No upcoming steps recorded yet._',
            '',
            `> Generated on ${new Date().toUTCString()} from All Repos`
        ].join('\n');

        copyToClipboard(formatted, 'Formatted Work Notes');
    }

    /**
     * Clear all work notes after confirmation
     */
    function clearAllNotes() {
        const completed = elements.notesCompletedText ? elements.notesCompletedText.value.trim() : '';
        const nextSteps = elements.notesNextStepsText ? elements.notesNextStepsText.value.trim() : '';

        if (!completed && !nextSteps) {
            showToast('Work notes are already empty.', 'info');
            return;
        }

        if (window.confirm('Are you sure you want to clear all work notes? This action cannot be undone.')) {
            try {
                localStorage.removeItem(NOTES_COMPLETED_KEY);
                localStorage.removeItem(NOTES_NEXT_STEPS_KEY);
            } catch (e) {
                console.error('Failed to clear notes in localStorage:', e);
            }
            if (elements.notesCompletedText) elements.notesCompletedText.value = '';
            if (elements.notesNextStepsText) elements.notesNextStepsText.value = '';
            markUnsavedChanges();
            updateNotesStats();
            showToast('All work notes have been cleared.', 'info');
        }
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

    // Soft Blue Slate / Dark Theme Management
    const THEME_STORAGE_KEY = 'all_repos_theme';
    let isTogglingTheme = false;

    /**
     * Apply active theme ('dark' or 'soft-blue')
     */
    function applyTheme(theme) {
        const isSoftBlue = (theme === 'soft-blue');
        const root = document.documentElement;
        if (isSoftBlue) {
            root.classList.add('theme-soft-blue');
            if (elements.themeIconDark) elements.themeIconDark.classList.add('hidden');
            if (elements.themeIconLight) elements.themeIconLight.classList.remove('hidden');
            if (elements.themeToggleText) elements.themeToggleText.textContent = 'Soft Blue';
        } else {
            root.classList.remove('theme-soft-blue');
            if (elements.themeIconDark) elements.themeIconDark.classList.remove('hidden');
            if (elements.themeIconLight) elements.themeIconLight.classList.add('hidden');
            if (elements.themeToggleText) elements.themeToggleText.textContent = 'Dark';
        }
    }

    /**
     * Toggle Theme between Dark and Soft Blue Slate
     */
    function toggleTheme() {
        if (isTogglingTheme) return;
        isTogglingTheme = true;
        setTimeout(() => { isTogglingTheme = false; }, 150);

        const isCurrentlySoftBlue = document.documentElement.classList.contains('theme-soft-blue');
        const nextTheme = isCurrentlySoftBlue ? 'dark' : 'soft-blue';
        try {
            localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch (e) {
            console.error('Failed to save theme preference:', e);
        }
        applyTheme(nextTheme);
        showToast(nextTheme === 'soft-blue' ? 'Soft Blue Slate theme activated' : 'Dark Theme activated', 'info');
    }

    /**
     * Initialize Theme on page load (Default is strictly Dark)
     */
    function initTheme() {
        let savedTheme = 'dark';
        try {
            savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
            if (savedTheme === 'custom') {
                localStorage.removeItem(THEME_STORAGE_KEY);
                savedTheme = 'dark';
            }
        } catch (e) {
            savedTheme = 'dark';
        }
        applyTheme(savedTheme);
    }

    // Expose functions globally for immediate accessibility
    window.applyTheme = applyTheme;
    window.toggleTheme = toggleTheme;

    // DOM Elements Cache
    const elements = {
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        themeIconDark: document.getElementById('themeIconDark'),
        themeIconLight: document.getElementById('themeIconLight'),
        themeToggleText: document.getElementById('themeToggleText'),
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
        syncMetadataBtn: document.getElementById('syncMetadataBtn'),
        syncMetadataIcon: document.getElementById('syncMetadataIcon'),
        syncMetadataText: document.getElementById('syncMetadataText'),
        syncMetadataBadge: document.getElementById('syncMetadataBadge'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),
        toastContainer: document.getElementById('toastContainer'),
        repoModal: document.getElementById('repoModal'),
        modalBackdrop: document.getElementById('modalBackdrop'),
        modalContent: document.getElementById('modalContent'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        // Edit Live App URL Modal
        liveUrlModal: document.getElementById('liveUrlModal'),
        liveUrlModalBackdrop: document.getElementById('liveUrlModalBackdrop'),
        liveUrlModalRepoName: document.getElementById('liveUrlModalRepoName'),
        closeLiveUrlModalBtn: document.getElementById('closeLiveUrlModalBtn'),
        liveUrlForm: document.getElementById('liveUrlForm'),
        liveUrlInput: document.getElementById('liveUrlInput'),
        liveUrlDefaultValue: document.getElementById('liveUrlDefaultValue'),
        resetLiveUrlBtn: document.getElementById('resetLiveUrlBtn'),
        cancelLiveUrlBtn: document.getElementById('cancelLiveUrlBtn'),
        saveLiveUrlBtn: document.getElementById('saveLiveUrlBtn'),
        // Edit Deployed Branch Modal
        branchModal: document.getElementById('branchModal'),
        branchModalBackdrop: document.getElementById('branchModalBackdrop'),
        branchModalRepoName: document.getElementById('branchModalRepoName'),
        closeBranchModalBtn: document.getElementById('closeBranchModalBtn'),
        branchForm: document.getElementById('branchForm'),
        branchInput: document.getElementById('branchInput'),
        branchQuickPills: document.getElementById('branchQuickPills'),
        branchDefaultValue: document.getElementById('branchDefaultValue'),
        resetBranchBtn: document.getElementById('resetBranchBtn'),
        cancelBranchBtn: document.getElementById('cancelBranchBtn'),
        saveBranchBtn: document.getElementById('saveBranchBtn'),
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
        // Work Notes Drawer elements
        notesToggleBtn: document.getElementById('notesToggleBtn'),
        notesIndicator: document.getElementById('notesIndicator'),
        notesDrawer: document.getElementById('notesDrawer'),
        notesDrawerBackdrop: document.getElementById('notesDrawerBackdrop'),
        notesDrawerPanel: document.getElementById('notesDrawerPanel'),
        closeNotesDrawerBtn: document.getElementById('closeNotesDrawerBtn'),
        notesCompletedText: document.getElementById('notesCompletedText'),
        notesNextStepsText: document.getElementById('notesNextStepsText'),
        notesCompletedCount: document.getElementById('notesCompletedCount'),
        notesNextStepsCount: document.getElementById('notesNextStepsCount'),
        notesAutoSaveStatus: document.getElementById('notesAutoSaveStatus'),
        copyAllNotesBtn: document.getElementById('copyAllNotesBtn'),
        clearNotesBtn: document.getElementById('clearNotesBtn'),
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

            // Synchronize and hydrate metadata from server and localStorage
            hydrateMetadata(data.metadata || {});

            // Synchronize inspections from local cache & API responses
            const localInspections = getCachedInspections();
            state.inspections = { ...localInspections };

            state.repositories.forEach(repo => {
                if (repo.inspection) {
                    state.inspections[repo.name] = repo.inspection;
                }
            });
            saveCachedInspections();

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
                const promptTool = (getRepoPromptTool(repo) || '').toLowerCase();
                const dbTracker = (getRepoDbTracker(repo) || '').toLowerCase();
                const authStatus = (getRepoAuthStatus(repo) || '').toLowerCase();
                const inspection = state.inspections[repo.name] || repo.inspection;
                const techStack = (inspection && inspection.tech_stack && inspection.tech_stack.name ? inspection.tech_stack.name : '').toLowerCase();
                const dbInfo = (inspection && inspection.database && inspection.database.detected ? (inspection.database.type + ' ' + (inspection.database.evidence || '')) : '').toLowerCase();
                const authInfo = (inspection && inspection.auth && inspection.auth.detected ? ('auth login authentication ' + (inspection.auth.evidence || '')) : '').toLowerCase();
                const depBranch = (getRepoDeployedBranch(repo) || '').toLowerCase();
                const actBranch = (getRepoLatestActiveBranch(repo) || '').toLowerCase();

                return name.includes(q) || desc.includes(q) || lang.includes(q) || topics.includes(q) || aiTool.includes(q) || promptTool.includes(q) || dbTracker.includes(q) || authStatus.includes(q) || techStack.includes(q) || dbInfo.includes(q) || authInfo.includes(q) || depBranch.includes(q) || actBranch.includes(q);
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

            const liveInfo = getRepoEffectiveLiveUrl(repo);
            const liveUrl = liveInfo.url;
            const liveSiteBadge = liveUrl
                ? `<a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer" 
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${liveInfo.isCustom ? 'bg-[#1f6feb]/20 hover:bg-[#1f6feb]/35 text-[#58a6ff] border border-[#388bfd]/50' : 'bg-[#238636]/20 hover:bg-[#238636]/35 text-[#3fb950] border border-[#238636]/50'} transition shadow-sm"
                      title="${liveInfo.isCustom ? 'Open custom live website: ' : 'Open live website: '}${escapeHtml(liveUrl)}">
                     <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                     <span>Live App</span>
                     ${liveInfo.isCustom ? '<span class="text-[9px] bg-[#388bfd]/25 text-[#58a6ff] border border-[#388bfd]/40 rounded px-1 ml-0.5">Custom</span>' : ''}
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

                    <!-- Architecture Detection: Tech Stack, Database, Login / Auth -->
                    <div class="p-2.5 bg-[#0d1117] rounded-lg border border-[#21262d] space-y-2 text-xs" data-card-arch="${escapeHtml(repo.name)}">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[#8b949e] font-medium flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                                <span>Tech Stack:</span>
                            </span>
                            <div data-card-tech="${escapeHtml(repo.name)}">${renderTechStackCell(repo)}</div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#21262d]">
                            <div class="flex items-center justify-between gap-1">
                                <span class="text-[#8b949e] font-medium">DB:</span>
                                <div data-card-db="${escapeHtml(repo.name)}">${renderDatabaseCell(repo)}</div>
                            </div>
                            <div class="flex items-center justify-between gap-1">
                                <span class="text-[#8b949e] font-medium">Auth:</span>
                                <div data-card-auth="${escapeHtml(repo.name)}">${renderAuthCell(repo)}</div>
                            </div>
                    </div>

                    <!-- Branch Tracking: Deployed Branch & Latest Active Branch -->
                    <div class="grid grid-cols-2 gap-2 p-2 bg-[#0d1117] rounded-lg border border-[#21262d] text-xs">
                        <div class="flex flex-col gap-1 min-w-0">
                            <span class="text-[#8b949e] font-medium text-[11px] flex items-center gap-1">
                                <svg class="w-3 h-3 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                <span>Deployed:</span>
                            </span>
                            <div data-cell-dep-branch="${escapeHtml(repo.name)}">${renderDeployedBranchCell(repo)}</div>
                        </div>
                        <div class="flex flex-col gap-1 min-w-0">
                            <span class="text-[#8b949e] font-medium text-[11px] flex items-center gap-1">
                                <svg class="w-3 h-3 text-[#3fb950]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                <span>Recent:</span>
                            </span>
                            <div data-cell-act-branch="${escapeHtml(repo.name)}">${renderLatestActiveBranchCell(repo)}</div>
                        </div>
                    </div>

                    <!-- AI Dev & Prompt Explainer Selectors in Card -->
                    <div class="space-y-2 pt-1">
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-[#8b949e] font-medium flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                <span>AI Dev / Tool:</span>
                            </span>
                            ${buildAiSelectHtml(repo)}
                        </div>
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-[#8b949e] font-medium flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5 text-[#a371f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                                <span>Prompt / Explainer:</span>
                            </span>
                            ${buildPromptSelectHtml(repo)}
                        </div>
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
                               class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold ${liveInfo.isCustom ? 'bg-[#1f6feb]/20 hover:bg-[#1f6feb]/35 text-[#58a6ff] border border-[#388bfd]/50' : 'bg-[#238636]/20 hover:bg-[#238636]/35 text-[#3fb950] border border-[#238636]/50'} transition active:scale-95" 
                               title="${liveInfo.isCustom ? 'Visit App (Custom Override): ' : 'Visit App: '}${escapeHtml(liveUrl)}">
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
                    ${renderLiveAppCell(repo)}
                </td>

                <!-- Deployed Branch Column -->
                <td class="py-3 px-4 whitespace-nowrap" data-cell-dep-branch="${escapeHtml(repo.name)}">
                    ${renderDeployedBranchCell(repo)}
                </td>

                <!-- Latest Active Branch Column -->
                <td class="py-3 px-4 whitespace-nowrap" data-cell-act-branch="${escapeHtml(repo.name)}">
                    ${renderLatestActiveBranchCell(repo)}
                </td>

                <!-- Tech Stack Column -->
                <td class="py-3 px-4 whitespace-nowrap" data-cell-tech="${escapeHtml(repo.name)}">
                    ${renderTechStackCell(repo)}
                </td>

                <!-- Database Column -->
                <td class="py-3 px-4 whitespace-nowrap" data-cell-db="${escapeHtml(repo.name)}">
                    ${renderDatabaseCell(repo)}
                </td>

                <!-- Login / Auth Column -->
                <td class="py-3 px-4 whitespace-nowrap" data-cell-auth="${escapeHtml(repo.name)}">
                    ${renderAuthCell(repo)}
                </td>

                <!-- AI Dev / Tool Column -->
                <td class="py-3 px-4 whitespace-nowrap">
                    ${buildAiSelectHtml(repo)}
                </td>

                <!-- Prompt / Explainer Column -->
                <td class="py-3 px-4 whitespace-nowrap">
                    ${buildPromptSelectHtml(repo)}
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
            <table class="w-full text-left border-collapse min-w-[1720px]">
                <thead>
                    <tr class="bg-[#161b22] border-b border-[#30363d] text-xs font-semibold text-[#8b949e]">
                        <th class="py-3 px-4">Repository</th>
                        <th class="py-3 px-4">Language</th>
                        <th class="py-3 px-4">Live App</th>
                        <th class="py-3 px-4">Deployed Branch</th>
                        <th class="py-3 px-4">Recent Branch</th>
                        <th class="py-3 px-4">Tech Stack</th>
                        <th class="py-3 px-4">Database</th>
                        <th class="py-3 px-4">Auth / Login</th>
                        <th class="py-3 px-4">AI Dev / Tool</th>
                        <th class="py-3 px-4">Prompt / Explainer</th>
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
        const liveInfo = getRepoEffectiveLiveUrl(repo);
        const liveUrl = liveInfo.url;

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
                           class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${liveInfo.isCustom ? 'bg-[#1f6feb]/25 hover:bg-[#1f6feb]/40 text-[#58a6ff] border border-[#388bfd]/50' : 'bg-[#238636]/25 hover:bg-[#238636]/40 text-[#3fb950] border border-[#238636]/50'} transition shadow-sm" 
                           title="${liveInfo.isCustom ? 'Visit App (Custom Override): ' : 'Visit App: '}${escapeHtml(liveUrl)}">
                            <span>Visit App</span>
                            <span class="text-[11px] leading-none">&nearr;</span>
                            ${liveInfo.isCustom ? '<span class="text-[9px] bg-[#388bfd]/25 text-[#58a6ff] border border-[#388bfd]/40 rounded px-1 ml-0.5">Custom</span>' : ''}
                        </a>
                    ` : ''}
                    <button onclick="window.editLiveUrl('${escapeHtml(repo.name)}', ${repo.id})" 
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border border-[#30363d] hover:border-[#58a6ff] transition"
                            title="Edit / Override Live App URL">
                        <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        <span>Edit Live URL</span>
                    </button>
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

            <!-- Architecture Detection: Tech Stack, Database, Login / Auth -->
            <div class="py-4 border-b border-[#30363d]">
                <h4 class="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Architecture & Feature Detection</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] flex items-center justify-between">
                        <span class="text-xs text-[#8b949e] font-medium">Tech Stack:</span>
                        <div>${renderTechStackCell(repo)}</div>
                    </div>
                    <div class="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] flex items-center justify-between">
                        <span class="text-xs text-[#8b949e] font-medium">Database:</span>
                        <div>${renderDatabaseCell(repo)}</div>
                    </div>
                    <div class="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] flex items-center justify-between">
                        <span class="text-xs text-[#8b949e] font-medium">Login / Auth:</span>
                        <div>${renderAuthCell(repo)}</div>
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
            <div class="pt-4 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs text-[#8b949e]">
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
                    <span class="block">Prompt / Explainer</span>
                    <div class="mt-1">${buildPromptSelectHtml(repo)}</div>
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

        // Save Changes / Sync Metadata Button
        if (elements.syncMetadataBtn) {
            elements.syncMetadataBtn.addEventListener('click', () => {
                syncAllMetadataToServer(true);
            });
        }

        // Retry Button on error
        elements.retryBtn.addEventListener('click', () => {
            fetchRepositories(true);
        });

        // Modal close
        elements.closeModalBtn.addEventListener('click', closeRepoModal);
        elements.modalBackdrop.addEventListener('click', closeRepoModal);

        // Live URL Modal events
        if (elements.closeLiveUrlModalBtn) {
            elements.closeLiveUrlModalBtn.addEventListener('click', closeLiveUrlModal);
        }
        if (elements.cancelLiveUrlBtn) {
            elements.cancelLiveUrlBtn.addEventListener('click', closeLiveUrlModal);
        }
        if (elements.liveUrlModalBackdrop) {
            elements.liveUrlModalBackdrop.addEventListener('click', closeLiveUrlModal);
        }
        if (elements.liveUrlForm) {
            elements.liveUrlForm.addEventListener('submit', handleLiveUrlFormSubmit);
        }
        if (elements.resetLiveUrlBtn) {
            elements.resetLiveUrlBtn.addEventListener('click', handleResetLiveUrl);
        }

        // Deployed Branch Modal events
        if (elements.closeBranchModalBtn) {
            elements.closeBranchModalBtn.addEventListener('click', closeBranchModal);
        }
        if (elements.cancelBranchBtn) {
            elements.cancelBranchBtn.addEventListener('click', closeBranchModal);
        }
        if (elements.branchModalBackdrop) {
            elements.branchModalBackdrop.addEventListener('click', closeBranchModal);
        }
        if (elements.branchForm) {
            elements.branchForm.addEventListener('submit', handleBranchFormSubmit);
        }
        if (elements.resetBranchBtn) {
            elements.resetBranchBtn.addEventListener('click', handleResetBranch);
        }

        // Work Notes Drawer events
        if (elements.notesToggleBtn) {
            elements.notesToggleBtn.addEventListener('click', openNotesDrawer);
        }
        if (elements.closeNotesDrawerBtn) {
            elements.closeNotesDrawerBtn.addEventListener('click', closeNotesDrawer);
        }
        if (elements.notesDrawerBackdrop) {
            elements.notesDrawerBackdrop.addEventListener('click', closeNotesDrawer);
        }
        if (elements.notesCompletedText) {
            elements.notesCompletedText.addEventListener('input', handleNotesInput);
        }
        if (elements.notesNextStepsText) {
            elements.notesNextStepsText.addEventListener('input', handleNotesInput);
        }
        if (elements.copyAllNotesBtn) {
            elements.copyAllNotesBtn.addEventListener('click', copyFormattedNotes);
        }
        if (elements.clearNotesBtn) {
            elements.clearNotesBtn.addEventListener('click', clearAllNotes);
        }

        // Soft Blue Slate / Dark Theme toggle (only bind if not already handled by inline onclick)
        if (elements.themeToggleBtn && !elements.themeToggleBtn.getAttribute('onclick')) {
            elements.themeToggleBtn.addEventListener('click', toggleTheme);
        }

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+S / Cmd+S to Save Changes
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                syncAllMetadataToServer(true);
                return;
            }

            // Esc to close notes drawer or modal
            if (e.key === 'Escape') {
                if (elements.branchModal && !elements.branchModal.classList.contains('hidden')) {
                    closeBranchModal();
                    return;
                }
                if (elements.liveUrlModal && !elements.liveUrlModal.classList.contains('hidden')) {
                    closeLiveUrlModal();
                    return;
                }
                if (elements.notesDrawer && !elements.notesDrawer.classList.contains('invisible')) {
                    closeNotesDrawer();
                    return;
                }
                if (elements.repoModal && !elements.repoModal.classList.contains('hidden')) {
                    closeRepoModal();
                    return;
                }
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

    window.setRepoPromptTool = function (name, val, id) {
        setRepoPromptTool(name, val, id);
    };

    window.setRepoDbTracker = function (name, val, id) {
        setRepoDbTracker(name, val, id);
    };

    window.toggleRepoAuthStatus = function (name, id) {
        toggleRepoAuthStatus(name, id);
    };

    window.toggleTheme = function () {
        toggleTheme();
    };

    window.openNotesDrawer = function () {
        openNotesDrawer();
    };

    window.closeNotesDrawer = function () {
        closeNotesDrawer();
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

    window.editLiveUrl = function (repoName, repoId) {
        openLiveUrlModal(repoName, repoId);
    };

    window.handleDeployedBranchSelectChange = function (name, val, id) {
        handleDeployedBranchSelectChange(name, val, id);
    };

    window.editDeployedBranch = function (name, id) {
        openBranchModal(name, id);
    };

    window.selectBranchPill = function (branch) {
        selectBranchPill(branch);
    };

    window.syncAllMetadata = function () {
        syncAllMetadataToServer(true);
    };

    window.saveChanges = function () {
        syncAllMetadataToServer(true);
    };

    // Initialize application
    function init() {
        initTheme();
        loadLocalMetadata();
        setupEventListeners();
        loadNotes();
        fetchRepositories(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
