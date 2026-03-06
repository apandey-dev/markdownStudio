/* js/editor.js */
/* ==========================================================================
   STORAGE MANAGER (IndexedDB Migration + Quota Handling)
   ========================================================================== */
const StorageManager = {
    dbName: "markdownStudioDB",
    storeName: "notes",
    db: null,
    useIDB: false,

    async init() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                resolve(false);
                return;
            }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: "id" });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                this.useIDB = localStorage.getItem('md_storage_preference') === 'indexedDB';
                resolve(true);
            };
            request.onerror = (e) => {
                console.error("IndexedDB init failed", e);
                resolve(false);
            };
        });
    },

    safeSetLocal(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                if (window.showToast) {
                    window.showToast("<i data-lucide='alert-triangle'></i> Critical: Storage limit reached (~5MB). Please export your notes or enable Cloud Sync immediately.", 7000);
                }
            }
            return false;
        }
    },

    async checkMigrationThreshold(notesArray) {
        if (this.useIDB || !this.db) return;
        try {
            let totalSize = 0;
            for (const n of notesArray) {
                totalSize += n.content ? n.content.length : 0;
            }
            if (totalSize > 3 * 1024 * 1024) { 
                await this.migrateToIDB(notesArray);
            }
        } catch (e) {
            console.error("Failed to check migration threshold", e);
        }
    },

    async migrateToIDB(notesArray) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            notesArray.forEach(note => store.put(note));

            tx.oncomplete = () => {
                this.useIDB = true;
                this.safeSetLocal('md_storage_preference', 'indexedDB');
                localStorage.removeItem('md_notes_local');
                localStorage.removeItem('md_notes_github');
                if (window.showToast) window.showToast("<i data-lucide='database'></i> Large document detected. Migrated safely to IndexedDB.");
                resolve(true);
            };
            tx.onerror = (e) => reject(e);
        });
    },

    async saveNotes(notesArray, mode = 'local') {
        notesArray.forEach(n => {
            if (!n.lastUpdated) n.lastUpdated = Date.now();
            n._mode = mode;
        });

        await this.checkMigrationThreshold(notesArray);

        if (this.useIDB && this.db) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(this.storeName, "readwrite");
                const store = tx.objectStore(this.storeName);
                notesArray.forEach(note => store.put(note));
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } else {
            const key = mode === 'local' ? 'md_notes_local' : 'md_notes_github';
            return this.safeSetLocal(key, JSON.stringify(notesArray));
        }
    },

    async getAllNotes(mode = 'local') {
        if (this.useIDB && this.db) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(this.storeName, "readonly");
                const store = tx.objectStore(this.storeName);
                const req = store.getAll();
                req.onsuccess = () => {
                    const all = req.result || [];
                    const filtered = all.filter(n => (n._mode || 'local') === mode);
                    resolve(filtered.length > 0 ? filtered.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0)) : null);
                };
                req.onerror = () => resolve(null);
            });
        } else {
            const key = mode === 'local' ? 'md_notes_local' : 'md_notes_github';
            try {
                const data = localStorage.getItem(key);
                let parsed = data ? JSON.parse(data) : null;
                if (parsed) parsed = parsed.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
                return parsed;
            } catch (e) {
                return null;
            }
        }
    },

    async deleteNote(id) {
        if (this.useIDB && this.db) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(this.storeName, "readwrite");
                tx.objectStore(this.storeName).delete(id);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        }
        return true;
    }
};

/* ==========================================================================
   OFFLINE QUEUE SYSTEM
   ========================================================================== */
const OfflineQueue = {
    key: 'md_offline_queue',
    isProcessing: false,

    get() {
        try { return JSON.parse(localStorage.getItem(this.key) || '[]'); }
        catch { return []; }
    },

    add(type, payload) {
        const q = this.get();
        if (type === 'delete' && q.some(op => op.type === 'delete' && op.payload.path === payload.path)) {
            return;
        }
        q.push({ type, payload, timestamp: Date.now() });
        StorageManager.safeSetLocal(this.key, JSON.stringify(q));
    },

    async process() {
        if (!navigator.onLine || !GitHubBackend.isConfigured || this.isProcessing) return;
        const q = this.get();
        if (q.length === 0) return;

        this.isProcessing = true;
        let remaining = [];

        for (let op of q) {
            try {
                if (op.type === 'delete') {
                    await GitHubBackend.deleteNote(op.payload.path, op.payload.sha);
                }
            } catch (e) {
                console.error("Failed to process offline op:", e);
                remaining.push(op);
            }
        }

        StorageManager.safeSetLocal(this.key, JSON.stringify(remaining));
        this.isProcessing = false;
    }
};

/* ==========================================================================
   EDITOR CONTROLLER & UI LOGIC
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {

    setTimeout(async () => {

        await StorageManager.init();

        const editor = document.getElementById('markdown-input');
        const previewPanel = document.getElementById('preview-panel');
        const preview = document.getElementById('preview-output');
        const shareBtn = document.getElementById('btn-share');
        const btnConfirmPdf = document.getElementById('modal-confirm');
        const inputFilename = document.getElementById('pdf-filename');

        editor.disabled = true;

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
        let syncRetries = 0;
        const MAX_SYNC_RETRIES = 3;
        
        // ✨ AUTO-SAVE STATE ✨
        let isAutoSave = localStorage.getItem('md_autosave') !== 'false';

        const defaultWelcomeNote = `# Welcome to Markdown Studio 🖤\n\nYour premium workspace.\n\n## [ ✨ Features ]{#3b82f6}\n* **💻 Code Blocks:** Hover over code to copy it!\n* **🖼️ Pro Images:** \`![alt](url){300x400, center}\`\n* **🧠 Wiki Links:** Type \`[[Note Name]]\` to link notes!\n\n## 🧪 Testing Zone\n\n**1. Copy Code Feature**\n\`\`\`javascript\nfunction greet(name) {\n  console.log("Hello, " + name + "!");\n}\ngreet("Markdown Studio");\n\`\`\`\n\n**2. Responsive Image (Left Aligned, 200px)**\n![Nature](https://images.unsplash.com/photo-1506744626753-143d4e8c1874?q=80&w=300&auto=format&fit=crop){200, left}\nThis text automatically wraps around the right side of the beautiful nature image because we used the \`{200, left}\` syntax.\n\n**3. Custom Raw SVG Icon**\n<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>\n\n/center **Enjoy writing!**`;

        // ✨ UPDATE AUTOSAVE UI ✨
        function updateAutoSaveUI() {
            const btnToggle = document.getElementById('btn-toggle-autosave');
            const btnManual = document.getElementById('btn-manual-save');
            if(btnToggle && btnManual) {
                if(isAutoSave) {
                    btnToggle.innerHTML = `<i data-lucide="toggle-right" style="width: 16px; height: 16px; color: #10b981;"></i> <span class="desktop-only" style="color:var(--text-color);">Auto-Save: ON</span>`;
                    btnToggle.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                    btnManual.style.display = 'none';
                } else {
                    btnToggle.innerHTML = `<i data-lucide="toggle-left" style="width: 16px; height: 16px; color: #ef4444;"></i> <span class="desktop-only" style="color:var(--text-color);">Auto-Save: OFF</span>`;
                    btnToggle.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                    btnManual.style.display = 'flex';
                }
            }
            if(window.lucide) lucide.createIcons();
        }

        // ✨ MANUAL SAVE & TOGGLE HANDLERS ✨
        document.getElementById('btn-toggle-autosave')?.addEventListener('click', async () => {
            isAutoSave = !isAutoSave;
            localStorage.setItem('md_autosave', isAutoSave);
            updateAutoSaveUI();
            if (isAutoSave) {
                // Instantly save pending work if turned back on
                await saveLocalState();
                if (appMode === 'github') triggerCloudSync();
                window.showToast("<i data-lucide='check-circle'></i> Auto-Save Enabled");
            } else {
                window.showToast("<i data-lucide='info'></i> Auto-Save Disabled. Use 'Save Now' to sync.");
            }
        });

        document.getElementById('btn-manual-save')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-manual-save');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i data-lucide="loader" class="spin" style="width: 14px; height: 14px;"></i> <span class="desktop-only">Saving...</span>`;
            btn.disabled = true;
            if (window.lucide) lucide.createIcons();

            const activeNote = getActiveNote();
            if (activeNote) {
                activeNote.content = editor.value;
                activeNote.lastUpdated = Date.now();
                await saveLocalState();
                
                // If in GitHub mode, force immediate sync
                if (appMode === 'github') {
                    await performCloudSync();
                }
            }
            
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            if (window.lucide) lucide.createIcons();
            window.showToast("<i data-lucide='save'></i> Note Saved Successfully!");
        });


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

            const btnSyncCurrent = document.getElementById('btn-sync-current');
            if (btnSyncCurrent) {
                if (!isGithub && localStorage.getItem('md_github_token') && notes.length > 0) {
                    btnSyncCurrent.style.display = 'flex';
                } else {
                    btnSyncCurrent.style.display = 'none';
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

        function loadFolders() {
            try {
                let saved = localStorage.getItem(`md_folders_${appMode}`);
                if (saved) folders = JSON.parse(saved);
                else folders = ['All Notes'];
            } catch (e) { folders = ['All Notes']; }
        }

        function saveFolders() {
            StorageManager.safeSetLocal(`md_folders_${appMode}`, JSON.stringify(folders));
        }

        function extractFoldersFromNotes() {
            let fSet = new Set(folders);
            fSet.add('All Notes');
            notes.forEach(n => {
                if (n.folder) fSet.add(n.folder);
            });
            folders = Array.from(fSet);
            saveFolders();
        }

        async function saveLocalState() {
            const mode = appMode;
            StorageManager.safeSetLocal(`md_active_${mode}`, activeNoteId);
            await StorageManager.saveNotes(notes, mode);
        }

        window.addEventListener('online', () => {
            if (appMode === 'github') {
                OfflineQueue.process();
                if(isAutoSave) triggerCloudSync();
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
            if (!pendingSync || appMode !== 'github' || isSyncing) return;

            if (!navigator.onLine) {
                pendingSync = true;
                updatePillUI();
                return;
            }

            isSyncing = true;
            updatePillUI();

            await OfflineQueue.process();

            try {
                const currentNote = getActiveNote();
                if (currentNote) {
                    const result = await GitHubBackend.saveNote(currentNote.id, currentNote.path, currentNote.title, currentNote.content);
                    if (result && result !== 'conflict') {
                        currentNote.id = result.sha;
                        currentNote.path = result.path;
                        await saveLocalState();
                        pendingSync = false;
                        syncRetries = 0;
                    } else if (result === 'conflict') {
                        throw new Error("Conflict detected");
                    } else {
                        throw new Error("Failed to save to cloud");
                    }
                }
            } catch (e) {
                console.error("Sync Error:", e);
                pendingSync = true;
                syncRetries++;

                if (syncRetries <= MAX_SYNC_RETRIES) {
                    const backoffTime = Math.pow(2, syncRetries) * 1000;
                    clearTimeout(syncTimer);
                    syncTimer = setTimeout(performCloudSync, backoffTime);
                } else {
                    if (window.showToast) window.showToast("<i data-lucide='wifi-off'></i> Cloud Sync temporarily unavailable.");
                }
            } finally {
                isSyncing = false;
                updatePillUI();
                if (pendingSync && syncRetries === 0) triggerCloudSync();
            }
        }

        async function initGitHubMode(token) {
            loadFolders();
            const localCachedNotes = await StorageManager.getAllNotes('github') || [];

            if (localCachedNotes.length > 0) {
                notes = localCachedNotes;
                extractFoldersFromNotes();
                activeNoteId = localStorage.getItem('md_active_github') || notes[0]?.id;
                finishAppLoad();
            }

            const success = await GitHubBackend.init(token);
            if (success) {
                const cloudNotes = await GitHubBackend.getAllNotes();

                if (localCachedNotes.length === 0) {
                    if (cloudNotes.length > 0) {
                        notes = cloudNotes;
                    } else {
                        const result = await GitHubBackend.saveNote('new', 'Welcome.md', "Welcome", defaultWelcomeNote);
                        notes = [{ id: result?.sha || 'temp', path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: defaultWelcomeNote, lastUpdated: Date.now() }];
                    }
                    activeNoteId = notes[0]?.id;
                } else {
                    let mergedMap = new Map();
                    localCachedNotes.forEach(n => mergedMap.set(n.path, n));

                    let addedOrUpdated = false;
                    cloudNotes.forEach(cn => {
                        const ln = mergedMap.get(cn.path);
                        if (!ln || cn.id !== ln.id) {
                            if (ln) cn.lastUpdated = Date.now();
                            mergedMap.set(cn.path, cn);
                            addedOrUpdated = true;
                        }
                    });

                    notes = Array.from(mergedMap.values()).sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

                    if (addedOrUpdated) {
                        if (!notes.find(n => n.id === activeNoteId)) activeNoteId = notes[0]?.id;
                        if (document.getElementById('notes-modal').classList.contains('show')) {
                            window.renderFoldersList();
                            window.renderNotesList();
                        }
                    }
                }

                extractFoldersFromNotes();
                await saveLocalState();
                finishAppLoad();
                updatePillUI();
                if(isAutoSave) triggerCloudSync();

            } else {
                window.showToast("Token invalid or offline. Working purely locally.");
                finishAppLoad();
            }
        }

        async function loadLocalMode() {
            loadFolders();
            const cachedNotes = await StorageManager.getAllNotes('local');
            if (cachedNotes && cachedNotes.length > 0) {
                notes = cachedNotes;
                extractFoldersFromNotes();
                activeNoteId = localStorage.getItem('md_active_local') || notes[0]?.id;
            } else {
                const id = Date.now().toString();
                notes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: defaultWelcomeNote, lastUpdated: Date.now() }];
                folders = ['All Notes'];
                activeNoteId = id;
                await saveLocalState();
                saveFolders();
            }
            finishAppLoad();
            updatePillUI();
        }

        async function switchToMode(targetMode) {
            if (appMode === targetMode && editor.disabled === false) return;

            if (notes.length > 0) await saveLocalState();

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
                document.body.classList.add('is-loading');
                await initGitHubMode(token);
            } else {
                appMode = 'local';
                localStorage.setItem('md_app_mode', 'local');
                editor.disabled = true;
                document.body.classList.add('is-loading');
                await loadLocalMode();
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
                await switchToMode('github');
            } else {
                window.showToast("Invalid Token. Check scope and try again.");
            }
            btn.innerHTML = "Connect";
            btn.disabled = false;
        });

        document.querySelectorAll('[data-target]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                await switchToMode(target);
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
            if (!safeTitle) safeTitle = 'Untitled Note';
            if (folderName === 'All Notes') return `${safeTitle}.md`;
            return `${folderName}/${safeTitle}.md`;
        }

        function finishAppLoad() {
            updateAutoSaveUI(); // Initialize Auto-Save UI
            
            const note = getActiveNote();
            if (!note) return;

            highlightedNoteId = activeNoteId;
            activeFolder = note.folder || 'All Notes';
            if (!folders.includes(activeFolder)) activeFolder = 'All Notes';

            editor.disabled = false;
            editor.placeholder = "Start typing your Markdown here...";
            editor.value = note.content || "";

            renderMarkdownCore(editor.value);

            if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
            if (typeof window.renderNotesList === 'function') window.renderNotesList();
            if (window.lucide) lucide.createIcons();

            requestAnimationFrame(() => {
                setTimeout(() => {
                    document.body.classList.remove('is-loading');
                    const skel = document.getElementById('preview-skeleton');
                    if (skel) {
                        skel.style.opacity = '0';
                        setTimeout(() => skel.style.display = 'none', 400);
                    }
                }, 300);
            });
        }

        window.renderMainSidebarFolders = function () {
            const container = document.getElementById('dynamic-sidebar-folders');
            if (!container) return;
            container.innerHTML = '';

            folders.forEach(folder => {
                const btn = document.createElement('button');
                btn.className = `sidebar-btn sidebar-folder-btn ${folder === activeFolder ? 'active' : ''}`;

                let iconType = folder === 'All Notes' ? 'library' : 'folder';
                let count = folder === 'All Notes' ? notes.length : notes.filter(n => n.folder === folder).length;

                btn.innerHTML = `<i data-lucide="${iconType}"></i> <span style="flex:1; text-align:left;">${folder}</span> <span style="font-size: 0.75rem; opacity: 0.6; background: var(--shadow-color); padding: 2px 8px; border-radius: 10px;">${count}</span>`;

                btn.addEventListener('click', () => {
                    activeFolder = folder;
                    document.getElementById('mobile-sidebar-overlay').classList.remove('show');
                    document.getElementById('notes-modal').classList.add('show');
                    window.renderFoldersList();
                    window.renderNotesList();
                    if (window.innerWidth <= 768) {
                        document.querySelector('.notes-dashboard-box')?.classList.add('show-notes-pane');
                    }
                });
                container.appendChild(btn);
            });
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

                if (folder !== 'All Notes') {
                    const delBtn = document.createElement('button');
                    delBtn.className = 'folder-del-btn';
                    delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
                    delBtn.title = "Delete Folder";

                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const folderNotes = notes.filter(n => n.folder === folder);
                        if (folderNotes.length > 0) {
                            window.showToast("<i data-lucide='alert-circle'></i> Cannot delete. Move notes first.");
                            return;
                        }
                        folders = folders.filter(f => f !== folder);
                        if (activeFolder === folder) activeFolder = 'All Notes';
                        saveFolders();
                        window.renderFoldersList();
                        window.renderNotesList();
                        window.showToast("Folder deleted.");
                    });
                    div.appendChild(delBtn);
                }

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

            window.renderMainSidebarFolders();
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

            if (displayNotes.length > 0 && !displayNotes.find(n => n.id === highlightedNoteId)) {
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

        const bulkSyncModal = document.getElementById('bulk-sync-modal');
        const bulkSyncList = document.getElementById('bulk-sync-list');

        document.getElementById('btn-push-github')?.addEventListener('click', () => {
            const token = localStorage.getItem('md_github_token');
            if (!token) return window.showToast("Please link your GitHub PAT in Setup first!");

            bulkSyncList.innerHTML = '';
            notes.forEach((note, index) => {
                const item = document.createElement('label');
                item.className = 'sync-item';

                item.innerHTML = `
                    <input type="checkbox" class="sync-checkbox" value="${index}" checked />
                    <div class="sync-checkbox-custom"><i data-lucide="check"></i></div>
                    <div class="sync-item-info">
                        <span class="sync-item-title">${note.title}</span>
                        <span class="sync-item-folder"><i data-lucide="folder" style="width:10px;"></i> ${note.folder || 'All Notes'}</span>
                    </div>
                `;
                bulkSyncList.appendChild(item);
            });
            if (window.lucide) lucide.createIcons();

            document.getElementById('notes-modal').classList.remove('show');
            bulkSyncModal.classList.add('show');
        });

        document.getElementById('bulk-sync-cancel')?.addEventListener('click', () => bulkSyncModal.classList.remove('show'));

        document.getElementById('bulk-sync-all')?.addEventListener('click', () => {
            document.querySelectorAll('.sync-checkbox').forEach(cb => cb.checked = true);
        });

        document.getElementById('bulk-sync-none')?.addEventListener('click', () => {
            document.querySelectorAll('.sync-checkbox').forEach(cb => cb.checked = false);
        });

        document.getElementById('bulk-sync-confirm')?.addEventListener('click', async () => {
            const token = localStorage.getItem('md_github_token');
            const checkboxes = document.querySelectorAll('.sync-checkbox:checked');

            if (checkboxes.length === 0) return window.showToast("Please select at least one note to upload.");

            const success = await GitHubBackend.init(token);
            if (!success) return window.showToast("Token invalid or offline.");

            bulkSyncModal.classList.remove('show');
            const widget = document.getElementById('upload-progress-widget');
            const pTitle = document.getElementById('pw-title');
            const pFile = document.getElementById('pw-filename');
            const pStatus = document.getElementById('pw-status');
            const pFill = document.getElementById('pw-fill');
            const spinner = document.getElementById('pw-spinner');
            const successIcon = document.getElementById('pw-success');

            widget.classList.remove('hidden');
            pTitle.textContent = "Uploading to Cloud";
            spinner.style.display = 'block';
            successIcon.style.display = 'none';

            const total = checkboxes.length;
            let completed = 0;

            const selectedNotes = Array.from(checkboxes).map(cb => notes[cb.value]);

            for (let note of selectedNotes) {
                pFile.textContent = `Uploading: ${note.title}...`;
                pStatus.textContent = `${completed} out of ${total} done`;
                pFill.style.width = `${(completed / total) * 100}%`;

                try {
                    const res = await GitHubBackend.saveNote('new', note.path, note.title, note.content);
                    if (res && res !== 'conflict') {
                        note.id = res.sha;
                        note.path = res.path;
                        note.lastUpdated = Date.now();
                    }
                } catch (e) { console.log(`Failed to upload ${note.title}`); }

                completed++;
                pStatus.textContent = `${completed} out of ${total} done`;
                pFill.style.width = `${(completed / total) * 100}%`;
            }

            spinner.style.display = 'none';
            successIcon.style.display = 'block';
            pTitle.textContent = "Upload Complete!";
            pFile.textContent = "All selected notes synced.";

            appMode = 'github';
            localStorage.setItem('md_app_mode', 'github');
            await saveLocalState();
            updatePillUI();

            setTimeout(() => {
                widget.classList.add('hidden');
                window.showToast("<i data-lucide='check'></i> Successfully switched to Cloud!");
            }, 3000);
        });

        // ✨ UPDATED PARSER TO HANDLE WIKI-LINKS ✨
        function customMarkdownParser(rawText) {
            let processedText = rawText.replace(/\r\n/g, '\n');

            processedText = processedText.replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g, (match, alt, url, options) => {
                let style = 'max-width: 100%; border-radius: 8px; transition: all 0.3s ease; ';
                let isCenter = false;

                if (options) {
                    const parts = options.split(',').map(p => p.trim().toLowerCase());
                    parts.forEach(part => {
                        if (part === 'center') {
                            isCenter = true;
                        } else if (part === 'left') {
                            style += 'float: left; margin-right: 16px; margin-bottom: 16px; ';
                        } else if (part === 'right') {
                            style += 'float: right; margin-left: 16px; margin-bottom: 16px; ';
                        } else if (part.match(/^(\d+(?:px|rem|em|%)?)(?:x(\d+(?:px|rem|em|%)?|auto))?$/)) {
                            const dimMatch = part.match(/^(\d+(?:px|rem|em|%)?)(?:x(\d+(?:px|rem|em|%)?|auto))?$/);
                            let w = dimMatch[1];
                            if (!isNaN(w)) w += 'px';
                            style += `width: ${w}; `;

                            if (dimMatch[2] && dimMatch[2] !== 'auto') {
                                let h = dimMatch[2];
                                if (!isNaN(h)) h += 'px';
                                style += `height: ${h}; object-fit: cover; `;
                            } else {
                                style += `height: auto; `;
                            }
                        }
                    });
                }

                const imgTag = `<img src="${url}" alt="${alt}" style="${style}" class="custom-md-image" />`;
                if (isCenter) return `<div style="text-align: center; width: 100%; clear: both; margin: 16px 0;">${imgTag}</div>`;
                return imgTag;
            });

            processedText = processedText.replace(/^={3,}\s*$/gm, '\n\n<hr class="custom-divider" />\n\n');
            processedText = processedText.replace(/^\/(center|right|left|justify)\s*\n([\s\S]*?)\n\/end/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
            processedText = processedText.replace(/^\/(center|right|left|justify)\s+(.+)$/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');

            processedText = processedText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, (match, text, color) => {
                const c = color.toLowerCase();
                if (c === 'white' || c === 'black' || c === '#fff' || c === '#ffffff' || c === '#000' || c === '#000000') {
                    return `<span class="adaptive-color">${text}</span>`;
                }
                return `<span style="color: ${color};">${text}</span>`;
            });

            // ✨ SMART WIKI-LINK PARSER: Determines valid vs dead links instantly
            processedText = processedText.replace(/\[\[(.*?)\]\]/g, (match, noteTitle) => {
                const cleanTitle = noteTitle.trim();
                const exists = notes.some(n => n.title.toLowerCase() === cleanTitle.toLowerCase());
                const linkClass = exists ? 'valid-link' : 'dead-link';
                const icon = exists ? 'file-symlink' : 'file-plus';
                return `<a href="#" class="internal-note-link ${linkClass}" data-note="${cleanTitle}"><i data-lucide="${icon}"></i>${cleanTitle}</a>`;
            });

            const htmlContent = marked.parse(processedText, { breaks: true, gfm: true });

            return DOMPurify.sanitize(htmlContent, {
                ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'g', 'defs', 'clipPath', 'use'],
                ADD_ATTR: ['style', 'class', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'width', 'height', 'x', 'y', 'xmlns', 'transform', 'fill-rule', 'clip-rule', 'data-note']
            });
        }

        function injectCopyButtons(container) {
            container.querySelectorAll('pre').forEach((pre) => {
                if (pre.querySelector('.copy-code-btn')) return;

                const btn = document.createElement('button');
                btn.className = 'copy-code-btn';
                btn.innerHTML = '<i data-lucide="copy"></i>';
                btn.title = "Copy Code";

                btn.addEventListener('click', () => {
                    const codeBlock = pre.querySelector('code');
                    if (codeBlock) {
                        navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                            btn.innerHTML = '<i data-lucide="check" style="color: #10b981;"></i>';
                            if (window.lucide) lucide.createIcons();

                            setTimeout(() => {
                                btn.innerHTML = '<i data-lucide="copy"></i>';
                                if (window.lucide) lucide.createIcons();
                            }, 2000);

                            if (window.showToast) window.showToast("<i data-lucide='check-circle'></i> Code copied!");
                        });
                    }
                });
                pre.appendChild(btn);
            });
        }

        // ✨ CLICK LISTENERS FOR INTERNAL LINKS ✨
        function attachInternalLinkListeners(container) {
            container.querySelectorAll('.internal-note-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetTitle = link.getAttribute('data-note');
                    const targetNote = notes.find(n => n.title.toLowerCase() === targetTitle.toLowerCase());
                    
                    if (targetNote) {
                        activeNoteId = targetNote.id;
                        highlightedNoteId = targetNote.id;
                        activeFolder = targetNote.folder || 'All Notes';
                        editor.value = targetNote.content;
                        saveLocalState();
                        
                        renderMarkdownCore(targetNote.content);
                        
                        if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
                        if (typeof window.renderNotesList === 'function') window.renderNotesList();
                        
                        if (document.getElementById('notes-modal')?.classList.contains('show')) {
                            window.renderDashboardPreview();
                        } else {
                            if (window.showToast) window.showToast("<i data-lucide='external-link'></i> Opened: " + targetNote.title);
                        }
                    } else {
                        // User clicked a non-existent note - open prompt to create it!
                        if (window.showToast) window.showToast("<i data-lucide='info'></i> Note doesn't exist. Create it now!");
                        const promptModal = document.getElementById('prompt-modal');
                        const promptInput = document.getElementById('prompt-input');
                        if (promptModal && promptInput) {
                            promptInput.value = targetTitle;
                            promptModal.classList.add('show');
                            setTimeout(() => { promptInput.focus(); promptInput.select(); }, 100);
                        }
                    }
                });
            });
        }

        window.renderDashboardPreview = async function () {
            const previewEl = document.getElementById('dashboard-preview-output');
            const note = notes.find(n => n.id === highlightedNoteId);

            if (!note || !previewEl) {
                if (previewEl) previewEl.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">No note selected</div>`;
                return;
            }

            await new Promise(res => setTimeout(res, 0));

            previewEl.innerHTML = customMarkdownParser(note.content);
            if (typeof renderMathInElement === 'function') {
                renderMathInElement(previewEl, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
            }

            injectCopyButtons(previewEl);
            attachInternalLinkListeners(previewEl); // Attach listeners to the dashboard preview too!

            if (typeof hljs !== 'undefined') {
                previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            }
            if (window.lucide) lucide.createIcons();
        };

        // ✨ SAFE NOTE SWITCHING (Saves local changes before swapping) ✨
        document.getElementById('dash-btn-edit')?.addEventListener('click', async () => {
            if (!highlightedNoteId) return;
            
            // Save current memory to DB before swapping
            if (getActiveNote() && editor.value !== getActiveNote().content) {
                getActiveNote().content = editor.value;
                getActiveNote().lastUpdated = Date.now();
                await saveLocalState();
                if(isAutoSave && appMode === 'github') triggerCloudSync();
            }

            activeNoteId = highlightedNoteId;
            await saveLocalState();
            editor.value = getActiveNote().content;
            renderMarkdownCore(editor.value);
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
        });

        document.getElementById('dash-btn-delete')?.addEventListener('click', () => {
            if (!highlightedNoteId) return;
            noteToDeleteId = highlightedNoteId;
            document.getElementById('delete-modal').classList.add('show');
        });

        document.getElementById('dash-btn-export')?.addEventListener('click', async () => {
            if (!highlightedNoteId) return;
            activeNoteId = highlightedNoteId;
            await saveLocalState();
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
            if (idx === -1) return;

            const noteToDelete = notes[idx];
            notes.splice(idx, 1);

            if (activeNoteId === noteToDeleteId) {
                activeNoteId = notes.length > 0 ? notes[Math.max(0, idx - 1)].id : null;
                if (activeNoteId) editor.value = getActiveNote().content;
                else editor.value = "";
            }

            if (highlightedNoteId === noteToDeleteId) {
                let displayNotes = activeFolder === 'All Notes' ? notes : notes.filter(n => n.folder === activeFolder);
                highlightedNoteId = displayNotes.length > 0 ? displayNotes[0].id : null;
            }

            if (appMode === 'github' && noteToDelete.path) {
                if (navigator.onLine) {
                    GitHubBackend.deleteNote(noteToDelete.path, noteToDelete.id).catch(() => {
                        OfflineQueue.add('delete', { path: noteToDelete.path, sha: noteToDelete.id });
                    });
                } else {
                    OfflineQueue.add('delete', { path: noteToDelete.path, sha: noteToDelete.id });
                }
            }

            if (notes.length === 0) {
                const id = Date.now().toString();
                notes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: defaultWelcomeNote, lastUpdated: Date.now() }];
                activeNoteId = id;
                editor.value = notes[0].content;
            }

            await saveLocalState();
            await StorageManager.deleteNote(noteToDeleteId);

            renderMarkdownCore(editor.value);
            window.renderFoldersList();
            window.renderNotesList();

            noteToDeleteId = null;
            if (typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
            if (window.showToast) window.showToast("<i data-lucide='trash-2'></i> Note deleted");
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
            if (!folderName) return window.showToast("Folder name cannot be empty.");
            if (folders.includes(folderName)) return window.showToast("Folder already exists.");

            folders.push(folderName);
            activeFolder = folderName;
            saveFolders();

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

            await executeNoteCreation({ id: newId, path: generatedPath, folder: folder, title: noteName, content: content, lastUpdated: Date.now() });
        };

        async function executeNoteCreation(noteData) {
            notes.unshift(noteData);
            activeNoteId = noteData.id;
            highlightedNoteId = noteData.id;
            editor.value = noteData.content;

            await saveLocalState();
            renderMarkdownCore(noteData.content);
            window.renderFoldersList();
            window.renderNotesList();

            promptModal.classList.remove('show');
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();

            if (isAutoSave && appMode === 'github') triggerCloudSync();
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

        document.getElementById('conflict-overwrite')?.addEventListener('click', async () => {
            if (!pendingNewNoteData) return;
            let exNote = notes.find(n => n.id === pendingNewNoteData.existingId);
            if (exNote) {
                exNote.content = pendingNewNoteData.content;
                exNote.lastUpdated = Date.now();
                activeNoteId = exNote.id;
                highlightedNoteId = exNote.id;
                editor.value = exNote.content;

                await saveLocalState();
                renderMarkdownCore(exNote.content);
                window.renderNotesList();
                if (isAutoSave && appMode === 'github') triggerCloudSync();
                window.showToast("<i data-lucide='copy'></i> Note Overwritten!");
            }
            document.getElementById('conflict-modal').classList.remove('show');
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
            pendingNewNoteData = null;
        });

        // ✨ DYNAMIC DEBOUNCER (Respects AutoSave Toggle) ✨
        function getDynamicDebounceTime(textLength) {
            if (textLength > 200000) return 1500; 
            if (textLength > 50000) return 800;   
            return 300;                           
        }

        let debounceTimeout;
        function dynamicDebounce(rawText) {
            clearTimeout(debounceTimeout);
            const waitTime = getDynamicDebounceTime(rawText.length);
            
            debounceTimeout = setTimeout(async () => {
                const activeNote = getActiveNote();
                if (activeNote) {
                    activeNote.content = rawText; // ALWAYS update memory
                    activeNote.lastUpdated = Date.now();
                    
                    // ONLY trigger heavy IndexedDB/GitHub writes if Auto-Save is ON
                    if (isAutoSave) {
                        await saveLocalState(); 
                        triggerCloudSync(); 
                    }
                }
                renderMarkdownCore(rawText);
            }, waitTime);
        }

        function updateLiveStats(text) {
            if (typeof text !== 'string') return;
            const chars = text.length;
            const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
            
            const wEl = document.getElementById('stat-words');
            const cEl = document.getElementById('stat-chars');
            const rEl = document.getElementById('stat-reading-time');
            
            if (wEl) wEl.textContent = `${words} Words`;
            if (cEl) cEl.textContent = `${chars} Characters`;
            if (rEl) rEl.textContent = `${Math.max(1, Math.ceil(words / 200))} min read`;
        }

        async function renderMarkdownCore(rawText) {
            updateLiveStats(rawText);
            
            await new Promise(resolve => setTimeout(resolve, 0));
            
            preview.innerHTML = customMarkdownParser(rawText);
            
            await new Promise(resolve => setTimeout(resolve, 0));
            if (typeof renderMathInElement === 'function') {
                renderMathInElement(preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
            }
            
            injectCopyButtons(preview);
            attachInternalLinkListeners(preview); 

            if (typeof hljs !== 'undefined') {
                preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            }
            if (window.lucide) lucide.createIcons();

            if (highlightedNoteId === activeNoteId && document.getElementById('notes-modal')?.classList.contains('show')) {
                window.renderDashboardPreview();
            }
        }

        editor.addEventListener('input', () => {
            dynamicDebounce(editor.value);
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
                else if (action === 'note-link') { prefix = '[['; suffix = ']]'; defaultText = 'Note Name'; }
                else if (action === 'image') { prefix = '!['; suffix = '](https://example.com/image.jpg){center, 400xauto}'; defaultText = 'alt text'; }
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
            reader.onload = async (e) => {
                const content = e.target.result;
                const rawTitle = file.name.replace('.md', '').replace('.txt', '');
                const folder = activeFolder;
                const newPath = generatePath(folder, rawTitle);
                const newId = Date.now().toString();
                
                if(notes.find(n => n.path === newPath)) {
                    window.showToast("<i data-lucide='alert-triangle'></i> File already exists. Rename file first.");
                    return;
                }

                notes.unshift({ id: newId, path: newPath, folder: folder, title: rawTitle, content: content, lastUpdated: Date.now() });
                activeNoteId = newId;
                highlightedNoteId = newId;
                editor.value = content;

                await saveLocalState();
                renderMarkdownCore(content);
                if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
                if (typeof window.renderNotesList === 'function') window.renderNotesList();
                window.showToast("<i data-lucide='file-up'></i> Document imported locally!");

                if (isAutoSave && appMode === 'github') triggerCloudSync();
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

                notes.unshift({ id: sharedId, path: sharedPath, folder: 'All Notes', title: sharedTitle, content: decodedText, lastUpdated: Date.now() });
                activeNoteId = sharedId;
                highlightedNoteId = sharedId;
                saveLocalState().then(() => {
                    window.showToast("<i data-lucide='download'></i> Shared document saved!");
                    history.replaceState(null, null, ' ');
                });
            } catch (e) { console.error("Invalid import link", e); }
        }

        inputFilename?.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnConfirmPdf.click(); });

        btnConfirmPdf?.addEventListener('click', () => {
            let fileName = inputFilename.value.trim() || getActiveNote().title || "Document";
            if (typeof window.closePdfModal === "function") window.closePdfModal();

            const style = document.createElement('style');
            let pageCss = "";

            if (window.selectedPageSize === 'A4') { 
                pageCss = `@page { size: A4 portrait; margin: 0; } #preview-output { padding: 24px 48px !important; }`; 
            }
            else if (window.selectedPageSize === 'A2') { 
                pageCss = `@page { size: A2 portrait; margin: 0; } #preview-output { padding: 36px 64px !important; font-size: 1.2rem !important; }`; 
            }
            else if (window.selectedPageSize === 'Infinity') {
                const previewEl = document.getElementById('preview-output');
                const previewPanel = document.getElementById('preview-panel');
                
                const isHidden = window.getComputedStyle(previewPanel).display === 'none';
                if (isHidden) {
                    previewPanel.style.setProperty('display', 'block', 'important');
                    previewPanel.style.setProperty('position', 'absolute', 'important');
                    previewPanel.style.setProperty('visibility', 'hidden', 'important');
                    previewPanel.style.setProperty('z-index', '-1000', 'important');
                }

                const contentHeightPx = previewEl.scrollHeight;

                if (isHidden) {
                    previewPanel.style.removeProperty('display');
                    previewPanel.style.removeProperty('position');
                    previewPanel.style.removeProperty('visibility');
                    previewPanel.style.removeProperty('z-index');
                }

                const contentHeightMm = Math.max(Math.ceil(contentHeightPx * 0.264583) + 40, 297); 
                pageCss = `@page { size: 210mm ${contentHeightMm}mm; margin: 0; } #preview-output { padding: 24px 48px !important; }`;
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
            }, 400); 
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

    }, 50); 
});