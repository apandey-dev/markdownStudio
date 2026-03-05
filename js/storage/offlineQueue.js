/* js/storage/offlineQueue.js */
import GitHubBackend from '../core/githubClient.js';
import StorageManager from './indexedDB.js';

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

export default OfflineQueue;
