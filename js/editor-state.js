/* js/editor-state.js */
/* ==========================================================================
   EDITOR STATE & STORAGE MANAGER
   Maintains application internal state and database layers safely.
   ========================================================================== */

// Renamed from StorageManager to AppStorageManager to prevent native browser API collisions
window.AppStorageManager = {
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

window.AppOfflineQueue = {
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
        window.AppStorageManager.safeSetLocal(this.key, JSON.stringify(q));
    },

    async process() {
        if (!navigator.onLine || !window.GitHubBackend?.isConfigured || this.isProcessing) return;
        const q = this.get();
        if (q.length === 0) return;

        this.isProcessing = true;
        let remaining = [];

        for (let op of q) {
            try {
                if (op.type === 'delete') {
                    await window.GitHubBackend.deleteNote(op.payload.path, op.payload.sha);
                }
            } catch (e) {
                console.error("Failed to process offline op:", e);
                remaining.push(op);
            }
        }

        window.AppStorageManager.safeSetLocal(this.key, JSON.stringify(remaining));
        this.isProcessing = false;
    }
};

// Explicit Global States
window.notes = [];
window.folders = ['All Notes'];
window.activeFolder = 'All Notes';
window.activeNoteId = null;
window.pendingDeleteData = { type: null, id: null };
window.highlightedNoteId = null;
window.pendingNewNoteData = null;
window.pendingRenameData = null;

window.appMode = 'local';
window.isSyncing = false;
window.pendingSync = false;
window.syncTimer = null;
window.syncRetries = 0;
window.MAX_SYNC_RETRIES = 3;

window.defaultWelcomeNote = `# Welcome to Markdown Studio 🖤\n\nYour premium workspace.\n\n## [ ✨ Features ]{#3b82f6}\n* **💻 Code Blocks:** Hover over code to copy it!\n* **🖼️ Pro Images:** \`![alt](url){300x400, center}\`\n* **🧠 Wiki Links:** Type \`[[Note Name]]\` to link notes!\n\n## 🧪 Testing Zone\n\n**1. Copy Code Feature**\n\`\`\`javascript\nfunction greet(name) {\n  console.log("Hello, " + name + "!");\n}\ngreet("Markdown Studio");\n\`\`\`\n\n**2. Responsive Image (Left Aligned, 200px)**\n![Nature](https://images.unsplash.com/photo-1506744626753-143d4e8c1874?q=80&w=300&auto=format&fit=crop){200, left}\nThis text automatically wraps around the right side of the beautiful nature image because we used the \`{200, left}\` syntax.\n\n**3. Custom Raw SVG Icon**\n<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>\n\n/center **Enjoy writing!**`;

// DOM Elements (Populated on Load)
window.editor = null;
window.previewPanel = null;
window.preview = null;
window.shareBtn = null;
window.btnConfirmPdf = null;
window.inputFilename = null;

// Global State Access Helpers
window.getActiveNote = function () {
    let n = window.notes.find(n => n.id === window.activeNoteId);
    if (!n && window.notes.length > 0) {
        window.activeNoteId = window.notes[0].id;
        n = window.notes[0];
        window.saveLocalState();
    }
    return n;
};

window.getActiveNoteTitle = function () { 
    const note = window.getActiveNote(); 
    return note ? note.title : "Document"; 
};

window.generatePath = function(folderName, title) {
    let safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim();
    if (!safeTitle) safeTitle = 'Untitled Note';
    if (folderName === 'All Notes') return `${safeTitle}.md`;
    return `${folderName}/${safeTitle}.md`;
};

window.loadFolders = function() {
    try {
        let saved = localStorage.getItem(`md_folders_${window.appMode}`);
        if (saved) window.folders = JSON.parse(saved);
        else window.folders = ['All Notes'];
    } catch (e) { window.folders = ['All Notes']; }
};

window.saveFolders = function() {
    window.AppStorageManager.safeSetLocal(`md_folders_${window.appMode}`, JSON.stringify(window.folders));
};

window.extractFoldersFromNotes = function() {
    let fSet = new Set(window.folders);
    fSet.add('All Notes');
    window.notes.forEach(n => {
        if (n.folder) fSet.add(n.folder);
    });
    window.folders = Array.from(fSet);
    window.saveFolders();
};

window.saveLocalState = async function() {
    const mode = window.appMode;
    window.AppStorageManager.safeSetLocal(`md_active_${mode}`, window.activeNoteId);
    await window.AppStorageManager.saveNotes(window.notes, mode);
};

// Available to trigger manually if custom sync logic is ever implemented.
window.triggerCloudSync = function() {
    if (window.appMode !== 'github') return;
    window.pendingSync = true;
    if (window.updatePillUI) window.updatePillUI();

    clearTimeout(window.syncTimer);
    window.syncTimer = setTimeout(async () => {
        if (window.isSyncing) return;
        await window.performCloudSync();
    }, 2000);
};

window.performCloudSync = async function() {
    if (!window.pendingSync || window.appMode !== 'github' || window.isSyncing) return;

    if (!navigator.onLine) {
        window.pendingSync = true;
        if (window.updatePillUI) window.updatePillUI();
        return;
    }

    window.isSyncing = true;
    if (window.updatePillUI) window.updatePillUI();

    await window.AppOfflineQueue.process();

    try {
        const currentNote = window.getActiveNote();
        if (currentNote) {
            const result = await window.GitHubBackend.saveNote(currentNote.id, currentNote.path, currentNote.title, currentNote.content);
            if (result && result !== 'conflict') {
                currentNote.id = result.sha;
                currentNote.path = result.path;
                await window.saveLocalState();
                window.pendingSync = false;
                window.syncRetries = 0;
            } else if (result === 'conflict') {
                throw new Error("Conflict detected");
            } else {
                throw new Error("Failed to save to cloud");
            }
        }
    } catch (e) {
        console.error("Sync Error:", e);
        window.pendingSync = true;
        window.syncRetries++;

        if (window.syncRetries <= window.MAX_SYNC_RETRIES) {
            const backoffTime = Math.pow(2, window.syncRetries) * 1000;
            clearTimeout(window.syncTimer);
            window.syncTimer = setTimeout(window.performCloudSync, backoffTime);
        } else {
            if (window.showToast) window.showToast("<i data-lucide='wifi-off'></i> Offline");
        }
    } finally {
        window.isSyncing = false;
        if (window.updatePillUI) window.updatePillUI();
        if (window.pendingSync && window.syncRetries === 0) window.triggerCloudSync();
    }
};