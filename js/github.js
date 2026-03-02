/* ==========================================================================
   GITHUB SYNC CONTROLLER (Zero-Backend)
   Handles API calls for Repos (Storage) and Gists (Secure Sharing)
   Supports Nested Folders (1-level deep)
   ========================================================================== */

const GitHubBackend = {
    token: null,
    repoOwner: '',
    repoName: 'markdown-studio-notes', 
    isConfigured: false,

    utf8_to_b64(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
        }));
    },
    b64_to_utf8(str) {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    },

    async init(token) {
        this.token = token;
        try {
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${this.token}` }
            });
            
            if (!userRes.ok) throw new Error('Invalid Token');
            
            const userData = await userRes.json();
            this.repoOwner = userData.login;

            await this.checkAndCreateRepo();
            this.isConfigured = true;
            return true;

        } catch (error) {
            console.error("GitHub Init Error:", error);
            return false;
        }
    },

    async checkAndCreateRepo() {
        const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}`, {
            headers: { 'Authorization': `token ${this.token}` }
        });

        if (res.status === 404) {
            await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.repoName,
                    description: "Private notes synced from Markdown Studio",
                    private: true,
                    auto_init: true
                })
            });
        }
    },

    async getAllNotes() {
        if (!this.isConfigured) return [];
        try {
            const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            if (!res.ok) return [];
            
            const rootItems = await res.json();
            let allMdFiles = [];

            rootItems.forEach(item => {
                if (item.type === 'file' && item.name.endsWith('.md')) {
                    item.folder = 'root';
                    allMdFiles.push(item);
                }
            });

            const folders = rootItems.filter(item => item.type === 'dir');
            for (let folder of folders) {
                const folderRes = await fetch(folder.url, { headers: { 'Authorization': `token ${this.token}` } });
                if (folderRes.ok) {
                    const folderItems = await folderRes.json();
                    folderItems.forEach(item => {
                        if (item.type === 'file' && item.name.endsWith('.md')) {
                            item.folder = folder.name; 
                            allMdFiles.push(item);
                        }
                    });
                }
            }
            
            let notes = [];
            for (let file of allMdFiles) {
                const contentRes = await fetch(file.url, { headers: { 'Authorization': `token ${this.token}` } });
                const contentData = await contentRes.json();
                
                const rawContent = this.b64_to_utf8(contentData.content);
                const title = file.name.replace('.md', ''); 
                
                notes.push({ 
                    id: file.sha, 
                    title: title, 
                    content: rawContent, 
                    path: file.path, 
                    folder: file.folder === 'root' ? 'All Notes' : file.folder, 
                    lastUpdated: Date.now() 
                });
            }
            return notes.reverse();
        } catch (error) {
            console.error("Fetch Notes Error:", error);
            return [];
        }
    },

    async saveNote(noteId, exactPath, title, content) {
        if (!this.isConfigured) return null;

        const attemptSave = async (sha) => {
            const bodyData = { message: `Auto-saved note: ${title}`, content: this.utf8_to_b64(content) };
            if (sha && sha !== 'new' && sha !== 'temp') bodyData.sha = sha; 

            const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${exactPath}`, {
                method: 'PUT',
                headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            
            if (res.status === 409) return 'conflict';
            
            if (res.ok) {
                const data = await res.json();
                return { sha: data.content.sha, path: data.content.path };
            }
            return null;
        };

        let result = await attemptSave(noteId);

        if (result === 'conflict') {
            try {
                const getRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${exactPath}`, {
                    headers: { 'Authorization': `token ${this.token}` }
                });
                if (getRes.ok) {
                    const getData = await getRes.json();
                    result = await attemptSave(getData.sha);
                } else {
                    result = null;
                }
            } catch (e) {
                result = null;
            }
        }
        return result;
    },

    async deleteNote(path, sha) {
        if (!this.isConfigured) return false;
        try {
            await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
                method: 'DELETE',
                headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "Deleted via Markdown Studio", sha: sha })
            });
            return true;
        } catch(e) { return false; }
    },

    async createSecretGist(encryptedContent) {
        if (!this.token) return { error: "No token provided" };
        try {
            const res = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: "Secure Encrypted Document | Markdown Studio",
                    public: false,
                    files: { "shared_document.enc": { content: encryptedContent } }
                })
            });
            
            if(!res.ok) return { error: "Permission missing (Needs 'gist' scope)" };
            const data = await res.json();
            return { id: data.id }; 
            
        } catch (err) {
            return { error: err.message };
        }
    }
};