import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Note, Folder } from '../store/useNotesStore';

export class AppDatabase extends Dexie {
  notes!: Table<Note, string>;
  syncState!: Table<{ id: string; lastSyncCommit: string }, string>;

  constructor() {
    super('markdownStudioDB');
    this.version(1).stores({
      notes: 'id',
      syncState: 'id'
    });
  }
}

export const db = new AppDatabase();

export const StorageService = {
  async init() {
    return new Promise<boolean>((resolve) => {
      try {
        db.open().then(() => resolve(true)).catch(() => resolve(false));
      } catch {
        resolve(false);
      }
    });
  },

  async saveNotes(notes: Note[], useIDB: boolean, mode: 'local' | 'github'): Promise<boolean> {
    try {
      const preparedNotes = notes.map(n => ({
        ...n,
        lastUpdated: n.lastUpdated || Date.now(),
        _mode: mode
      }));

      // Auto-migrate threshold check (3MB limit logic from original)
      const totalSize = preparedNotes.reduce((acc, n) => acc + (n.content?.length || 0), 0);
      let targetIDB = useIDB;

      if (!targetIDB && totalSize > 3 * 1024 * 1024) {
        targetIDB = true;
        localStorage.setItem('md_storage_preference', 'indexedDB');
      }

      if (targetIDB) {
        await db.notes.bulkPut(preparedNotes);
        return true;
      } else {
        const key = mode === 'local' ? 'md_notes_local' : 'md_notes_github';
        localStorage.setItem(key, JSON.stringify(preparedNotes));
        return true;
      }
    } catch (e) {
      console.error('Save failed', e);
      return false;
    }
  },

  async loadNotes(useIDB: boolean, mode: 'local' | 'github'): Promise<Note[]> {
    try {
      if (useIDB) {
        const allNotes = await db.notes.toArray();
        return allNotes.filter(n => n._mode === mode || !n._mode);
      } else {
        const key = mode === 'local' ? 'md_notes_local' : 'md_notes_github';
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
      }
    } catch (e) {
      console.error('Load failed', e);
      return [];
    }
  },

  saveFolders(folders: Folder[]) {
    localStorage.setItem('md_folders', JSON.stringify(folders));
  },

  loadFolders(): Folder[] {
    const data = localStorage.getItem('md_folders');
    return data ? JSON.parse(data) : [];
  },

  async setSyncState(commitHash: string) {
    try {
      await db.syncState.put({ id: 'lastSyncCommit', lastSyncCommit: commitHash });
    } catch (e) {
      console.error('Set sync state failed', e);
    }
  },

  async getSyncState(): Promise<string | null> {
    try {
      const record = await db.syncState.get('lastSyncCommit');
      return record ? record.lastSyncCommit : null;
    } catch (e) {
      return null;
    }
  }
};
