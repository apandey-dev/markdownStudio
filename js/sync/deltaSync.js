/* js/sync/deltaSync.js */
import GitHubBackend from '../core/githubClient.js';
import StorageManager from '../storage/indexedDB.js';
import ConflictResolver from './conflictResolver.js';

const DeltaSync = {
    async runSync() {
        if (!navigator.onLine || !GitHubBackend.isConfigured) return;

        try {
            const lastSyncState = await StorageManager.getSyncState('lastSyncCommit');
            const lastSyncCommitSha = lastSyncState ? lastSyncState.sha : null;

            const refRes = await fetch(`https://api.github.com/repos/${GitHubBackend.repoOwner}/${GitHubBackend.repoName}/git/refs/heads/${GitHubBackend.defaultBranch}`, {
                headers: { 'Authorization': `token ${GitHubBackend.token}` }
            });
            if (!refRes.ok) return;
            const refData = await refRes.json();
            const currentCommitSha = refData.object.sha;

            if (lastSyncCommitSha === currentCommitSha) {
                console.log("Sync: Already up to date.");
                return;
            }

            if (!lastSyncCommitSha) {
                await this.fullSync();
            } else {
                await this.performDeltaSync(lastSyncCommitSha, currentCommitSha);
            }

            await StorageManager.setSyncState('lastSyncCommit', { sha: currentCommitSha });
        } catch (error) {
            console.error("Delta Sync Error:", error);
        }
    },

    async fullSync() {
        const metadata = await GitHubBackend.getFile('metadata/index.json');
        if (!metadata) return;

        const metadataObj = JSON.parse(metadata.content);
        const notes = [];

        for (const noteEntry of metadataObj.notes) {
            const path = GitHubBackend.getHashedPath(noteEntry.id);
            const contentData = await GitHubBackend.getFile(path);
            if (contentData) {
                notes.push({
                    id: noteEntry.id,
                    title: noteEntry.title,
                    folder: noteEntry.folder,
                    content: contentData.content,
                    sha: contentData.sha,
                    lastUpdated: noteEntry.lastUpdated,
                    _mode: 'github'
                });
            }
        }

        await StorageManager.saveNotes(notes, 'github');
    },

    async performDeltaSync(base, head) {
        const compareRes = await fetch(`https://api.github.com/repos/${GitHubBackend.repoOwner}/${GitHubBackend.repoName}/compare/${base}...${head}`, {
            headers: { 'Authorization': `token ${GitHubBackend.token}` }
        });
        if (!compareRes.ok) return;
        const compareData = await compareRes.json();
        const files = compareData.files;

        // Fetch all local notes once to optimize lookups
        const localNotes = await StorageManager.getAllNotes('github') || [];
        const localNotesMap = new Map(localNotes.map(n => [n.id, n]));

        for (const file of files) {
            if (file.filename.startsWith('notes/') && file.filename.endsWith('.md')) {
                const noteId = file.filename.split('/').pop().replace('.md', '');

                if (file.status === 'removed') {
                    await StorageManager.deleteNote(noteId);
                } else {
                    const contentData = await GitHubBackend.getFile(file.filename);
                    if (contentData) {
                        const existingNote = localNotesMap.get(noteId);
                        const updatedNote = {
                            id: noteId,
                            content: contentData.content,
                            sha: contentData.sha,
                            _mode: 'github'
                        };

                        if (existingNote) {
                            updatedNote.title = existingNote.title;
                            updatedNote.folder = existingNote.folder;
                            updatedNote.lastUpdated = existingNote.lastUpdated;
                        }

                        await StorageManager.saveNotes([updatedNote], 'github');
                    }
                }
            } else if (file.filename === 'metadata/index.json') {
                const metadata = await GitHubBackend.getFile('metadata/index.json');
                const metadataObj = JSON.parse(metadata.content);

                for (const noteEntry of metadataObj.notes) {
                    const ln = localNotesMap.get(noteEntry.id);
                    if (ln) {
                        ln.title = noteEntry.title;
                        ln.folder = noteEntry.folder;
                        ln.lastUpdated = noteEntry.lastUpdated;
                    }
                }
                await StorageManager.saveNotes(Array.from(localNotesMap.values()), 'github');
            }
        }
    }
};

export default DeltaSync;
