/* js/storage/indexedDB.js */
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
                if (!db.objectStoreNames.contains("syncState")) {
                    db.createObjectStore("syncState", { keyPath: "key" });
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
    },

    async getSyncState(key) {
        if (!this.db) return null;
        return new Promise((resolve) => {
            const tx = this.db.transaction("syncState", "readonly");
            const store = tx.objectStore("syncState");
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    },

    async setSyncState(key, value) {
        if (!this.db) return false;
        return new Promise((resolve) => {
            const tx = this.db.transaction("syncState", "readwrite");
            const store = tx.objectStore("syncState");
            store.put({ key, ...value });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }
};

export default StorageManager;
