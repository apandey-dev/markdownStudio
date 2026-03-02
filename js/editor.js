/* ==========================================================================
   EDITOR CONTROLLER (Local-First Architecture & Folder System)
   Handles storage modes, parsing, folders, duplicate checks, and syncing.
   Includes Performance Engine for 300k+ words.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('markdown-input');
    const previewPanel = document.getElementById('preview-panel');
    const preview = document.getElementById('preview-output');
    const shareBtn = document.getElementById('btn-share');
    const btnConfirmPdf = document.getElementById('modal-confirm');
    const inputFilename = document.getElementById('pdf-filename');

    editor.disabled = true;

    // STATE
    let notes = [];
    let folders = ['All Notes']; 
    let activeFolder = 'All Notes';
    let activeNoteId = null;
    
    let noteToDeleteId = null;
    let highlightedNoteId = null;
    let pendingNewNoteData = null; 

    let appMode = 'local';
    let isSyncing = false;
    let pendingSync = false;
    let syncTimer = null;

    const defaultWelcomeNote = `# Welcome to Markdown Studio 🖤\n\nYour premium workspace.\n\n## [ ✨ Features ]{#3b82f6}\n* **📂 Folders:** Organize notes neatly.\n* **🖨️ Native PDF Export:** Scalable vector PDFs.\n* **🎨 Custom Colors:** Use syntax \`[Text]{red}\`.\n* **↔️ Alignment:** Type \`/center\`, \`/right\`, \`/left\`.\n\n/center **Enjoy writing!**`;

    function updatePillUI() {
        const isGithub = appMode === 'github';

        document.querySelectorAll('[data-target]').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll(`[data-target="${appMode}"]`).forEach(tab => tab.classList.add('active'));

        const indicator = document.getElementById('active-mode-indicator');
        if (indicator) {
            if (isGithub) {
                if (isSyncing) {
                    indicator.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> Syncing...`;
                    indicator.style.color = '#3b82f6';
                } else if (pendingSync) {
                    indicator.innerHTML = `<i data-lucide="cloud-upload" style="width:14px; height:14px;"></i> Pending Sync`;
                    indicator.style.color = '#f59e0b';
                } else {
                    indicator.innerHTML = `<i data-lucide="cloud-check" style="width:14px; height:14px;"></i> Cloud Synced`;
                    indicator.style.color = '#10b981';
                }
            } else {
                indicator.innerHTML = `<i data-lucide="hard-drive" style="width:14px; height:14px;"></i> Local Storage`;
                indicator.style.color = 'var(--text-color)';
            }
        }

        const dashboardBadge = document.getElementById('dashboard-mode-badge');
        if (dashboardBadge) {
            if (isGithub) {
                dashboardBadge.innerHTML = '<i data-lucide="cloud" style="width: 12px; height: 12px;"></i> CLOUD';
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

    function extractFoldersFromNotes() {
        let fSet = new Set(['All Notes']);
        notes.forEach(n => {
            if(n.folder) fSet.add(n.folder);
        });
        folders = Array.from(fSet);
    }

    function saveLocalState() {
        if (appMode === 'local') {
            localStorage.setItem('md_notes_local', JSON.stringify(notes));
            localStorage.setItem('md_active_local', activeNoteId);
        } else {
            localStorage.setItem('md_notes_github', JSON.stringify(notes));
            localStorage.setItem('md_active_github', activeNoteId);
        }
    }

    // ✨ FAILSAFE: Save data if user instantly closes tab mid-typing ✨
    window.addEventListener('beforeunload', () => {
        if (getActiveNote() && editor.value) {
            getActiveNote().content = editor.value;
            saveLocalState();
        }
    });

    function triggerCloudSync() {
        if (appMode !== 'github') return;
        pendingSync = true;
        updatePillUI();

        clearTimeout(syncTimer);
        syncTimer = setTimeout(async () => {
            if (isSyncing) return;
            await performCloudSync();
        }, 2000);
    }

    async function performCloudSync() {
        if (!pendingSync || appMode !== 'github') return;
        isSyncing = true;
        updatePillUI();

        try {
            const currentNote = getActiveNote();
            if (currentNote) {
                const result = await GitHubBackend.saveNote(currentNote.id, currentNote.path, currentNote.title, currentNote.content);
                if (result) {
                    currentNote.id = result.sha;
                    currentNote.path = result.path;
                    saveLocalState();
                    pendingSync = false;
                } else {
                    pendingSync = true;
                }
            }
        } catch (e) {
            console.error("Sync Error:", e);
        } finally {
            isSyncing = false;
            updatePillUI();
            if (pendingSync) triggerCloudSync();
        }
    }

    async function initGitHubMode(token) {
        const localCache = localStorage.getItem('md_notes_github');
        if (localCache) {
            try {
                notes = JSON.parse(localCache);
                extractFoldersFromNotes();
                activeNoteId = localStorage.getItem('md_active_github') || notes[0]?.id;
                finishAppLoad();
            } catch (e) { }
        } else {
            window.showToast("<i data-lucide='loader'></i> Fetching from Cloud...");
        }

        const success = await GitHubBackend.init(token);
        if (success) {
            const cloudNotes = await GitHubBackend.getAllNotes();

            if (!localCache || notes.length === 0) {
                if (cloudNotes.length > 0) {
                    notes = cloudNotes;
                    activeNoteId = notes[0].id;
                } else {
                    const result = await GitHubBackend.saveNote('new', 'Welcome.md', "Welcome", defaultWelcomeNote);
                    notes = [{ id: result?.sha || 'temp', path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: defaultWelcomeNote }];
                    activeNoteId = notes[0].id;
                }
                extractFoldersFromNotes();
                saveLocalState();
                finishAppLoad();
                updatePillUI();
            } else {
                let added = false;
                for (let cNote of cloudNotes) {
                    const localNote = notes.find(n => n.path === cNote.path);
                    if (!localNote) {
                        notes.push(cNote);
                        added = true;
                    }
                }
                if (added) {
                    extractFoldersFromNotes();
                    saveLocalState();
                    if(document.getElementById('notes-modal').classList.contains('show')) {
                        window.renderFoldersList();
                        window.renderNotesList();
                    }
                }
                triggerCloudSync();
            }
        } else {
            window.showToast("Token invalid or offline. Working purely locally.");
        }
    }

    function loadLocalMode() {
        const localCache = localStorage.getItem('md_notes_local');
        if (localCache) {
            try {
                notes = JSON.parse(localCache);
                extractFoldersFromNotes();
                activeNoteId = localStorage.getItem('md_active_local') || notes[0]?.id;
            } catch (e) { }
        } else {
            const id = Date.now().toString();
            notes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: defaultWelcomeNote }];
            folders = ['All Notes'];
            activeNoteId = id;
            saveLocalState();
        }
        finishAppLoad();
        updatePillUI();
    }

    async function switchToMode(targetMode) {
        if (appMode === targetMode && editor.disabled === false) return;

        if (notes.length > 0) saveLocalState();

        if (targetMode === 'github') {
            const token = localStorage.getItem('md_github_token');
            if (!token) {
                document.getElementById('setup-modal').classList.add('show');
                return;
            }

            appMode = 'github';
            localStorage.setItem('md_app_mode', 'github');
            document.querySelectorAll(`[data-target="github"]`).forEach(tab => tab.innerHTML = '<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> <span class="tab-text">Cloud</span>');
            if (window.lucide) lucide.createIcons();

            editor.disabled = true;
            await initGitHubMode(token);
        } else {
            appMode = 'local';
            localStorage.setItem('md_app_mode', 'local');
            editor.disabled = true;
            loadLocalMode();
        }
    }

    document.getElementById('btn-start-app')?.addEventListener('click', async () => {
        const tokenInput = document.getElementById('github-token-input');
        const token = tokenInput.value.trim();
        const btn = document.getElementById('btn-start-app');

        if (!token) return window.showToast("Please enter a valid GitHub token.");

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

    document.querySelectorAll('[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            switchToMode(target);
        });
    });

    function getActiveNote() {
        let n = notes.find(n => n.id === activeNoteId);
        if (!n && notes.length > 0) {
            activeNoteId = notes[0].id;
            n = notes[0];
            saveLocalState();
        }
        return n;
    }

    window.getActiveNoteTitle = function () { const note = getActiveNote(); return note ? note.title : "Document"; };

    function generatePath(folderName, title) {
        let safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim();
        if(!safeTitle) safeTitle = 'Untitled Note';
        if (folderName === 'All Notes') return `${safeTitle}.md`;
        return `${folderName}/${safeTitle}.md`;
    }

    function finishAppLoad() {
        const note = getActiveNote();
        if (!note) return;

        highlightedNoteId = activeNoteId;
        activeFolder = note.folder || 'All Notes'; 
        
        editor.disabled = false;
        editor.placeholder = "Start typing your Markdown here...";
        editor.value = note.content || "";
        renderMarkdownCore(editor.value);

        if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
        if (typeof window.renderNotesList === 'function') window.renderNotesList();
        if (window.lucide) lucide.createIcons();
    }

    window.renderFoldersList = function () {
        const container = document.getElementById('folders-list-container');
        if (!container) return;
        container.innerHTML = '';
        
        extractFoldersFromNotes();

        folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = `folder-item ${folder === activeFolder ? 'active' : ''}`;
            
            const iconEl = document.createElement('i');
            iconEl.setAttribute('data-lucide', folder === 'All Notes' ? 'library' : 'folder');
            
            const textSpan = document.createElement('span');
            textSpan.textContent = folder;
            textSpan.style.flex = "1";
            textSpan.style.whiteSpace = 'nowrap';
            textSpan.style.overflow = 'hidden';
            textSpan.style.textOverflow = 'ellipsis';
            
            let count = folder === 'All Notes' ? notes.length : notes.filter(n => n.folder === folder).length;
            const countSpan = document.createElement('span');
            countSpan.textContent = count;
            countSpan.style.fontSize = "0.75rem";
            countSpan.style.opacity = "0.6";

            div.appendChild(iconEl);
            div.appendChild(textSpan);
            div.appendChild(countSpan);

            div.addEventListener('click', () => {
                activeFolder = folder;
                window.renderFoldersList();
                window.renderNotesList();
                
                if (window.innerWidth <= 768) {
                    document.querySelector('.notes-dashboard-box')?.classList.add('show-notes-pane');
                }
            });

            container.appendChild(div);
        });
        if (window.lucide) lucide.createIcons();
    };

    window.renderNotesList = function () {
        const container = document.getElementById('notes-list-container');
        const folderTitle = document.getElementById('current-folder-name');
        if (!container) return;
        
        container.innerHTML = '';
        if (folderTitle) folderTitle.textContent = activeFolder;
        
        updatePillUI();

        let displayNotes = activeFolder === 'All Notes' ? notes : notes.filter(n => n.folder === activeFolder);

        if(displayNotes.length > 0 && !displayNotes.find(n => n.id === highlightedNoteId)) {
            highlightedNoteId = displayNotes[0].id;
        } else if (displayNotes.length === 0) {
            highlightedNoteId = null;
        }

        displayNotes.forEach(note => {
            const div = document.createElement('div');
            div.className = `note-item ${note.id === highlightedNoteId ? 'active' : ''}`;

            const titleContainer = document.createElement('div');
            titleContainer.className = 'note-title';
            
            const iconEl = document.createElement('i');
            iconEl.setAttribute('data-lucide', 'file-text');
            
            const textSpan = document.createElement('span');
            textSpan.textContent = note.title;
            
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

    document.getElementById('mob-back-folders')?.addEventListener('click', () => {
        document.querySelector('.notes-dashboard-box')?.classList.remove('show-notes-pane');
    });

    function customMarkdownParser(rawText) {
        let processedText = rawText.replace(/\r\n/g, '\n');
        processedText = processedText.replace(/^={3,}\s*$/gm, '\n\n<hr class="custom-divider" />\n\n');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s*\n([\s\S]*?)\n\/end/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s+(.+)$/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, '<span style="color: $2;">$1</span>');
        
        const htmlContent = marked.parse(processedText, { breaks: true, gfm: true });
        return DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['style', 'class'] });
    }

    window.renderDashboardPreview = function () {
        const previewEl = document.getElementById('dashboard-preview-output');
        const note = notes.find(n => n.id === highlightedNoteId);
        
        if (!note || !previewEl) {
            if(previewEl) previewEl.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">No note selected</div>`;
            return;
        }

        previewEl.innerHTML = customMarkdownParser(note.content);
        renderMathInElement(previewEl, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    };

    document.getElementById('dash-btn-edit')?.addEventListener('click', () => {
        if(!highlightedNoteId) return;
        activeNoteId = highlightedNoteId;
        saveLocalState(); 
        editor.value = getActiveNote().content;
        renderMarkdownCore(editor.value);
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
    });

    document.getElementById('dash-btn-delete')?.addEventListener('click', () => {
        if(!highlightedNoteId) return;
        noteToDeleteId = highlightedNoteId;
        document.getElementById('delete-modal').classList.add('show');
    });

    document.getElementById('dash-btn-export')?.addEventListener('click', () => {
        if(!highlightedNoteId) return;
        activeNoteId = highlightedNoteId;
        saveLocalState();
        editor.value = getActiveNote().content;
        renderMarkdownCore(editor.value);
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
        setTimeout(() => { document.getElementById('btn-pdf').click(); }, 300);
    });

    document.getElementById('dash-btn-back')?.addEventListener('click', () => {
        document.querySelector('.notes-dashboard-box')?.classList.remove('show-preview-pane');
    });

    document.getElementById('delete-confirm')?.addEventListener('click', async () => {
        if (!noteToDeleteId) return;

        const idx = notes.findIndex(n => n.id === noteToDeleteId);
        if(idx === -1) return;
        
        const noteToDelete = notes[idx];
        notes.splice(idx, 1);

        if (activeNoteId === noteToDeleteId) {
            activeNoteId = notes.length > 0 ? notes[Math.max(0, idx - 1)].id : null;
            if(activeNoteId) editor.value = getActiveNote().content;
            else editor.value = "";
        }
        
        if (highlightedNoteId === noteToDeleteId) {
            let displayNotes = activeFolder === 'All Notes' ? notes : notes.filter(n => n.folder === activeFolder);
            highlightedNoteId = displayNotes.length > 0 ? displayNotes[0].id : null;
        }

        if (appMode === 'github' && noteToDelete.path) {
            GitHubBackend.deleteNote(noteToDelete.path, noteToDelete.id);
        }

        if(notes.length === 0) {
            const id = Date.now().toString();
            notes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: defaultWelcomeNote }];
            activeNoteId = id;
            editor.value = notes[0].content;
        }

        saveLocalState();
        renderMarkdownCore(editor.value);
        window.renderFoldersList();
        window.renderNotesList();

        noteToDeleteId = null;
        if (typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
        window.showToast("<i data-lucide='trash-2'></i> Note deleted");
    });

    const btnNewFolder = document.getElementById('btn-new-folder');
    const folderPromptModal = document.getElementById('folder-prompt-modal');
    const folderPromptInput = document.getElementById('folder-prompt-input');

    btnNewFolder?.addEventListener('click', () => {
        folderPromptInput.value = '';
        folderPromptModal.classList.add('show');
        setTimeout(() => { folderPromptInput.focus(); }, 100);
    });

    document.getElementById('folder-prompt-confirm')?.addEventListener('click', () => {
        let folderName = folderPromptInput.value.trim().replace(/[/\\?%*:|"<>]/g, '-');
        if(!folderName) return window.showToast("Folder name cannot be empty.");
        if(folders.includes(folderName)) return window.showToast("Folder already exists.");
        
        folders.push(folderName);
        activeFolder = folderName;
        window.renderFoldersList();
        window.renderNotesList();
        
        folderPromptModal.classList.remove('show');
        window.showToast(`<i data-lucide='folder'></i> Folder '${folderName}' created!`);
        
        if (window.innerWidth <= 768) document.querySelector('.notes-dashboard-box')?.classList.add('show-notes-pane');
    });
    
    document.getElementById('folder-prompt-cancel')?.addEventListener('click', () => folderPromptModal.classList.remove('show'));

    const btnNewNote = document.getElementById('btn-new-note');
    const promptModal = document.getElementById('prompt-modal');
    const promptInput = document.getElementById('prompt-input');

    btnNewNote?.addEventListener('click', () => {
        promptInput.value = '';
        promptModal.classList.add('show');
        setTimeout(() => { promptInput.focus(); }, 100);
    });

    const createNoteFlow = async () => {
        let noteName = promptInput.value.trim() || "Untitled Note";
        const folder = activeFolder;
        const generatedPath = generatePath(folder, noteName);
        
        const existingNote = notes.find(n => n.path === generatedPath);
        const newId = Date.now().toString();
        const content = `# ${noteName}\n\nStart typing here...`;

        if (existingNote) {
            pendingNewNoteData = { id: newId, path: generatedPath, folder: folder, title: noteName, content: content, existingId: existingNote.id };
            document.getElementById('conflict-filename').textContent = noteName + ".md";
            promptModal.classList.remove('show');
            document.getElementById('conflict-modal').classList.add('show');
            return;
        }

        executeNoteCreation({ id: newId, path: generatedPath, folder: folder, title: noteName, content: content });
    };

    function executeNoteCreation(noteData) {
        notes.unshift(noteData);
        activeNoteId = noteData.id;
        highlightedNoteId = noteData.id;
        editor.value = noteData.content;

        saveLocalState();
        renderMarkdownCore(noteData.content);
        window.renderFoldersList();
        window.renderNotesList();

        promptModal.classList.remove('show');
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();

        if (appMode === 'github') triggerCloudSync();
        window.showToast("<i data-lucide='check-circle'></i> " + noteData.title + " created!");
    }

    document.getElementById('prompt-confirm')?.addEventListener('click', createNoteFlow);
    promptInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') createNoteFlow(); });
    document.getElementById('prompt-cancel')?.addEventListener('click', () => { promptModal.classList.remove('show'); });

    document.getElementById('conflict-cancel')?.addEventListener('click', () => {
        document.getElementById('conflict-modal').classList.remove('show');
        pendingNewNoteData = null;
    });

    document.getElementById('conflict-rename')?.addEventListener('click', () => {
        document.getElementById('conflict-modal').classList.remove('show');
        promptInput.value = pendingNewNoteData.title + " (New)";
        promptModal.classList.add('show');
        pendingNewNoteData = null;
    });

    document.getElementById('conflict-overwrite')?.addEventListener('click', () => {
        if(!pendingNewNoteData) return;
        let exNote = notes.find(n => n.id === pendingNewNoteData.existingId);
        if(exNote) {
            exNote.content = pendingNewNoteData.content;
            activeNoteId = exNote.id;
            highlightedNoteId = exNote.id;
            editor.value = exNote.content;
            
            saveLocalState();
            renderMarkdownCore(exNote.content);
            window.renderNotesList();
            if (appMode === 'github') triggerCloudSync();
            window.showToast("<i data-lucide='copy'></i> Note Overwritten!");
        }
        document.getElementById('conflict-modal').classList.remove('show');
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
        pendingNewNoteData = null;
    });

    document.getElementById('btn-push-github')?.addEventListener('click', async () => {
        const token = localStorage.getItem('md_github_token');
        if (!token) return window.showToast("Please link your GitHub PAT in Setup first!");

        const success = await GitHubBackend.init(token);
        if (success) {
            window.showToast("<i data-lucide='loader'></i> Pushing notes to Cloud...");
            document.getElementById('btn-push-github').disabled = true;
            document.getElementById('btn-push-github').innerHTML = "Pushing...";

            for (let note of notes) {
                const res = await GitHubBackend.saveNote('new', note.path, note.title, note.content);
                if (res) { note.id = res.sha; note.path = res.path; }
            }

            appMode = 'github';
            localStorage.setItem('md_app_mode', 'github');
            saveLocalState();
            updatePillUI();

            document.getElementById('btn-push-github').style.display = 'none';
            document.getElementById('btn-push-github').innerHTML = `<i data-lucide="cloud-upload"></i> Push Local to Cloud`;
            document.getElementById('btn-push-github').disabled = false;
            window.showToast("<i data-lucide='check'></i> Successfully pushed to GitHub!");
        }
    });

    // ✨ PERFORMANCE ENGINE (Debounce implementation) ✨
    function debounce(func, wait) { 
        let timeout; 
        return function (...args) { 
            clearTimeout(timeout); 
            timeout = setTimeout(() => func.apply(this, args), wait); 
        }; 
    }

    function renderMarkdownCore(rawText) {
        updateLiveStats(rawText);
        preview.innerHTML = customMarkdownParser(rawText);
        renderMathInElement(preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));

        if (highlightedNoteId === activeNoteId && document.getElementById('notes-modal')?.classList.contains('show')) {
            window.renderDashboardPreview();
        }
    }

    function updateLiveStats(text) {
        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        document.getElementById('stat-words').textContent = `${words} Words`;
        document.getElementById('stat-chars').textContent = `${chars} Characters`;
        document.getElementById('stat-reading-time').textContent = `${Math.max(1, Math.ceil(words / 200))} min read`;
    }

    // Debounce rendering & saving so main thread isn't blocked while typing 100k+ words
    const debouncedRenderAndSave = debounce((rawText) => {
        const activeNote = getActiveNote();
        if (activeNote) {
            activeNote.content = rawText;
            saveLocalState(); // Local storage update
            triggerCloudSync(); // Background Github push
        }
        renderMarkdownCore(rawText); // Heavy DOM parser
    }, 400);

    editor.addEventListener('input', () => {
        // Typing is now instantly responsive, UI processes slightly later
        debouncedRenderAndSave(editor.value);
    });

    editor.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 2;
            editor.dispatchEvent(new Event('input'));
        }
    });

    let isScrollSync = true;
    let isSyncingLeft = false;
    let isSyncingRight = false;
    let uiScrollTimeout;

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
            clearTimeout(uiScrollTimeout);
            uiScrollTimeout = setTimeout(() => { isSyncingRight = false; }, 50);
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
            clearTimeout(uiScrollTimeout);
            uiScrollTimeout = setTimeout(() => { isSyncingLeft = false; }, 50);
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
                editor.dispatchEvent(new Event('input'));
                return;
            }

            const textBefore = fullText.substring(Math.max(0, start - prefix.length), start);
            const textAfter = fullText.substring(end, end + suffix.length);

            if (prefix && suffix && textBefore === prefix && textAfter === suffix) {
                editor.value = fullText.substring(0, start - prefix.length) + selection + fullText.substring(end + suffix.length);
                editor.selectionStart = start - prefix.length;
                editor.selectionEnd = start - prefix.length + selection.length;
                editor.dispatchEvent(new Event('input'));
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
                    editor.dispatchEvent(new Event('input'));
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
            editor.dispatchEvent(new Event('input'));
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
        let safeTitle = getActiveNote().title.replace(/[/\\?%*:|"<>]/g, '_').toLowerCase();
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
            const rawTitle = file.name.replace('.md', '').replace('.txt', '');
            const folder = activeFolder;
            const newPath = generatePath(folder, rawTitle);
            const newId = Date.now().toString();
            
            if(notes.find(n => n.path === newPath)) {
                window.showToast("<i data-lucide='alert-triangle'></i> File already exists. Rename file first.");
                return;
            }

            notes.unshift({ id: newId, path: newPath, folder: folder, title: rawTitle, content: content });
            activeNoteId = newId;
            highlightedNoteId = newId;
            editor.value = content;

            saveLocalState();
            renderMarkdownCore(content);
            if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
            if (typeof window.renderNotesList === 'function') window.renderNotesList();
            window.showToast("<i data-lucide='file-up'></i> Document imported locally!");

            if (appMode === 'github') triggerCloudSync();
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
            const sharedPath = generatePath('All Notes', sharedTitle);

            notes.unshift({ id: sharedId, path: sharedPath, folder: 'All Notes', title: sharedTitle, content: decodedText });
            activeNoteId = sharedId;
            highlightedNoteId = sharedId;
            saveLocalState();
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

    shareBtn?.addEventListener('click', async () => {
        const textToShare = editor.value;
        if (!textToShare.trim()) return window.showToast("Cannot share an empty note.");

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
                window.showToast("Failed: Please ensure your PAT has 'gist' permission.");
            }
        } catch (err) {
            window.showToast("An error occurred during encryption.");
        }

        shareBtn.innerHTML = originalHtml;
        shareBtn.disabled = false;
        if (window.lucide) lucide.createIcons();
    });

    const savedMode = localStorage.getItem('md_app_mode') || 'local';
    if (savedMode === 'github') {
        const token = localStorage.getItem('md_github_token');
        if (token) {
            appMode = 'github';
            initGitHubMode(token);
        } else {
            loadLocalMode();
        }
    } else {
        loadLocalMode();
    }
});