/* ==========================================================================
   GITHUB SYNC CONTROLLER (Zero-Backend)
   Advanced Chunked Tree API loading for handling large repos without blocking.
   ========================================================================== */

const GitHubBackend = {
    token: null,
    repoOwner: '',
    repoName: 'markdown-studio-notes',
    defaultBranch: 'main',
    isConfigured: false,

    utf8_to_b64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        const chunkSize = 0x8000; 
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    },

    b64_to_utf8(str) {
        const cleanStr = str.replace(/\n/g, ''); 
        const binary = atob(cleanStr);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
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
            
            const repoRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            const repoData = await repoRes.json();
            this.defaultBranch = repoData.default_branch || 'main';

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
            await new Promise(r => setTimeout(r, 2000));
        }
    },

    async getTree() {
        const branchRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}`, {
            headers: { 'Authorization': `token ${this.token}` }
        });
        if (!branchRes.ok) return [];
        const repoData = await branchRes.json();
        const defaultBranch = repoData.default_branch;

        const treeRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/git/trees/${defaultBranch}?recursive=1`, {
            headers: { 'Authorization': `token ${this.token}` }
        });
        if (!treeRes.ok) return [];
        const treeData = await treeRes.json();
        
        return treeData.tree ? treeData.tree.filter(item => item.type === 'blob' && item.path.endsWith('.md')) : [];
    },

    async getAllNotes() {
        if (!this.isConfigured) return [];
        try {
            const fileTree = await this.getTree();
            let notes = [];
            
            const chunkSize = 5; 
            for (let i = 0; i < fileTree.length; i += chunkSize) {
                const chunk = fileTree.slice(i, i + chunkSize);
                
                const promises = chunk.map(async file => {
                    try {
                        const contentRes = await fetch(file.url, { 
                            headers: { 'Authorization': `token ${this.token}` } 
                        }); 
                        if (!contentRes.ok) return null;

                        const contentData = await contentRes.json();
                        const rawContent = this.b64_to_utf8(contentData.content || "");
                        
                        const parts = file.path.split('/');
                        const title = parts.pop().replace('.md', '');
                        const folder = parts.length > 0 ? parts.join('/') : 'All Notes';
                        
                        return { 
                            id: file.sha, 
                            title: title, 
                            content: rawContent, 
                            path: file.path, 
                            folder: folder, 
                            lastUpdated: Date.now() 
                        };
                    } catch (e) {
                        return null; 
                    }
                });
                
                const chunkResults = await Promise.all(promises);
                notes.push(...chunkResults.filter(n => n !== null));
                
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            return notes.reverse();
        } catch (error) {
            console.error("Fetch Notes Error:", error);
            return [];
        }
    },

    async saveNote(noteId, exactPath, title, content) {
        if (!this.isConfigured) return null;

        try {
            const refRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/git/refs/heads/${this.defaultBranch}`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            if (!refRes.ok) throw new Error("Could not fetch ref");
            const refData = await refRes.json();
            const latestCommitSha = refData.object.sha;

            const commitRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/git/commits/${latestCommitSha}`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            const commitData = await commitRes.json();
            const baseTreeSha = commitData.tree.sha;

            const encodedContent = this.utf8_to_b64(content);
            const blobRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/git/blobs`, {
                method: 'POST',
                headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: encodedContent, encoding: 'base64' })
            });
            if (!blobRes.ok) throw new Error("Could not create blob");
            const blobData = await blobRes.json();

            const treeRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/git/trees`, {
                method: 'POST',
                headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base_tree: baseTreeSha,
                    tree: [{
                        path: exactPath,
                        mode: '100644',
                        type: 'blob',
                        sha: blobData.sha
                    }]
                })
            });
            const treeData = await treeRes.json();

            const newCommitRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/git/commits`, {
                method: 'POST',
                headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Auto-saved note: ${title}`,
                    tree: treeData.sha,
                    parents: [latestCommitSha]
                })
            });
            const newCommitData = await newCommitRes.json();

            const updateRefRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/git/refs/heads/${this.defaultBranch}`, {
                method: 'PATCH',
                headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sha: newCommitData.sha })
            });
            
            if (updateRefRes.ok) {
                return { sha: blobData.sha, path: exactPath };
            }
            return null;
        } catch (error) {
            console.error("Save Note Error:", error);
            return null;
        }
    },

    async deleteNote(path, sha) {
        if (!this.isConfigured) return false;
        try {
            await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
                method: 'DELETE',
                headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "Deleted via Markdown Studio", sha: sha, branch: this.defaultBranch })
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