/* js/notes/noteCRUD.js */
import StorageManager from '../storage/indexedDB.js';
import GitHubBackend from '../core/githubClient.js';
import OfflineQueue from '../storage/offlineQueue.js';

const NoteCRUD = {
    notes: [],
    activeNoteId: null,

    async saveLocalState(mode) {
        if (!this.activeNoteId && this.notes.length > 0) {
            this.activeNoteId = this.notes[0].id;
        }
        StorageManager.safeSetLocal(`md_active_${mode}`, this.activeNoteId);
        await StorageManager.saveNotes(this.notes, mode);
    },

    getActiveNote() {
        if (this.notes.length === 0) return null;
        let n = this.notes.find(n => n.id === this.activeNoteId);
        if (!n && this.notes.length > 0) {
            this.activeNoteId = this.notes[0].id;
            n = this.notes[0];
        }
        return n;
    },

    async deleteNote(id, appMode) {
        const idx = this.notes.findIndex(n => n.id === id);
        if (idx === -1) return;

        const noteToDelete = this.notes[idx];
        this.notes.splice(idx, 1);

        if (this.activeNoteId === id) {
            this.activeNoteId = this.notes.length > 0 ? this.notes[Math.max(0, idx - 1)].id : null;
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

        await this.saveLocalState(appMode);
        await StorageManager.deleteNote(id);
    }
};

export default NoteCRUD;
