/* ==========================================================================
   EDITOR CONTROLLER (Dual Mode: Local vs GitHub)
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
    
    // State Variables
    let notes = [];
    let activeNoteId = null;
    let noteToDeleteId = null;
    let highlightedNoteId = null; 
    let appMode = localStorage.getItem('md_app_mode'); // 'local' or 'github'

    // Cloud Sync State
    let syncSelectedNotes = new Set();
    let syncHighlightedNoteId = null;

    const defaultWelcomeNote = `# Welcome to Markdown Studio 🖤\n\nYour premium workspace.\n\n## [ ✨ Features ]{#3b82f6}\n* **🖨️ Native PDF Export:** Click "Export" to perfectly scale vector PDFs.\n* **🎨 Custom Colors:** Use syntax \`[Text]{red}\` to add color.\n* **↔️ Alignment:** Type \`/center\`, \`/right\`, \`/left\` before any text!\n* **➖ Spaced Divider:** Type \`===\` on a new line for a wide-spaced horizontal rule.\n\n/center **This heading is perfectly centered!**\n\n===\n\n> Click **📂 Notes** to create a new one!`;

    // --- 1. SETUP MODAL & MODE INITIALIZATION ---
    function updateSyncStatusUI() {
        const syncStatus = document.getElementById('sync-status');
        const btnOpenSyncModal = document.getElementById('btn-open-sync-modal');
        if(!syncStatus) return;

        syncStatus.style.display = 'inline-flex';
        if(appMode === 'github') {
            syncStatus.innerHTML = `<i data-lucide="cloud" style="width: 14px; height: 14px;"></i> GitHub Cloud`;
            syncStatus.className = 'sync-status-btn mode-github';
            if(btnOpenSyncModal) btnOpenSyncModal.style.display = 'none'; // Hide Save to cloud when already in cloud
        } else {
            syncStatus.innerHTML = `<i data-lucide="hard-drive" style="width: 14px; height: 14px;"></i> Local Mode`;
            syncStatus.className = 'sync-status-btn mode-local';
            if(btnOpenSyncModal) btnOpenSyncModal.style.display = 'inline-flex'; // Show Save to Cloud button
        }
        if(window.lucide) lucide.createIcons();
    }

    document.getElementById('sync-status')?.addEventListener('click', () => {
        document.getElementById('setup-modal').classList.add('show');
    });

    function initAppMode() {
        const setupModal = document.getElementById('setup-modal');
        
        if (!appMode) {
            setupModal.classList.add('show');
        } else if (appMode === 'github') {
            const savedToken = localStorage.getItem('md_github_token');
            if(savedToken && window.GitHubBackend) {
                updateSyncStatusUI();
                initGitHubMode(savedToken);
            } else {
                appMode = 'local';
                loadLocalNotes();
            }
        } else {
            appMode = 'local';
            loadLocalNotes();
        }
    }

    // Modal Option Toggles
    document.getElementById('btn-opt-local')?.addEventListener('click', (e) => {
        e.currentTarget.classList.add('active');
        document.getElementById('btn-opt-github').classList.remove('active');
        document.getElementById('github-token-section').style.display = 'none';
    });

    document.getElementById('btn-opt-github')?.addEventListener('click', (e) => {
        e.currentTarget.classList.add('active');
        document.getElementById('btn-opt-local').classList.remove('active');
        
        // 🚀 SMART AUTO-LOGIN LOGIC 
        const savedToken = localStorage.getItem('md_github_token');
        if (savedToken) {
            document.getElementById('github-token-input').value = savedToken;
            document.getElementById('btn-start-app').click(); // Auto-fire login!
        } else {
            document.getElementById('github-token-section').style.display = 'block';
        }
    });

    document.getElementById('btn-start-app')?.addEventListener('click', async () => {
        const isGithubSelected = document.getElementById('btn-opt-github').classList.contains('active');
        const setupModal = document.getElementById('setup-modal');
        const btn = document.getElementById('btn-start-app');
        
        if (isGithubSelected) {
            const token = document.getElementById('github-token-input').value.trim();
            if (!token && !localStorage.getItem('md_github_token')) {
                window.showToast("Please enter a valid GitHub token.");
                return;
            }
            
            const activeToken = token || localStorage.getItem('md_github_token');

            btn.innerHTML = `<i data-lucide="loader" class="spin"></i> Connecting...`;
            if(window.lucide) lucide.createIcons();
            btn.disabled = true;

            const success = await GitHubBackend.init(activeToken);
            
            if(success) {
                appMode = 'github';
                localStorage.setItem('md_app_mode', 'github');
                setupModal.classList.remove('show');
                window.showToast("<i data-lucide='check'></i> Connected to GitHub!");
                
                updateSyncStatusUI();
                
                const cloudNotes = await GitHubBackend.getAllNotes();
                if(cloudNotes.length > 0) {
                    notes = cloudNotes;
                    activeNoteId = notes[0].id;
                } else {
                    const newId = await GitHubBackend.saveNote('new', "Welcome", defaultWelcomeNote);
                    notes = [{ id: newId || 'temp', title: "Welcome", content: defaultWelcomeNote }];
                    activeNoteId = notes[0].id;
                }
                finishAppLoad();
            } else {
                window.showToast("Invalid Token. Check scope and try again.");
                document.getElementById('github-token-section').style.display = 'block'; // Show input if hidden
            }
            btn.innerHTML = "Start Writing";
            btn.disabled = false;

        } else {
            appMode = 'local';
            localStorage.setItem('md_app_mode', 'local');
            setupModal.classList.remove('show');
            updateSyncStatusUI();
            loadLocalNotes();
        }
    });

    // --- 2. LOCAL STORAGE LOGIC ---
    function loadLocalNotes() {
        const saved = localStorage.getItem('md_studio_notes_modal_v4');
        if (saved) {
            const parsed = JSON.parse(saved);
            notes = parsed.notes;
            activeNoteId = parsed.activeNoteId;
        } else {
            const id = Date.now().toString();
            notes = [{ id: id, title: "Welcome to Markdown Studio", content: defaultWelcomeNote }];
            activeNoteId = id;
        }
        updateSyncStatusUI();
        finishAppLoad();
    }

    // --- 3. GITHUB MODE LOGIC ---
    async function initGitHubMode(token) {
        window.showToast("<i data-lucide='loader' class='spin'></i> Syncing from GitHub...");
        const success = await GitHubBackend.init(token);
        if (success) {
            const cloudNotes = await GitHubBackend.getAllNotes();
            if(cloudNotes.length > 0) {
                notes = cloudNotes;
                activeNoteId = notes[0].id;
            } else {
                notes = [{ id: 'temp', title: "Welcome", content: defaultWelcomeNote }];
                activeNoteId = 'temp';
            }
            window.showToast("<i data-lucide='check-circle'></i> Sync Complete");
            finishAppLoad();
        } else {
            window.showToast("GitHub Sync failed. Reverting to local.");
            appMode = 'local';
            localStorage.setItem('md_app_mode', 'local');
            updateSyncStatusUI();
            loadLocalNotes();
        }
    }

    async function saveCurrentNote() {
        if(appMode === 'local') {
            localStorage.setItem('md_studio_notes_modal_v4', JSON.stringify({ notes, activeNoteId }));
        } else if (appMode === 'github') {
            localStorage.setItem('md_studio_notes_backup', JSON.stringify({ notes, activeNoteId }));
        }
    }

    function getActiveNote() { return notes.find(n => n.id === activeNoteId); }
    window.getActiveNoteTitle = function () { const note = getActiveNote(); return note ? note.title : "Document"; };

    function extractTitle(content) {
        const match = content.match(/^#+\s+(.*)/m);
        if (match && match[1]) {
            return match[1].replace(/\[([^\]]+)\]\s*\{\s*[a-zA-Z0-9#]+\s*\}/g, '$1').substring(0, 30) + '...';
        }
        return "Untitled Note";
    }

    function finishAppLoad() {
        highlightedNoteId = activeNoteId;
        editor.value = getActiveNote()?.content || "";
        renderMarkdown();
        if (typeof window.renderNotesList === 'function') window.renderNotesList();
        if(window.lucide) lucide.createIcons();
    }

    // --- 4. SHARED PARSER UTILITY ---
    function customMarkdownParser(rawText) {
        let processedText = rawText;
        
        // Custom Parser logic
        processedText = processedText.replace(/^={3,}\s*$/gm, '\n\n<hr class="custom-divider" />\n\n');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s*\n([\s\S]*?)\n\/end/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s+(.+)$/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, '<span style="color: $2;">$1</span>');
        
        const htmlContent = marked.parse(processedText);
        return DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['style', 'class'] });
    }

    // --- 5. DASHBOARD RENDERING ---
    window.renderNotesList = function () {
        const container = document.getElementById('notes-list-container');
        if(!container) return;
        container.innerHTML = '';
        if(!highlightedNoteId) highlightedNoteId = activeNoteId;

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = `note-item ${note.id === highlightedNoteId ? 'active' : ''}`;
            div.innerHTML = `<div class="note-title"><i data-lucide="file-text" style="width: 18px; height: 18px; opacity: 0.7;"></i> ${note.title}</div>`;

            div.addEventListener('click', () => {
                highlightedNoteId = note.id;
                window.renderNotesList(); 
                window.renderDashboardPreview();
                if (window.innerWidth <= 768) {
                    document.querySelector('#notes-modal .notes-dashboard-box')?.classList.add('show-preview-pane');
                }
            });

            div.addEventListener('dblclick', () => { document.getElementById('dash-btn-edit')?.click(); });
            container.appendChild(div);
        });
        if(window.lucide) lucide.createIcons();
        window.renderDashboardPreview();
    };

    window.renderDashboardPreview = function() {
        const previewEl = document.getElementById('dashboard-preview-output');
        const note = notes.find(n => n.id === highlightedNoteId) || notes[0];
        if(!note || !previewEl) return;
        
        previewEl.innerHTML = customMarkdownParser(note.content);
        renderMathInElement(previewEl, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    };

    // --- DASHBOARD ACTIONS ---
    document.getElementById('dash-btn-edit')?.addEventListener('click', () => {
        activeNoteId = highlightedNoteId;
        editor.value = getActiveNote().content;
        saveCurrentNote();
        renderMarkdown();
        if(typeof window.closeNotesModal === 'function') window.closeNotesModal();
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
        if(typeof window.closeNotesModal === 'function') window.closeNotesModal();
        setTimeout(() => { document.getElementById('btn-pdf').click(); }, 300);
    });

    document.getElementById('dash-btn-back')?.addEventListener('click', () => {
        document.querySelector('#notes-modal .notes-dashboard-box')?.classList.remove('show-preview-pane');
    });

    // --- 6. 🚀 CLOUD SYNC MODAL LOGIC (New Feature) ---
    window.renderSyncList = function() {
        const container = document.getElementById('sync-notes-list-container');
        if(!container) return;
        container.innerHTML = '';
        
        if(!syncHighlightedNoteId && notes.length > 0) syncHighlightedNoteId = notes[0].id;

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = `note-item ${note.id === syncHighlightedNoteId ? 'active' : ''}`;
            const isChecked = syncSelectedNotes.has(note.id) ? 'checked' : '';
            
            div.innerHTML = `
                <div class="note-title" style="display: flex; align-items: center; gap: 12px; width: 100%;">
                    <input type="checkbox" class="sync-checkbox" data-id="${note.id}" ${isChecked} style="width: 18px; height: 18px; cursor: pointer;">
                    <i data-lucide="file-text" style="width: 18px; height: 18px; opacity: 0.7;"></i> 
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">${note.title}</span>
                </div>
            `;

            // Note Preview Trigger
            div.addEventListener('click', (e) => {
                if(e.target.type === 'checkbox') return; // Don't trigger if clicked exactly on checkbox
                syncHighlightedNoteId = note.id;
                window.renderSyncList();
                window.renderSyncPreview();
                if (window.innerWidth <= 768) {
                    document.querySelector('#cloud-sync-modal .notes-dashboard-box')?.classList.add('show-preview-pane');
                }
            });

            // Checkbox Trigger
            const cb = div.querySelector('.sync-checkbox');
            cb.addEventListener('change', (e) => {
                if(e.target.checked) syncSelectedNotes.add(note.id);
                else syncSelectedNotes.delete(note.id);
                
                document.getElementById('btn-confirm-sync').innerHTML = `<i data-lucide="upload-cloud" style="width: 16px;"></i> Upload Selected (${syncSelectedNotes.size})`;
                if(window.lucide) lucide.createIcons();
            });

            container.appendChild(div);
        });
        if(window.lucide) lucide.createIcons();
        window.renderSyncPreview();
    };

    window.renderSyncPreview = function() {
        const previewEl = document.getElementById('sync-preview-output');
        const note = notes.find(n => n.id === syncHighlightedNoteId) || notes[0];
        if(!note || !previewEl) return;
        
        previewEl.innerHTML = customMarkdownParser(note.content);
        renderMathInElement(previewEl, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    };

    document.getElementById('sync-btn-back')?.addEventListener('click', () => {
        document.querySelector('#cloud-sync-modal .notes-dashboard-box')?.classList.remove('show-preview-pane');
    });

    document.getElementById('btn-confirm-sync')?.addEventListener('click', async () => {
        if(syncSelectedNotes.size === 0) {
            window.showToast("Select at least one note to upload.");
            return;
        }

        let token = localStorage.getItem('md_github_token');
        if(!token) {
            window.showToast("No Token found. Connecting to GitHub...");
            if(typeof window.closeCloudSyncModal === 'function') window.closeCloudSyncModal();
            document.getElementById('setup-modal').classList.add('show');
            document.getElementById('btn-opt-github').click();
            return;
        }

        const btn = document.getElementById('btn-confirm-sync');
        btn.innerHTML = `<i data-lucide="loader" class="spin"></i> Uploading...`;
        btn.disabled = true;
        if(window.lucide) lucide.createIcons();

        const success = await GitHubBackend.init(token);
        if(!success) {
            window.showToast("Invalid GitHub Token.");
            btn.innerHTML = `<i data-lucide="upload-cloud" style="width: 16px;"></i> Upload Selected (${syncSelectedNotes.size})`;
            btn.disabled = false;
            return;
        }

        let uploadCount = 0;
        for(let id of syncSelectedNotes) {
            const note = notes.find(n => n.id === id);
            if(note) {
                await GitHubBackend.saveNote('new', note.title, note.content);
                uploadCount++;
            }
        }

        window.showToast(`<i data-lucide="check-circle"></i> Sync Successful! Switch modes to view them.`);
        if(typeof window.closeCloudSyncModal === 'function') window.closeCloudSyncModal();
        
        btn.innerHTML = `<i data-lucide="upload-cloud" style="width: 16px;"></i> Upload Selected (${syncSelectedNotes.size})`;
        btn.disabled = false;
    });

    // --- DELETE CONFIRM LOGIC ---
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

            if(appMode === 'github' && noteToDelete.path) {
                window.showToast("<i data-lucide='loader' class='spin'></i> Deleting from Cloud...");
                await GitHubBackend.deleteNote(noteToDelete.path, noteToDelete.id);
            }
        }

        saveCurrentNote();
        renderMarkdown();
        window.renderNotesList();

        noteToDeleteId = null;
        if(typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
        window.showToast("<i data-lucide='trash-2'></i> Note deleted");
    });

    // --- NEW NOTE LOGIC ---
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
        
        notes.unshift({ id: newId, title: noteName, content: content });
        activeNoteId = newId;
        highlightedNoteId = newId;
        editor.value = content;

        if(appMode === 'github') {
            window.showToast("<i data-lucide='loader' class='spin'></i> Saving to Cloud...");
            const sha = await GitHubBackend.saveNote('new', noteName, content);
            if(sha) notes[0].id = sha; 
        }

        saveCurrentNote();
        renderMarkdown();
        window.renderNotesList();
        
        promptModal.classList.remove('show');
        if(typeof window.closeNotesModal === 'function') window.closeNotesModal();
        window.showToast("<i data-lucide='check-circle'></i> " + noteName + " created!");
    };

    document.getElementById('prompt-confirm')?.addEventListener('click', createNoteFromPrompt);
    promptInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') createNoteFromPrompt(); });
    document.getElementById('prompt-cancel')?.addEventListener('click', () => { promptModal.classList.remove('show'); });

    // --- PARSER AND STATS ---
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
        
        if (activeNote) {
            activeNote.content = rawText;
            activeNote.title = extractTitle(rawText);
            saveCurrentNote();
        }

        updateLiveStats(rawText);
        preview.innerHTML = customMarkdownParser(rawText);
        
        renderMathInElement(preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        
        // Auto update dashboard if open
        if(highlightedNoteId === activeNoteId && document.getElementById('notes-modal')?.classList.contains('show')) {
            window.renderDashboardPreview();
        }
    }, 50);

    editor.addEventListener('input', renderMarkdown);

    // Tab key support
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

    // ==========================================
    // ✨ SMART 2-WAY SCROLL SYNC ✨
    // ==========================================
    let isScrollSync = true;
    let isSyncingLeft = false;
    let isSyncingRight = false;
    let scrollTimeout;

    const btnScrollSync = document.getElementById('btn-scroll-sync');
    if(btnScrollSync) {
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

    // Toolbar Shortcuts Mapping
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

    // --- IMPORT / EXPORT LOGIC ---
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
            notes.unshift({ id: newId, title: file.name.replace('.md', '').replace('.txt', ''), content: content });
            activeNoteId = newId;
            highlightedNoteId = newId;
            editor.value = content;
            saveCurrentNote();
            renderMarkdown();
            if (typeof window.renderNotesList === 'function') window.renderNotesList();
            window.showToast("<i data-lucide='file-up'></i> Document imported!");
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    // Check for shared URL Hash
    if (window.location.hash && window.location.hash.length > 1) {
        try {
            const encodedData = window.location.hash.substring(1);
            const decodedText = decodeURIComponent(atob(encodedData));
            const sharedId = Date.now().toString();
            notes.unshift({ id: sharedId, title: extractTitle(decodedText) || "Shared Note", content: decodedText });
            activeNoteId = sharedId;
            highlightedNoteId = sharedId;
            window.showToast("<i data-lucide='download'></i> Shared document saved!");
            history.replaceState(null, null, ' ');
        } catch (e) { console.error("Invalid share link", e); }
    }

    // --- PDF EXPORT LOGIC ---
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

    shareBtn?.addEventListener('click', async () => {
        const textToShare = editor.value;
        const encodedData = btoa(encodeURIComponent(textToShare));
        const shareableUrl = window.location.origin + window.location.pathname + "#" + encodedData;

        if (navigator.share) {
            try { await navigator.share({ title: getActiveNote().title, url: shareableUrl }); }
            catch (err) { console.log(err); }
        } else {
            navigator.clipboard.writeText(shareableUrl).then(() => {
                if (typeof window.showToast === "function") window.showToast("<i data-lucide='link'></i> Link Copied!");
            });
        }
    });

    // TRIGGER APP INITIALIZATION ON LOAD
    initAppMode();
});