/* js/editor-state.js */
/* ==========================================================================
   STORAGE MANAGER (IndexedDB Migration + Quota Handling)
   ========================================================================== */
window.StorageManager = {
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
                    window.showToast("<i data-lucide='alert-triangle'></i> Storage Full!");
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
                if (window.showToast) window.showToast("<i data-lucide='database'></i> Saved to Local DB");
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
window.OfflineQueue = {
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
        window.StorageManager.safeSetLocal(this.key, JSON.stringify(q));
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

        window.StorageManager.safeSetLocal(this.key, JSON.stringify(remaining));
        this.isProcessing = false;
    }
};

/* ==========================================================================
   EDITOR STATE MANAGEMENT
   ========================================================================== */
window.EditorState = {
    notes: [],
    folders: ['All Notes'],
    activeFolder: 'All Notes',
    activeNoteId: null,

    appMode: 'local',
    autoSave: true,
    isSyncing: false,
    pendingSync: false,
    syncTimer: null,
    syncRetries: 0,
    MAX_SYNC_RETRIES: 3,

    // Default welcome note content
    defaultWelcomeNote: `# Welcome to Markdown Studio 🖤\n\nYour premium workspace.\n\n## [ ✨ Features ]{#3b82f6}\n* **💻 Code Blocks:** Hover over code to copy it!\n* **🖼️ Pro Images:** \`![alt](url){300x400, center}\`\n* **🧠 Wiki Links:** Type \`[[Note Name]]\` to link notes!\n\n## 🧪 Testing Zone\n\n**1. Copy Code Feature**\n\`\`\`javascript\nfunction greet(name) {\n  console.log("Hello, " + name + "!");\n}\ngreet("Markdown Studio");\n\`\`\`\n\n**2. Responsive Image (Left Aligned, 200px)**\n![Nature](https://images.unsplash.com/photo-1506744626753-143d4e8c1874?q=80&w=300&auto=format&fit=crop){200, left}\nThis text automatically wraps around the right side of the beautiful nature image because we used the \`{200, left}\` syntax.\n\n**3. Custom Raw SVG Icon**\n<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>\n\n/center **Enjoy writing!**`,

    loadFolders() {
        try {
            let saved = localStorage.getItem(`md_folders_${this.appMode}`);
            if (saved) this.folders = JSON.parse(saved);
            else this.folders = ['All Notes'];
        } catch (e) { this.folders = ['All Notes']; }
    },

    saveFolders() {
        window.StorageManager.safeSetLocal(`md_folders_${this.appMode}`, JSON.stringify(this.folders));
    },

    extractFoldersFromNotes() {
        let fSet = new Set(this.folders);
        fSet.add('All Notes');
        this.notes.forEach(n => {
            if (n.folder) fSet.add(n.folder);
        });
        this.folders = Array.from(fSet);
        this.saveFolders();
    },

    async saveLocalState() {
        const mode = this.appMode;
        window.StorageManager.safeSetLocal(`md_active_${mode}`, this.activeNoteId);
        await window.StorageManager.saveNotes(this.notes, mode);
    },

    getActiveNote() {
        let n = this.notes.find(n => n.id === this.activeNoteId);
        if (!n && this.notes.length > 0) {
            this.activeNoteId = this.notes[0].id;
            n = this.notes[0];
            this.saveLocalState();
        }
        return n;
    },

    getActiveNoteTitle() {
        const note = this.getActiveNote();
        return note ? note.title : "Document";
    },

    generatePath(folderName, title) {
        let safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim();
        if (!safeTitle) safeTitle = 'Untitled Note';
        if (folderName === 'All Notes') return `${safeTitle}.md`;
        return `${folderName}/${safeTitle}.md`;
    },

    loadAutoSave() {
        const saved = localStorage.getItem('md_auto_save');
        this.autoSave = saved !== 'false'; // Default to true
    },

    saveAutoSave() {
        localStorage.setItem('md_auto_save', this.autoSave);
        // Dispatch event for UI to update Save button visibility
        window.dispatchEvent(new CustomEvent('autoSaveToggled', { detail: { enabled: this.autoSave } }));
    },

    async switchToMode(targetMode) {
        const editor = document.getElementById('markdown-input');
        if (this.appMode === targetMode && editor.disabled === false) return;

        if (this.notes.length > 0) await this.saveLocalState();

        if (targetMode === 'github') {
            const token = localStorage.getItem('md_github_token');
            if (!token) {
                document.getElementById('setup-modal').classList.add('show');
                return;
            }

            this.appMode = 'github';
            localStorage.setItem('md_app_mode', 'github');
            document.querySelectorAll(`[data-target="github"]`).forEach(tab => tab.innerHTML = '<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> <span class="tab-text">Cloud</span>');
            if (window.lucide) lucide.createIcons();

            editor.disabled = true;
            document.body.classList.add('is-loading');
            await this.initGitHubMode(token);
        } else {
            this.appMode = 'local';
            localStorage.setItem('md_app_mode', 'local');
            editor.disabled = true;
            document.body.classList.add('is-loading');
            await this.loadLocalMode();
        }
    },

    async initGitHubMode(token) {
        this.loadFolders();
        const localCachedNotes = await window.StorageManager.getAllNotes('github') || [];

        if (localCachedNotes.length > 0) {
            this.notes = localCachedNotes;
            this.extractFoldersFromNotes();
            this.activeNoteId = localStorage.getItem('md_active_github') || this.notes[0]?.id;
            window.EditorCore.finishAppLoad();
        }

        const success = await GitHubBackend.init(token);
        if (success) {
            const cloudNotes = await GitHubBackend.getAllNotes();

            if (localCachedNotes.length === 0) {
                if (cloudNotes.length > 0) {
                    this.notes = cloudNotes;
                } else {
                    const result = await GitHubBackend.saveNote('new', 'Welcome.md', "Welcome", this.defaultWelcomeNote);
                    this.notes = [{ id: result?.sha || 'temp', path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: this.defaultWelcomeNote, lastUpdated: Date.now() }];
                }
                this.activeNoteId = this.notes[0]?.id;
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

                this.notes = Array.from(mergedMap.values()).sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

                if (addedOrUpdated) {
                    if (!this.notes.find(n => n.id === this.activeNoteId)) this.activeNoteId = this.notes[0]?.id;
                    if (document.getElementById('notes-modal').classList.contains('show')) {
                        window.EditorCore.renderFoldersList();
                        window.EditorCore.renderNotesList();
                    }
                }
            }

            this.extractFoldersFromNotes();
            await this.saveLocalState();
            window.EditorCore.finishAppLoad();
            window.EditorCore.updatePillUI();
            this.triggerCloudSync();

        } else {
            window.showToast("Working locally.");
            window.EditorCore.finishAppLoad();
        }
    },

    async loadLocalMode() {
        this.loadFolders();
        const cachedNotes = await window.StorageManager.getAllNotes('local');
        if (cachedNotes && cachedNotes.length > 0) {
            this.notes = cachedNotes;
            this.extractFoldersFromNotes();
            this.activeNoteId = localStorage.getItem('md_active_local') || this.notes[0]?.id;
        } else {
            const id = Date.now().toString();
            this.notes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: this.defaultWelcomeNote, lastUpdated: Date.now() }];
            this.folders = ['All Notes'];
            this.activeNoteId = id;
            await this.saveLocalState();
            this.saveFolders();
        }
        window.EditorCore.finishAppLoad();
        window.EditorCore.updatePillUI();
    },

    triggerCloudSync() {
        if (this.appMode !== 'github') return;
        this.pendingSync = true;
        window.EditorCore.updatePillUI();

        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(async () => {
            if (this.isSyncing) return;
            await this.performCloudSync();
        }, 2000);
    },

    async performCloudSync() {
        if (!this.pendingSync || this.appMode !== 'github' || this.isSyncing) return;

        if (!navigator.onLine) {
            this.pendingSync = true;
            window.EditorCore.updatePillUI();
            return;
        }

        this.isSyncing = true;
        window.EditorCore.updatePillUI();

        await window.OfflineQueue.process();

        try {
            const currentNote = this.getActiveNote();
            if (currentNote) {
                const result = await GitHubBackend.saveNote(currentNote.id, currentNote.path, currentNote.title, currentNote.content);
                if (result && result !== 'conflict') {
                    currentNote.id = result.sha;
                    currentNote.path = result.path;
                    await this.saveLocalState();
                    this.pendingSync = false;
                    this.syncRetries = 0;
                } else if (result === 'conflict') {
                    throw new Error("Conflict detected");
                } else {
                    throw new Error("Failed to save to cloud");
                }
            }
        } catch (e) {
            console.error("Sync Error:", e);
            this.pendingSync = true;
            this.syncRetries++;

            if (this.syncRetries <= this.MAX_SYNC_RETRIES) {
                const backoffTime = Math.pow(2, this.syncRetries) * 1000;
                clearTimeout(this.syncTimer);
                this.syncTimer = setTimeout(() => this.performCloudSync(), backoffTime);
            } else {
                if (window.showToast) window.showToast("<i data-lucide='wifi-off'></i> Offline");
            }
        } finally {
            this.isSyncing = false;
            window.EditorCore.updatePillUI();
            if (this.pendingSync && this.syncRetries === 0) this.triggerCloudSync();
        }
    }
};
