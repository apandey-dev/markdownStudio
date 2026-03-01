/* ==========================================================================
   EDITOR CONTROLLER (Local-First Architecture & Zero Data Loss)
   Handles storage modes, parsing, scrolling, shortcuts, and custom syntax.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM ELEMENTS
    const editor = document.getElementById('markdown-input');
    const previewPanel = document.getElementById('preview-panel');
    const preview = document.getElementById('preview-output');
    const shareBtn = document.getElementById('btn-share');
    const btnConfirmPdf = document.getElementById('modal-confirm');
    const inputFilename = document.getElementById('pdf-filename');

    editor.disabled = true;

    // State Variables
    let notes = [];
    let activeNoteId = null;
    let noteToDeleteId = null;
    let highlightedNoteId = null;
    let appMode = 'local';
    let cloudSaveTimeout = null;

    const defaultWelcomeNote = `# Welcome to Markdown Studio 🖤\n\nYour premium workspace.\n\n## [ ✨ Features ]{#3b82f6}\n* **🖨️ Native PDF Export:** Click "Export" to perfectly scale vector PDFs.\n* **🎨 Custom Colors:** Use syntax \`[Text]{red}\` to add color.\n* **↔️ Alignment:** Type \`/center\`, \`/right\`, \`/left\` before any text!\n* **➖ Spaced Divider:** Type \`===\` on a new line for a wide-spaced horizontal rule.\n\n/center **This heading is perfectly centered!**\n\n===\n\n> Click **📂 Notes** to create a new one!`;

    // --- 1. SETUP & MODE SWITCHING ---

    function updatePillUI() {
        const isGithub = appMode === 'github';

        document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll(`[data-target="${appMode}"]`).forEach(tab => tab.classList.add('active'));

        const indicator = document.getElementById('active-mode-indicator');
        if (indicator) {
            indicator.innerHTML = isGithub ? `<i data-lucide="cloud" style="width:12px; height:12px;"></i> GitHub Cloud` : `<i data-lucide="hard-drive" style="width:12px; height:12px;"></i> Local Storage`;
        }

        const dashboardBadge = document.getElementById('dashboard-mode-badge');
        if (dashboardBadge) {
            if (isGithub) {
                dashboardBadge.innerHTML = '<i data-lucide="cloud" style="width: 12px; height: 12px;"></i> GITHUB CLOUD';
                dashboardBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                dashboardBadge.style.color = '#10b981';
                dashboardBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            } else {
                dashboardBadge.innerHTML = '<i data-lucide="hard-drive" style="width: 12px; height: 12px;"></i> LOCAL';
                dashboardBadge.style.backgroundColor = 'var(--shadow-color)';
                dashboardBadge.style.color = 'var(--text-color)';
                dashboardBadge.style.border = '1px solid var(--border-color)';
            }
        }

        const btnPush = document.getElementById('btn-push-github');
        if (btnPush) {
            if (!isGithub && localStorage.getItem('md_github_token') && notes.length > 0) {
                btnPush.style.display = 'flex';
            } else {
                btnPush.style.display = 'none';
            }
        }

        if (window.lucide) lucide.createIcons();
    }

    // ✨ LOCAL-FIRST GITHUB INITIALIZATION (Prevents Refresh Data Loss)
    async function initGitHubMode(token) {
        const localBackup = localStorage.getItem('md_studio_notes_github_backup');
        let hasLocalData = false;

        // 1. INSTANT LOAD: Load local unsynced edits immediately so nothing disappears
        if (localBackup) {
            try {
                const parsed = JSON.parse(localBackup);
                if (parsed && parsed.notes && parsed.notes.length > 0) {
                    notes = parsed.notes;
                    activeNoteId = parsed.activeNoteId || notes[0].id;
                    hasLocalData = true;
                    updatePillUI();
                    finishAppLoad(); // Renders instantly
                }
            } catch (e) { console.error("Backup parse error", e); }
        }

        if (!hasLocalData) {
            window.showToast("<i data-lucide='loader'></i> Loading from Cloud...");
        } else {
            const indicator = document.getElementById('active-mode-indicator');
            if (indicator) indicator.innerHTML = `<i data-lucide="loader" class="spin" style="width:12px; height:12px;"></i> Syncing Cloud...`;
            if (window.lucide) lucide.createIcons();
        }

        // 2. BACKGROUND SYNC: Fetch new changes from GitHub silently
        const success = await GitHubBackend.init(token);
        if (success) {
            const cloudNotes = await GitHubBackend.getAllNotes();

            if (cloudNotes.length > 0) {
                if (!hasLocalData) {
                    notes = cloudNotes;
                    activeNoteId = notes[0].id;
                    localStorage.setItem('md_studio_notes_github_backup', JSON.stringify({ notes, activeNoteId }));
                    updatePillUI();
                    finishAppLoad();
                } else {
                    // Smart Merge: Add missing cloud files, update SHAs of existing files without overwriting local content
                    let modified = false;
                    for (let cNote of cloudNotes) {
                        let localNote = notes.find(n => n.path === cNote.path);
                        if (!localNote) {
                            notes.push(cNote);
                            modified = true;
                        } else if (localNote.id !== cNote.id) {
                            localNote.id = cNote.id; // Update SHA for future saves
                            modified = true;
                        }
                    }
                    if (modified) {
                        localStorage.setItem('md_studio_notes_github_backup', JSON.stringify({ notes, activeNoteId }));
                        window.renderNotesList();
                    }
                    updatePillUI();
                }
            } else if (!hasLocalData) {
                // New setup
                const result = await GitHubBackend.saveNote('new', null, "Welcome", defaultWelcomeNote);
                notes = [{ id: result?.sha || 'temp', path: result?.path || 'welcome.md', title: "Welcome", content: defaultWelcomeNote }];
                activeNoteId = notes[0].id;
                localStorage.setItem('md_studio_notes_github_backup', JSON.stringify({ notes, activeNoteId }));
                updatePillUI();
                finishAppLoad();
            }
        } else {
            window.showToast("Cloud sync failed. Working offline.");
            if (!hasLocalData) {
                appMode = 'local';
                localStorage.setItem('md_app_mode', 'local');
                loadLocalNotes();
            }
        }
        updatePillUI();
    }

    async function switchToMode(targetMode) {
        if (appMode === targetMode && editor.disabled === false) return;
        if (notes.length > 0) saveCurrentNote();

        if (targetMode === 'github') {
            const token = localStorage.getItem('md_github_token');
            if (!token) {
                document.getElementById('setup-modal').classList.add('show');
                return;
            }

            appMode = 'github';
            localStorage.setItem('md_app_mode', 'github');
            document.querySelectorAll(`[data-target="github"]`).forEach(tab => tab.innerHTML = '<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> Cloud');
            if (window.lucide) lucide.createIcons();

            await initGitHubMode(token);
        } else {
            appMode = 'local';
            localStorage.setItem('md_app_mode', 'local');
            editor.disabled = true;
            loadLocalNotes();
            updatePillUI();
        }
    }

    document.querySelectorAll('.mode-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            switchToMode(target);
        });
    });

    function initAppMode() {
        const savedMode = localStorage.getItem('md_app_mode') || 'local';
        if (savedMode === 'github') {
            const token = localStorage.getItem('md_github_token');
            if (token) {
                appMode = 'github';
                initGitHubMode(token);
            } else {
                appMode = 'local';
                loadLocalNotes();
                updatePillUI();
            }
        } else {
            appMode = 'local';
            loadLocalNotes();
            updatePillUI();
        }
    }

    document.getElementById('btn-start-app')?.addEventListener('click', async () => {
        const tokenInput = document.getElementById('github-token-input');
        const token = tokenInput.value.trim();
        const btn = document.getElementById('btn-start-app');

        if (!token) {
            window.showToast("Please enter a valid GitHub token.");
            return;
        }

        btn.innerHTML = "Connecting...";
        btn.disabled = true;

        const success = await GitHubBackend.init(token);
        if (success) {
            localStorage.setItem('md_github_token', token);
            tokenInput.value = '';
            document.getElementById('setup-modal').classList.remove('show');
            window.showToast("<i data-lucide='check'></i> Successfully Connected!");
            switchToMode('github');
        } else {
            window.showToast("Invalid Token. Check scope and try again.");
        }
        btn.innerHTML = "Connect";
        btn.disabled = false;
    });

    // --- 2. LOCAL STORAGE LOGIC ---
    function loadLocalNotes() {
        const saved = localStorage.getItem('md_studio_notes_local_v5');
        if (saved) {
            const parsed = JSON.parse(saved);
            notes = parsed.notes;
            activeNoteId = parsed.activeNoteId;
        } else {
            const id = Date.now().toString();
            notes = [{ id: id, path: 'welcome.md', title: "Welcome to Local Storage", content: defaultWelcomeNote }];
            activeNoteId = id;
        }
        finishAppLoad();
    }

    // --- 3. SAVE LOGIC (REAL-TIME LOCAL + DEBOUNCED CLOUD) ---
    function saveCurrentNote() {
        // 1. INSTANT LOCAL SAVE (Guarantees zero data loss on immediate refresh)
        if (appMode === 'local') {
            localStorage.setItem('md_studio_notes_local_v5', JSON.stringify({ notes, activeNoteId }));
        } else if (appMode === 'github') {
            localStorage.setItem('md_studio_notes_github_backup', JSON.stringify({ notes, activeNoteId }));

            // 2. BACKGROUND CLOUD PUSH (Waits 2 seconds after typing stops)
            const currentNote = getActiveNote();
            if (currentNote) {
                clearTimeout(cloudSaveTimeout);
                cloudSaveTimeout = setTimeout(async () => {
                    const indicator = document.getElementById('active-mode-indicator');
                    if (indicator) indicator.innerHTML = `<i data-lucide="loader" class="spin" style="width:12px; height:12px;"></i> Saving to Cloud...`;
                    if (window.lucide) lucide.createIcons();

                    const result = await GitHubBackend.saveNote(currentNote.id, currentNote.path, currentNote.title, currentNote.content);
                    if (result) {
                        currentNote.id = result.sha;
                        currentNote.path = result.path;
                        localStorage.setItem('md_studio_notes_github_backup', JSON.stringify({ notes, activeNoteId }));
                        updatePillUI();
                    } else {
                        updatePillUI();
                    }
                }, 2000);
            }
        }
    }

    function getActiveNote() { return notes.find(n => n.id === activeNoteId); }
    window.getActiveNoteTitle = function () { const note = getActiveNote(); return note ? note.title : "Document"; };

    function extractTitle(content) {
        const match = content.match(/^#+\s+(.*)/m);
        if (match && match[1]) {
            let extracted = match[1].replace(/\[([^\]]+)\]\s*\{\s*[a-zA-Z0-9#]+\s*\}/g, '$1').trim();
            return extracted.length > 30 ? extracted.substring(0, 30) + '...' : extracted;
        }
        return "Untitled Note";
    }

    function finishAppLoad() {
        highlightedNoteId = activeNoteId;
        editor.disabled = false;
        editor.placeholder = "Start typing your Markdown here...";
        editor.value = getActiveNote()?.content || "";
        renderMarkdown();
        if (typeof window.renderNotesList === 'function') window.renderNotesList();
        if (window.lucide) lucide.createIcons();
    }

    // --- PUSH LOCAL TO GITHUB BUTTON LOGIC ---
    document.getElementById('btn-push-github')?.addEventListener('click', async () => {
        const token = localStorage.getItem('md_github_token');
        if (!token) return window.showToast("Please link your GitHub PAT in Setup first!");

        const success = await GitHubBackend.init(token);
        if (success) {
            window.showToast("<i data-lucide='loader'></i> Pushing notes to Cloud...");
            document.getElementById('btn-push-github').disabled = true;
            document.getElementById('btn-push-github').innerHTML = "Pushing...";

            for (let note of notes) {
                const res = await GitHubBackend.saveNote('new', null, note.title, note.content);
                if (res) { note.id = res.sha; note.path = res.path; }
            }

            appMode = 'github';
            localStorage.setItem('md_app_mode', 'github');
            saveCurrentNote();
            updatePillUI();

            document.getElementById('btn-push-github').style.display = 'none';
            document.getElementById('btn-push-github').innerHTML = `<i data-lucide="cloud-upload"></i> Push Local to Cloud`;
            document.getElementById('btn-push-github').disabled = false;
            window.showToast("<i data-lucide='check'></i> Successfully pushed to GitHub!");
        }
    });

    // --- DASHBOARD RENDERING ---
    window.renderNotesList = function () {
        const container = document.getElementById('notes-list-container');
        if (!container) return;
        container.innerHTML = '';
        if (!highlightedNoteId) highlightedNoteId = activeNoteId;

        updatePillUI();

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = `note-item ${note.id === highlightedNoteId ? 'active' : ''}`;

            const titleContainer = document.createElement('div');
            titleContainer.className = 'note-title';
            titleContainer.style.display = 'flex';
            titleContainer.style.alignItems = 'center';
            titleContainer.style.gap = '12px';
            titleContainer.style.overflow = 'hidden';

            const iconEl = document.createElement('i');
            iconEl.setAttribute('data-lucide', 'file-text');
            iconEl.style.width = '18px';
            iconEl.style.height = '18px';
            iconEl.style.opacity = '0.7';
            iconEl.style.flexShrink = '0';

            const textSpan = document.createElement('span');
            textSpan.textContent = note.title;
            textSpan.style.whiteSpace = 'nowrap';
            textSpan.style.overflow = 'hidden';
            textSpan.style.textOverflow = 'ellipsis';

            titleContainer.appendChild(iconEl);
            titleContainer.appendChild(textSpan);
            div.appendChild(titleContainer);

            div.addEventListener('click', () => {
                highlightedNoteId = note.id;
                window.renderNotesList();
                window.renderDashboardPreview();
                if (window.innerWidth <= 768) {
                    document.querySelector('.notes-dashboard-box')?.classList.add('show-preview-pane');
                }
            });

            div.addEventListener('dblclick', () => { document.getElementById('dash-btn-edit')?.click(); });
            container.appendChild(div);
        });
        if (window.lucide) lucide.createIcons();
        window.renderDashboardPreview();
    };

    function customMarkdownParser(rawText) {
        let processedText = rawText;
        processedText = processedText.replace(/^={3,}\s*$/gm, '\n\n<hr class="custom-divider" />\n\n');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s*\n([\s\S]*?)\n\/end/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s+(.+)$/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, '<span style="color: $2;">$1</span>');
        const htmlContent = marked.parse(processedText);
        return DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['style', 'class'] });
    }

    window.renderDashboardPreview = function () {
        const previewEl = document.getElementById('dashboard-preview-output');
        const note = notes.find(n => n.id === highlightedNoteId) || notes[0];
        if (!note || !previewEl) return;

        previewEl.innerHTML = customMarkdownParser(note.content);
        renderMathInElement(previewEl, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    };

    document.getElementById('dash-btn-edit')?.addEventListener('click', () => {
        activeNoteId = highlightedNoteId;
        editor.value = getActiveNote().content;
        saveCurrentNote();
        renderMarkdown();
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
    });

    document.getElementById('dash-btn-delete')?.addEventListener('click', () => {
        noteToDeleteId = highlightedNoteId;
        document.getElementById('delete-modal').classList.add('show');
    });

    document.getElementById('dash-btn-export')?.addEventListener('click', () => {
        activeNoteId = highlightedNoteId;
        editor.value = getActiveNote().content;
        saveCurrentNote();
        renderMarkdown();
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
        setTimeout(() => { document.getElementById('btn-pdf').click(); }, 300);
    });

    document.getElementById('dash-btn-back')?.addEventListener('click', () => {
        document.querySelector('.notes-dashboard-box')?.classList.remove('show-preview-pane');
    });

    document.getElementById('delete-confirm')?.addEventListener('click', async () => {
        if (!noteToDeleteId) return;

        if (notes.length === 1) {
            notes[0].content = "# Untitled Note\n";
            notes[0].title = "Untitled Note";
            editor.value = notes[0].content;
        } else {
            const idx = notes.findIndex(n => n.id === noteToDeleteId);
            const noteToDelete = notes[idx];
            notes.splice(idx, 1);

            if (activeNoteId === noteToDeleteId) {
                activeNoteId = notes[Math.max(0, idx - 1)].id;
                editor.value = getActiveNote().content;
            }
            if (highlightedNoteId === noteToDeleteId) {
                highlightedNoteId = activeNoteId;
            }

            if (appMode === 'github' && noteToDelete.path) {
                window.showToast("<i data-lucide='loader'></i> Deleting from Cloud...");
                await GitHubBackend.deleteNote(noteToDelete.path, noteToDelete.id);
            }
        }

        saveCurrentNote(); // instantly saves update local list
        renderMarkdown();
        window.renderNotesList();

        noteToDeleteId = null;
        if (typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
        window.showToast("<i data-lucide='trash-2'></i> Note deleted");
    });

    const btnNewNote = document.getElementById('btn-new-note');
    const promptModal = document.getElementById('prompt-modal');
    const promptInput = document.getElementById('prompt-input');

    btnNewNote?.addEventListener('click', () => {
        promptInput.value = '';
        promptModal.classList.add('show');
        setTimeout(() => { promptInput.focus(); }, 100);
    });

    const createNoteFromPrompt = async () => {
        let noteName = promptInput.value.trim() || "Untitled Note";
        const newId = Date.now().toString();
        const content = `# ${noteName}\n\nStart typing here...`;

        let safeTitle = noteName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        if (!safeTitle) safeTitle = 'untitled';
        let path = `${safeTitle}_${Date.now().toString().slice(-4)}.md`;

        notes.unshift({ id: newId, path: path, title: noteName, content: content });
        activeNoteId = newId;
        highlightedNoteId = newId;
        editor.value = content;

        // Save locally instantly so data exists right now
        saveCurrentNote();
        renderMarkdown();
        window.renderNotesList();

        promptModal.classList.remove('show');
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();

        // Push to cloud
        if (appMode === 'github') {
            window.showToast("<i data-lucide='loader'></i> Saving to Cloud...");
            const result = await GitHubBackend.saveNote('new', path, noteName, content);
            if (result) {
                notes[0].id = result.sha;
                notes[0].path = result.path;
                saveCurrentNote();
            }
        }

        window.showToast("<i data-lucide='check-circle'></i> " + noteName + " created!");
    };

    document.getElementById('prompt-confirm')?.addEventListener('click', createNoteFromPrompt);
    promptInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') createNoteFromPrompt(); });
    document.getElementById('prompt-cancel')?.addEventListener('click', () => { promptModal.classList.remove('show'); });

    function updateLiveStats(text) {
        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        document.getElementById('stat-words').textContent = `${words} Words`;
        document.getElementById('stat-chars').textContent = `${chars} Characters`;
        document.getElementById('stat-reading-time').textContent = `${Math.max(1, Math.ceil(words / 200))} min read`;
    }

    marked.setOptions({ breaks: true, gfm: true, headerIds: true, mangle: false });
    function debounce(func, wait) { let timeout; return function (...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }

    const renderMarkdown = debounce(() => {
        const rawText = editor.value;
        const activeNote = getActiveNote();

        if (activeNote && activeNote.content !== rawText) {
            activeNote.content = rawText;
            activeNote.title = extractTitle(rawText);

            // This triggers instantly on keystroke to guarantee local backup
            saveCurrentNote();
        }

        updateLiveStats(rawText);
        preview.innerHTML = customMarkdownParser(rawText);

        renderMathInElement(preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));

        if (highlightedNoteId === activeNoteId && document.getElementById('notes-modal')?.classList.contains('show')) {
            window.renderDashboardPreview();
        }
    }, 50);

    editor.addEventListener('input', renderMarkdown);

    editor.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 2;
            renderMarkdown();
        }
    });

    let isScrollSync = true;
    let isSyncingLeft = false;
    let isSyncingRight = false;
    let scrollTimeout;

    const btnScrollSync = document.getElementById('btn-scroll-sync');
    if (btnScrollSync) {
        btnScrollSync.addEventListener('click', () => {
            isScrollSync = !isScrollSync;
            btnScrollSync.classList.toggle('active', isScrollSync);
            btnScrollSync.style.opacity = isScrollSync ? '1' : '0.4';
        });
    }

    editor.addEventListener('scroll', () => {
        if (!isScrollSync || isSyncingLeft) return;
        const editorScrollable = editor.scrollHeight - editor.clientHeight;
        const previewScrollable = previewPanel.scrollHeight - previewPanel.clientHeight;

        if (editorScrollable > 0 && previewScrollable > 0) {
            isSyncingRight = true;
            const percentage = editor.scrollTop / editorScrollable;
            previewPanel.scrollTop = percentage * previewScrollable;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => { isSyncingRight = false; }, 50);
        }
    });

    previewPanel.addEventListener('scroll', () => {
        if (!isScrollSync || isSyncingRight) return;
        const editorScrollable = editor.scrollHeight - editor.clientHeight;
        const previewScrollable = previewPanel.scrollHeight - previewPanel.clientHeight;

        if (editorScrollable > 0 && previewScrollable > 0) {
            isSyncingLeft = true;
            const percentage = previewPanel.scrollTop / previewScrollable;
            editor.scrollTop = percentage * editorScrollable;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => { isSyncingLeft = false; }, 50);
        }
    });

    document.querySelectorAll('.tool-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            let selection = editor.value.substring(start, end);
            const fullText = editor.value;

            let prefix = ''; let suffix = ''; let defaultText = '';

            if (action === 'bold') { prefix = '**'; suffix = '**'; defaultText = 'bold text'; }
            else if (action === 'italic') { prefix = '*'; suffix = '*'; defaultText = 'italic text'; }
            else if (action === 'math') { prefix = '$$'; suffix = '$$'; defaultText = 'e=mc^2'; }
            else if (action === 'code') { prefix = '\n```\n'; suffix = '\n```\n'; defaultText = 'code here'; }
            else if (action === 'heading') { prefix = '### '; suffix = ''; defaultText = 'Heading'; }
            else if (action === 'link') { prefix = '['; suffix = '](url)'; defaultText = 'link text'; }
            else if (action === 'image') { prefix = '!['; suffix = '](image_url)'; defaultText = 'alt text'; }
            else if (action === 'table') {
                prefix = '\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n';
                suffix = ''; defaultText = '';
            }
            else if (action === 'align-left') { prefix = '/left '; suffix = ''; defaultText = 'Left aligned text'; }
            else if (action === 'align-center') { prefix = '/center '; suffix = ''; defaultText = 'Centered text'; }
            else if (action === 'align-right') { prefix = '/right '; suffix = ''; defaultText = 'Right aligned text'; }

            editor.focus();

            if (prefix && suffix && selection.startsWith(prefix) && selection.endsWith(suffix) && selection.length >= prefix.length + suffix.length) {
                const unstripped = selection.substring(prefix.length, selection.length - suffix.length);
                editor.value = fullText.substring(0, start) + unstripped + fullText.substring(end);
                editor.selectionStart = start;
                editor.selectionEnd = start + unstripped.length;
                renderMarkdown();
                return;
            }

            const textBefore = fullText.substring(Math.max(0, start - prefix.length), start);
            const textAfter = fullText.substring(end, end + suffix.length);

            if (prefix && suffix && textBefore === prefix && textAfter === suffix) {
                editor.value = fullText.substring(0, start - prefix.length) + selection + fullText.substring(end + suffix.length);
                editor.selectionStart = start - prefix.length;
                editor.selectionEnd = start - prefix.length + selection.length;
                renderMarkdown();
                return;
            }

            if (action === 'heading') {
                const lineStart = fullText.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = fullText.indexOf('\n', end);
                const actualLineEnd = lineEnd === -1 ? fullText.length : lineEnd;
                const lineText = fullText.substring(lineStart, actualLineEnd);

                if (lineText.trimStart().startsWith('### ')) {
                    const stripped = lineText.replace(/^\s*###\s*/, '');
                    editor.value = fullText.substring(0, lineStart) + stripped + fullText.substring(actualLineEnd);
                    const offset = Math.max(lineStart, start - 4);
                    editor.selectionStart = editor.selectionEnd = offset;
                    renderMarkdown();
                    return;
                }
            }

            const textToWrap = selection || defaultText;
            editor.value = fullText.substring(0, start) + prefix + textToWrap + suffix + fullText.substring(end);

            if (!selection) {
                editor.selectionStart = start + prefix.length;
                editor.selectionEnd = start + prefix.length + defaultText.length;
            } else {
                editor.selectionStart = start + prefix.length;
                editor.selectionEnd = start + prefix.length + selection.length;
            }
            renderMarkdown();
        });
    });

    const btnExportMd = document.getElementById('btn-export-md');
    const btnImportMd = document.getElementById('btn-import-md');
    const importFile = document.getElementById('import-file');

    btnExportMd?.addEventListener('click', () => {
        const text = editor.value;
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        let safeTitle = getActiveNote().title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        if (safeTitle === 'untitled_note' || !safeTitle) safeTitle = 'markdown_document';
        a.download = `${safeTitle}.md`;
        a.click();
        URL.revokeObjectURL(url);
        window.showToast("<i data-lucide='download'></i> .md file downloaded!");
    });

    btnImportMd?.addEventListener('click', () => importFile.click());

    importFile?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const newId = Date.now().toString();
            const rawTitle = file.name.replace('.md', '').replace('.txt', '');
            const safePath = `${rawTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'imported'}_${Date.now().toString().slice(-4)}.md`;

            notes.unshift({ id: newId, path: safePath, title: rawTitle, content: content });
            activeNoteId = newId;
            highlightedNoteId = newId;
            editor.value = content;

            saveCurrentNote();
            renderMarkdown();
            if (typeof window.renderNotesList === 'function') window.renderNotesList();
            window.showToast("<i data-lucide='file-up'></i> Document imported locally!");

            if (appMode === 'github') {
                window.showToast("<i data-lucide='loader'></i> Saving to Cloud...");
                GitHubBackend.saveNote('new', safePath, rawTitle, content).then(result => {
                    if (result) {
                        notes[0].id = result.sha;
                        notes[0].path = result.path;
                        saveCurrentNote();
                    }
                });
            }
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    if (window.location.hash && window.location.hash.length > 1) {
        try {
            const encodedData = window.location.hash.substring(1);
            const decodedText = decodeURIComponent(atob(encodedData));
            const sharedId = Date.now().toString();
            const sharedTitle = extractTitle(decodedText) || "Shared Note";
            const sharedPath = `${sharedTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now().toString().slice(-4)}.md`;

            notes.unshift({ id: sharedId, path: sharedPath, title: sharedTitle, content: decodedText });
            activeNoteId = sharedId;
            highlightedNoteId = sharedId;
            window.showToast("<i data-lucide='download'></i> Shared document saved!");
            history.replaceState(null, null, ' ');
        } catch (e) { console.error("Invalid import link", e); }
    }

    inputFilename?.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnConfirmPdf.click(); });

    btnConfirmPdf?.addEventListener('click', () => {
        let fileName = inputFilename.value.trim() || getActiveNote().title || "Document";
        if (typeof window.closePdfModal === "function") window.closePdfModal();

        const style = document.createElement('style');
        let pageCss = "";

        if (window.selectedPageSize === 'A4') { pageCss = `@page { size: A4 portrait; margin: 0; } #preview-output { padding: 5px !important; }`; }
        else if (window.selectedPageSize === 'A2') { pageCss = `@page { size: A2 portrait; margin: 0; } #preview-output { padding: 5px !important; font-size: 1.2rem !important; }`; }
        else if (window.selectedPageSize === 'Infinity') {
            const contentHeightPx = document.getElementById('preview-output').scrollHeight;
            const contentHeightMm = Math.ceil(contentHeightPx * 0.264583) + 10;
            pageCss = `@page { size: 210mm ${contentHeightMm}mm; margin: 0; } #preview-output { padding: 5px !important; }`;
        }
        style.innerHTML = pageCss;
        document.head.appendChild(style);

        const originalTitle = document.title;
        document.title = fileName;

        setTimeout(() => {
            window.print();
            document.title = originalTitle;
            document.head.removeChild(style);
            if (typeof window.showToast === "function") window.showToast("<i data-lucide='check'></i> Export Successful!");
        }, 300);
    });

    // ✨ SECURE SHARE LOGIC ✨
    shareBtn?.addEventListener('click', async () => {
        const textToShare = editor.value;
        if (!textToShare.trim()) {
            return window.showToast("Cannot share an empty note.");
        }

        const token = localStorage.getItem('md_github_token');
        if (!token) {
            window.showToast("Please connect to GitHub in settings to use Secure Share.");
            document.getElementById('setup-modal').classList.add('show');
            return;
        }

        const originalHtml = shareBtn.innerHTML;
        shareBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width: 16px;"></i> Generating`;
        shareBtn.disabled = true;
        if (window.lucide) lucide.createIcons();

        try {
            const secretKey = CryptoJS.lib.WordArray.random(16).toString();
            const encryptedText = CryptoJS.AES.encrypt(textToShare, secretKey).toString();

            await GitHubBackend.init(token);
            const gistResult = await GitHubBackend.createSecretGist(encryptedText);

            if (gistResult && !gistResult.error) {
                const shareableUrl = `https://apandey-studio.vercel.app/share.html?id=${gistResult.id}#${secretKey}`;

                if (navigator.share) {
                    try { await navigator.share({ title: getActiveNote().title, url: shareableUrl }); }
                    catch (err) { console.log(err); }
                } else {
                    await navigator.clipboard.writeText(shareableUrl);
                    window.showToast("<i data-lucide='link'></i> Secure Link Copied!");
                }
            } else {
                console.error("Gist Error: ", gistResult);
                window.showToast("Failed: Please ensure your PAT has 'gist' permission.");
            }
        } catch (err) {
            console.error("Share error", err);
            window.showToast("An error occurred during encryption.");
        }

        shareBtn.innerHTML = originalHtml;
        shareBtn.disabled = false;
        if (window.lucide) lucide.createIcons();
    });

    initAppMode();
});