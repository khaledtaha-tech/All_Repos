<?php
/**
 * All Repos - GitHub Repositories Manager & Explorer
 * Target: https://github.com/khaledtaha-tech/All_Repos
 *
 * Frontend Dashboard UI built with PHP, HTML5, Vanilla JavaScript, and Tailwind CSS.
 * Strictly in English. No external build step required.
 */
?>
<!DOCTYPE html>
<html lang="en" class="h-full bg-[#0d1117] text-[#e6edf3]">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All Repos - GitHub Repositories Manager & Explorer</title>
    <meta name="description" content="Explore, sort, filter, and manage all your GitHub public and private repositories with modification chronology and clipboard utilities.">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22><rect width=%2216%22 height=%2216%22 rx=%224%22 fill=%22%23238636%22/><path d=%22M3 5h10M3 8h10M3 11h10%22 stroke=%22white%22 stroke-width=%221.5%22 stroke-linecap=%22round%22/></svg>">
    
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        gh: {
                            bg: '#0d1117',
                            surface: '#161b22',
                            border: '#30363d',
                            borderMuted: '#21262d',
                            text: '#e6edf3',
                            muted: '#8b949e',
                            blue: '#58a6ff',
                            green: '#238636',
                            greenHover: '#2ea043',
                            greenText: '#3fb950',
                            purple: '#a371f7',
                            purpleBg: '#382352',
                            gold: '#d29922',
                            danger: '#f85149',
                            dangerBg: '#3d1a1f'
                        }
                    }
                }
            }
        };
    </script>
    <!-- Immediate Theme Application to prevent FOUC -->
    <script>
        (function() {
            try {
                if (localStorage.getItem('all_repos_theme') === 'soft-blue') {
                    document.documentElement.classList.add('theme-soft-blue');
                }
            } catch (e) {}
        })();
    </script>
    <style>
        /* Custom scrollbar matching GitHub dark mode */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #0d1117;
        }
        ::-webkit-scrollbar-thumb {
            background: #30363d;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #484f58;
        }
        /* Skeleton pulse animation */
        @keyframes skeletonPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.25; }
        }
        .skeleton {
            animation: skeletonPulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* ==========================================================================
           Soft Blue / Slate Theme (Minimalist Dashboard Style)
           Palette:
             - Background: #F0F4F8 / #E8EEF5
             - Cards/Surface: #DFE8F2 / #D5E2F0
             - Borders: #BDCFE2
             - Text: #1E293B
             - Accents: #2563EB / #3B82F6
           ========================================================================== */
        html.theme-soft-blue,
        html.theme-soft-blue body {
            background-color: #F0F4F8 !important;
            color: #1E293B !important;
        }

        html.theme-soft-blue header,
        html.theme-soft-blue footer,
        html.theme-soft-blue #notesDrawerPanel,
        html.theme-soft-blue #repoModal > div > div,
        html.theme-soft-blue .bg-\[\#161b22\] {
            background-color: #DFE8F2 !important;
            border-color: #BDCFE2 !important;
            color: #1E293B !important;
        }

        html.theme-soft-blue .bg-\[\#0d1117\] {
            background-color: #E8EEF5 !important;
            border-color: #BDCFE2 !important;
            color: #1E293B !important;
        }

        html.theme-soft-blue .bg-\[\#21262d\] {
            background-color: #D5E2F0 !important;
            border-color: #BDCFE2 !important;
            color: #1E293B !important;
        }

        html.theme-soft-blue .hover\:bg-\[\#30363d\]:hover,
        html.theme-soft-blue .hover\:bg-\[\#21262d\]:hover {
            background-color: #C5D5E8 !important;
            color: #0F172A !important;
        }

        html.theme-soft-blue .hover\:bg-\[\#161b22\]\/70:hover {
            background-color: rgba(213, 226, 240, 0.7) !important;
        }

        html.theme-soft-blue .border-\[\#30363d\],
        html.theme-soft-blue .border-\[\#21262d\],
        html.theme-soft-blue tr.border-b {
            border-color: #BDCFE2 !important;
        }

        html.theme-soft-blue .text-\[\#e6edf3\],
        html.theme-soft-blue .text-white {
            color: #1E293B !important;
        }

        html.theme-soft-blue .text-\[\#c9d1d9\] {
            color: #334155 !important;
        }

        html.theme-soft-blue .text-\[\#8b949e\] {
            color: #64748B !important;
        }

        html.theme-soft-blue .text-\[\#6e7681\] {
            color: #94A3B8 !important;
        }

        html.theme-soft-blue .text-\[\#58a6ff\] {
            color: #2563EB !important;
        }

        html.theme-soft-blue .hover\:text-\[\#58a6ff\]:hover {
            color: #1D4ED8 !important;
        }

        html.theme-soft-blue .text-\[\#79c0ff\] {
            color: #2563EB !important;
        }

        html.theme-soft-blue .border-\[\#58a6ff\],
        html.theme-soft-blue .hover\:border-\[\#58a6ff\]:hover,
        html.theme-soft-blue .hover\:border-\[\#58a6ff\]\/50:hover,
        html.theme-soft-blue .hover\:border-\[\#58a6ff\]\/40:hover {
            border-color: #3B82F6 !important;
        }

        html.theme-soft-blue input,
        html.theme-soft-blue textarea,
        html.theme-soft-blue select {
            background-color: #E8EEF5 !important;
            border-color: #BDCFE2 !important;
            color: #1E293B !important;
        }

        html.theme-soft-blue input::placeholder,
        html.theme-soft-blue textarea::placeholder {
            color: #94A3B8 !important;
        }

        html.theme-soft-blue option {
            background-color: #DFE8F2 !important;
            color: #1E293B !important;
        }

        html.theme-soft-blue .bg-\[\#1b2533\] {
            background-color: #DBEAFE !important;
            border-color: #BFDBFE !important;
            color: #1D4ED8 !important;
        }

        html.theme-soft-blue .bg-\[\#382352\] {
            background-color: #F3E8FF !important;
            border-color: #E9D5FF !important;
            color: #7E22CE !important;
        }

        html.theme-soft-blue .bg-\[\#1f2937\] {
            background-color: #E2E8F0 !important;
            color: #2563EB !important;
        }

        html.theme-soft-blue .hover\:bg-\[\#2d3748\]:hover {
            background-color: #CBD5E1 !important;
        }

        html.theme-soft-blue #notesDrawerBackdrop {
            background-color: rgba(15, 23, 42, 0.4) !important;
        }

        html.theme-soft-blue #repoModal {
            background-color: rgba(15, 23, 42, 0.5) !important;
        }

        html.theme-soft-blue ::-webkit-scrollbar-track {
            background: #F0F4F8;
        }

        html.theme-soft-blue ::-webkit-scrollbar-thumb {
            background: #BDCFE2;
        }

        html.theme-soft-blue ::-webkit-scrollbar-thumb:hover {
            background: #94A3B8;
        }
    </style>
</head>
<body class="h-full flex flex-col font-sans antialiased selection:bg-[#58a6ff]/30 selection:text-white">

    <!-- Toast Notification Container -->
    <div id="toastContainer" class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm"></div>

    <!-- Top Navigation Bar -->
    <header class="bg-[#161b22] border-b border-[#30363d] sticky top-0 z-30 shadow-md">
        <div class="w-full max-w-[99%] mx-auto px-3 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
            
            <!-- Branding -->
            <div class="flex items-center gap-3">
                <a href="index.php" class="flex items-center gap-2.5 text-white hover:text-[#58a6ff] transition group">
                    <svg class="w-8 h-8 fill-current text-white group-hover:text-[#58a6ff] transition" viewBox="0 0 16 16">
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
                    </svg>
                    <div>
                        <span class="font-bold text-lg text-[#e6edf3] tracking-tight block leading-none">All Repos</span>
                        <span class="text-[11px] text-[#8b949e] font-mono leading-tight">GitHub Explorer</span>
                    </div>
                </a>
                <span class="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                    v1.0.0
                </span>
            </div>

            <!-- Header Right Controls -->
            <div class="flex items-center gap-3">
                <!-- Rate Limit Status Chip -->
                <div id="rateLimitChip" class="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-[#21262d] border border-[#30363d] text-[#8b949e]" title="API Rate Limit">
                    <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    <span id="rateLimitText">Loading API quota...</span>
                </div>

                <!-- Last updated / sync info -->
                <span id="lastUpdatedText" class="hidden lg:inline-block text-xs text-[#8b949e] font-mono"></span>

                <!-- Refresh / Sync Button -->
                <button id="refreshBtn" 
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] hover:text-white border border-[#30363d] transition active:scale-95 shadow-sm"
                        title="Force reload all repositories from GitHub API">
                    <svg id="refreshIcon" class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span class="hidden sm:inline">Refresh</span>
                </button>

                <!-- Soft Blue Slate / Dark Theme Toggle Button -->
                <button id="themeToggleBtn" 
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] hover:text-white border border-[#30363d] hover:border-[#58a6ff]/60 transition active:scale-95 shadow-sm"
                        title="Toggle between Dark Theme and Soft Blue Slate Theme"
                        aria-label="Toggle Theme">
                    <svg id="themeIconDark" class="w-3.5 h-3.5 text-[#e3b341] hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    <svg id="themeIconLight" class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                    <span id="themeToggleText" class="hidden sm:inline">Theme</span>
                </button>

                <!-- Work Notes & Progress Drawer Trigger -->
                <button id="notesToggleBtn" 
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] hover:text-white border border-[#30363d] hover:border-[#e3b341]/60 transition active:scale-95 shadow-sm relative"
                        title="Open Work Notes & Progress panel">
                    <svg class="w-3.5 h-3.5 text-[#e3b341]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    <span class="hidden sm:inline">Notes</span>
                    <span id="notesIndicator" class="hidden w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" title="Notes present"></span>
                </button>

                <!-- User Profile Container -->
                <div id="userProfileContainer"></div>

                <!-- GitHub Repo Link -->
                <a href="https://github.com/khaledtaha-tech/All_Repos" target="_blank" rel="noopener noreferrer" 
                   class="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#21262d] transition"
                   title="View Source on GitHub">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>
                    <span>Repository</span>
                </a>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 w-full max-w-[99%] mx-auto px-3 sm:px-4 lg:px-6 py-6 space-y-6">

        <!-- Error Banner (Hidden by default) -->
        <div id="errorBanner" class="hidden bg-[#3d1a1f] border border-[#f85149] rounded-xl p-5 shadow-lg">
            <div class="flex items-start gap-3">
                <svg class="w-6 h-6 text-[#f85149] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <div class="flex-1">
                    <h3 class="text-base font-bold text-white">Connection Error</h3>
                    <p id="errorMessage" class="text-sm text-[#f85149] mt-1"></p>
                    <div id="errorHelp"></div>
                    <div class="mt-4">
                        <button id="retryBtn" class="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg text-xs font-semibold shadow transition">
                            Retry Connection
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Statistics Summary Cards -->
        <section aria-label="Account Overview" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <!-- Total Repos -->
            <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-[#8b949e] font-medium flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                    Total
                </span>
                <span id="statTotalRepos" class="text-2xl font-bold text-white mt-1">--</span>
            </div>

            <!-- Visible Repos -->
            <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-[#8b949e] font-medium flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-[#3fb950]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    Showing
                </span>
                <span id="statShowingRepos" class="text-2xl font-bold text-[#3fb950] mt-1">--</span>
            </div>

            <!-- Public Repos -->
            <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-[#8b949e] font-medium flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-[#79c0ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Public
                </span>
                <span id="statPublicRepos" class="text-2xl font-bold text-white mt-1">--</span>
            </div>

            <!-- Private Repos -->
            <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-[#8b949e] font-medium flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-[#d2a8ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Private
                </span>
                <span id="statPrivateRepos" class="text-2xl font-bold text-[#d2a8ff] mt-1">--</span>
            </div>

            <!-- Total Stars -->
            <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-[#8b949e] font-medium flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-[#e3b341]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    Stars
                </span>
                <span id="statTotalStars" class="text-2xl font-bold text-white mt-1">--</span>
            </div>

            <!-- Total Forks -->
            <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 flex flex-col justify-between">
                <span class="text-xs text-[#8b949e] font-medium flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-[#8b949e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                    Forks
                </span>
                <span id="statTotalForks" class="text-2xl font-bold text-white mt-1">--</span>
            </div>
        </section>

        <!-- Controls, Filters, Search & Clipboard Utilities -->
        <section aria-label="Toolbar & Filters" class="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm space-y-4">
            
            <!-- Row 1: Search Bar & Batch Clipboard Actions -->
            <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                
                <!-- Live Search Bar -->
                <div class="relative flex-1">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8b949e]">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <input type="text" 
                           id="searchInput" 
                           placeholder="Search repositories by name, language, or description... (Press '/' to focus)" 
                           autocomplete="off"
                           class="w-full pl-10 pr-10 py-2 bg-[#0d1117] border border-[#30363d] focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-lg text-sm text-[#e6edf3] placeholder-[#8b949e] outline-none transition">
                    <button id="clearSearchBtn" 
                            class="hidden absolute inset-y-0 right-0 pr-3 flex items-center text-[#8b949e] hover:text-white"
                            title="Clear search">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <!-- Batch Clipboard Utilities -->
                <div class="flex items-center gap-2 flex-wrap">
                    
                    <!-- Copy All Visible Names Button -->
                    <button id="copyAllNamesBtn" 
                            class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#238636] hover:bg-[#2ea043] text-white border border-[#2ea043] transition active:scale-95 shadow-sm"
                            title="Copy names of all repositories currently matching your search and filters to clipboard">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        <span>Copy All Visible Names</span>
                    </button>

                    <!-- Batch Dropdown Menu for Clone URLs -->
                    <div class="relative inline-block text-left">
                        <button id="batchMenuBtn" 
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] hover:text-white border border-[#30363d] transition">
                            <span>More Batch Copies</span>
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </button>
                        <div id="batchMenuDropdown" class="hidden absolute right-0 mt-1.5 w-56 rounded-lg bg-[#161b22] border border-[#30363d] shadow-xl z-20 py-1 text-xs">
                            <button onclick="window.copyAllVisibleRepoLinks()" class="w-full text-left px-4 py-2.5 text-[#e6edf3] hover:bg-[#21262d] flex items-center gap-2">
                                <svg class="w-4 h-4 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                <span>Copy All GitHub URLs</span>
                            </button>
                            <button onclick="window.copyAllVisibleHttps()" class="w-full text-left px-4 py-2.5 text-[#e6edf3] hover:bg-[#21262d] flex items-center gap-2 border-t border-[#21262d]">
                                <svg class="w-4 h-4 text-[#3fb950]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                <span>Copy All HTTPS Clone URLs</span>
                            </button>
                            <button onclick="window.copyAllVisibleSsh()" class="w-full text-left px-4 py-2.5 text-[#e6edf3] hover:bg-[#21262d] flex items-center gap-2 border-t border-[#21262d]">
                                <svg class="w-4 h-4 text-[#a371f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                                <span>Copy All SSH Clone URLs</span>
                            </button>
                        </div>
                    </div>

                    <!-- View Switcher (Grid vs List) -->
                    <div class="flex items-center bg-[#0d1117] border border-[#30363d] rounded-lg p-0.5">
                        <button id="viewModeGrid" class="p-1.5 rounded-md text-[#8b949e] hover:text-white transition" title="Grid View">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                        </button>
                        <button id="viewModeList" class="p-1.5 rounded-md bg-[#30363d] text-white transition" title="Compact Table View">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Row 2: Visibility Filters, Language Selector, and Dynamic Sorting -->
            <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-[#21262d]">
                
                <!-- Visibility Filter Segmented Control -->
                <div class="flex items-center gap-1.5 flex-wrap" id="visibilityFilterGroup">
                    <span class="text-xs text-[#8b949e] font-medium mr-1">Type:</span>
                    <button data-filter="all" class="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#238636] text-white border border-[#2ea043] shadow-sm transition">All</button>
                    <button data-filter="public" class="px-3 py-1.5 rounded-md text-xs font-medium bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] hover:text-white border border-[#30363d] transition">Public</button>
                    <button data-filter="private" class="px-3 py-1.5 rounded-md text-xs font-medium bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] hover:text-white border border-[#30363d] transition">Private</button>
                    <button data-filter="sources" class="px-3 py-1.5 rounded-md text-xs font-medium bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] hover:text-white border border-[#30363d] transition">Sources Only</button>
                    <button data-filter="forks" class="px-3 py-1.5 rounded-md text-xs font-medium bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] hover:text-white border border-[#30363d] transition">Forks</button>
                </div>

                <!-- Secondary Filters: Language and Dynamic Sorting -->
                <div class="flex items-center gap-2 flex-wrap">
                    
                    <!-- Language Filter Dropdown -->
                    <div class="flex items-center gap-1.5">
                        <label for="languageSelect" class="text-xs text-[#8b949e]">Language:</label>
                        <select id="languageSelect" class="bg-[#0d1117] border border-[#30363d] text-xs text-[#e6edf3] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#58a6ff]">
                            <option value="all">All Languages</option>
                        </select>
                    </div>

                    <!-- Dynamic Sorting Controls -->
                    <div class="flex items-center gap-1.5">
                        <label for="sortSelect" class="text-xs text-[#8b949e]">Sort by:</label>
                        <select id="sortSelect" class="bg-[#0d1117] border border-[#30363d] text-xs text-[#e6edf3] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#58a6ff]">
                            <option value="updated_desc">Recently Updated (Newest first)</option>
                            <option value="updated_asc">Least Recently Updated (Oldest first)</option>
                            <option value="pushed_desc">Recently Pushed (Newest commit)</option>
                            <option value="pushed_asc">Least Recently Pushed (Oldest commit)</option>
                            <option value="created_desc">Recently Created</option>
                            <option value="created_asc">Oldest Created</option>
                            <option value="name_asc">Repository Name (A &rarr; Z)</option>
                            <option value="name_desc">Repository Name (Z &rarr; A)</option>
                            <option value="stars_desc">Most Stars</option>
                            <option value="size_desc">Largest Disk Size</option>
                        </select>
                    </div>
                </div>
            </div>
        </section>

        <!-- Loading State Skeleton -->
        <section id="loadingState" class="space-y-4">
            <div class="text-center py-6">
                <svg class="animate-spin w-8 h-8 text-[#58a6ff] mx-auto mb-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p class="text-sm text-[#8b949e]">Connecting to GitHub API and loading all repositories...</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <?php for ($i = 0; $i < 6; $i++): ?>
                <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5 space-y-4 skeleton">
                    <div class="flex items-center justify-between">
                        <div class="h-5 bg-[#30363d] rounded w-2/3"></div>
                        <div class="h-4 bg-[#30363d] rounded w-16"></div>
                    </div>
                    <div class="h-4 bg-[#21262d] rounded w-full"></div>
                    <div class="h-4 bg-[#21262d] rounded w-4/5"></div>
                    <div class="h-10 bg-[#0d1117] rounded-lg"></div>
                    <div class="flex justify-between items-center pt-2">
                        <div class="h-3 bg-[#30363d] rounded w-24"></div>
                        <div class="h-6 bg-[#21262d] rounded w-20"></div>
                    </div>
                </div>
                <?php endfor; ?>
            </div>
        </section>

        <!-- Main Content Area -->
        <div id="mainContent" class="space-y-4 transition-opacity duration-300">
            
            <!-- Grid View Container -->
            <div id="repoGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>

            <!-- List View Container (Hidden by default) -->
            <div id="repoList" class="hidden"></div>

            <!-- Empty Search Results State -->
            <div id="emptyState" class="hidden text-center py-16 bg-[#161b22] border border-[#30363d] rounded-xl p-8">
                <svg class="w-12 h-12 text-[#8b949e] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <h3 class="text-base font-bold text-white">No repositories found</h3>
                <p class="text-xs text-[#8b949e] mt-1 max-w-sm mx-auto">No repositories match your active search keyword or filter settings.</p>
                <button id="resetFiltersBtn" class="mt-4 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg text-xs font-semibold border border-[#30363d] transition">
                    Reset All Filters
                </button>
            </div>
        </div>

    </main>

    <!-- Details Modal Dialog -->
    <div id="repoModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div id="modalBackdrop" class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"></div>
        <!-- Modal Card -->
        <div class="relative bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl max-w-2xl w-full p-6 z-10 max-h-[90vh] overflow-y-auto">
            <button id="closeModalBtn" class="absolute top-4 right-4 p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition" title="Close">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div id="modalContent"></div>
        </div>
    </div>

    <!-- Work Notes & Progress Side Drawer -->
    <div id="notesDrawer" class="fixed inset-0 z-50 pointer-events-none transition-visibility duration-300 invisible">
        <!-- Backdrop -->
        <div id="notesDrawerBackdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm opacity-0 transition-opacity duration-300 pointer-events-none"></div>

        <!-- Drawer Content Panel -->
        <div id="notesDrawerPanel" class="fixed inset-y-0 right-0 max-w-md w-full bg-[#161b22] border-l border-[#30363d] shadow-2xl flex flex-col transform translate-x-full transition-transform duration-300 ease-in-out pointer-events-auto">
            
            <!-- Drawer Header -->
            <div class="p-4 sm:p-5 border-b border-[#30363d] flex items-center justify-between gap-3 bg-[#161b22]">
                <div class="flex items-center gap-2.5">
                    <div class="p-2 rounded-lg bg-[#21262d] border border-[#30363d] text-[#e3b341]">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-white tracking-tight">Work Notes & Progress</h3>
                        <p class="text-[11px] text-[#8b949e]">Auto-saved to local browser storage</p>
                    </div>
                </div>
                <button id="closeNotesDrawerBtn" class="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition" title="Close drawer (Esc)">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Drawer Body (Scrollable) -->
            <div class="flex-1 p-4 sm:p-5 overflow-y-auto space-y-5">
                
                <!-- Section 1: What Was Done / Completed -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <label for="notesCompletedText" class="text-xs font-semibold text-[#3fb950] flex items-center gap-1.5 uppercase tracking-wider">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span>What Was Done / Completed</span>
                        </label>
                        <span id="notesCompletedCount" class="text-[11px] text-[#8b949e] font-mono">0 chars</span>
                    </div>
                    <textarea id="notesCompletedText" 
                              rows="6" 
                              placeholder="Record finished features, refactorings, resolved bugs, or deployed changes..."
                              class="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] rounded-xl p-3 text-xs text-[#e6edf3] placeholder-[#8b949e]/60 outline-none transition resize-y leading-relaxed font-sans"></textarea>
                </div>

                <!-- Section 2: In Progress / Next Steps -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <label for="notesNextStepsText" class="text-xs font-semibold text-[#58a6ff] flex items-center gap-1.5 uppercase tracking-wider">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                            <span>In Progress / Next Steps</span>
                        </label>
                        <span id="notesNextStepsCount" class="text-[11px] text-[#8b949e] font-mono">0 chars</span>
                    </div>
                    <textarea id="notesNextStepsText" 
                              rows="6" 
                              placeholder="Plan upcoming tasks, pending PRs, architectural ideas, or reminders..."
                              class="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] rounded-xl p-3 text-xs text-[#e6edf3] placeholder-[#8b949e]/60 outline-none transition resize-y leading-relaxed font-sans"></textarea>
                </div>

                <!-- Helpful Quick Tips Card -->
                <div class="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 text-xs text-[#8b949e] space-y-1">
                    <div class="text-[#c9d1d9] font-medium flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-[#e3b341]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span>Persistent Local Storage</span>
                    </div>
                    <p class="leading-relaxed text-[11px]">Notes persist across page refreshes and browser tabs in your local browser storage. No server transmission required.</p>
                </div>
            </div>

            <!-- Drawer Footer Actions -->
            <div class="p-4 sm:p-5 border-t border-[#30363d] bg-[#161b22] space-y-3">
                <div class="flex items-center justify-between text-[11px] text-[#8b949e]">
                    <span id="notesAutoSaveStatus" class="flex items-center gap-1.5 text-[#3fb950]">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#3fb950]"></span>
                        <span>Saved locally</span>
                    </span>
                    <button id="clearNotesBtn" class="text-[#f85149] hover:underline hover:text-[#ff7b72] transition" title="Clear all notes">Clear All</button>
                </div>
                <div class="flex items-center gap-2">
                    <button id="copyAllNotesBtn" class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-[#238636] hover:bg-[#2ea043] text-white shadow transition active:scale-95">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                        <span>Copy Formatted Notes</span>
                    </button>
                </div>
            </div>

        </div>
    </div>

    <!-- Footer -->
    <footer class="bg-[#161b22] border-t border-[#30363d] py-6 mt-12 text-center text-xs text-[#8b949e]">
        <div class="w-full max-w-[99%] mx-auto px-3 sm:px-4 lg:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>
                <strong>All Repos</strong> &mdash; GitHub Repositories Manager & Explorer. Built with PHP, HTML5, Vanilla JavaScript, and Tailwind CSS.
            </p>
            <div class="flex items-center gap-4">
                <a href="https://github.com/khaledtaha-tech/All_Repos" target="_blank" rel="noopener noreferrer" class="hover:text-[#58a6ff] transition">Repository</a>
                <span>&bull;</span>
                <a href="https://docs.github.com/en/rest" target="_blank" rel="noopener noreferrer" class="hover:text-[#58a6ff] transition">GitHub REST API</a>
            </div>
        </div>
    </footer>

    <!-- Vanilla JavaScript Application Logic -->
    <script src="assets/js/app.js"></script>

    <noscript>
        <div class="fixed inset-0 bg-[#0d1117] text-white flex items-center justify-center p-6 text-center z-50">
            <div class="max-w-md bg-[#161b22] border border-[#f85149] p-6 rounded-xl">
                <h2 class="text-lg font-bold text-[#f85149] mb-2">JavaScript Required</h2>
                <p class="text-xs text-[#8b949e]">All Repos requires JavaScript to communicate with the GitHub REST API and manage clipboard actions. Please enable JavaScript in your browser to proceed.</p>
            </div>
        </div>
    </noscript>
</body>
</html>
