/* js/notes/folderManager.js */
import StorageManager from '../storage/indexedDB.js';

const FolderManager = {
    folders: ['All Notes'],
    activeFolder: 'All Notes',

    loadFolders(appMode) {
        try {
            let saved = localStorage.getItem(`md_folders_${appMode}`);
            if (saved) this.folders = JSON.parse(saved);
            else this.folders = ['All Notes'];
        } catch (e) { this.folders = ['All Notes']; }
    },

    saveFolders(appMode) {
        StorageManager.safeSetLocal(`md_folders_${appMode}`, JSON.stringify(this.folders));
    },

    extractFoldersFromNotes(notes, appMode) {
        let fSet = new Set(this.folders);
        fSet.add('All Notes');
        notes.forEach(n => {
            if (n.folder) fSet.add(n.folder);
        });
        this.folders = Array.from(fSet);
        this.saveFolders(appMode);
    }
};

export default FolderManager;
