/* ==========================================================================
   GITHUB SYNC CONTROLLER (Zero-Backend)
   ========================================================================== */

window.GitHubBackend = {
    token: null,
    repoOwner: '',
    repoName: 'markdown-studio-notes', 
    isConfigured: false,

    utf8_to_b64(str) { return window.btoa(unescape(encodeURIComponent(str))); },
    b64_to_utf8(str) { return decodeURIComponent(escape(window.atob(str))); },

    async init(token) {
        if (this.isConfigured && this.token === token) return true; // Prevent duplicate logins
        
        this.token = token;
        try {
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!userRes.ok) throw new Error('Invalid Token or Missing Permissions');
            
            const userData = await userRes.json();
            this.repoOwner = userData.login;

            await this.checkAndCreateRepo();
            
            this.isConfigured = true;
            localStorage.setItem('md_github_token', token);
            return true;
        } catch (error) {
            console.error("GitHub Init Error:", error.message);
            this.isConfigured = false;
            return false;
        }
    },

    async checkAndCreateRepo() {
        const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}`, {
            headers: { 
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (res.status === 404) {
            console.log("Attempting to create private repository...");
            const createRes = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.repoName,
                    description: "Private notes synced automatically from Markdown Studio",
                    private: true,
                    auto_init: true
                })
            });

            if (!createRes.ok) throw new Error("Repo Creation Failed. Ensure 'repo' scope is checked!");
            await new Promise(resolve => setTimeout(resolve, 2000)); // Buffer time for GitHub servers
        } else if (!res.ok) {
             throw new Error("Failed to access repository.");
        }
    },

    async getAllNotes() {
        if (!this.isConfigured) return [];
        
        try {
            // ?t=${Date.now()} forcefully bypasses any browser cache
            const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents?t=${Date.now()}`, {
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Cache-Control': 'no-store, no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!res.ok) return [];
            
            const files = await res.json();
            const mdFiles = files.filter(f => f.name.endsWith('.md'));
            
            mdFiles.sort((a, b) => b.name.localeCompare(a.name)); // Sort by timestamp prefix

            // Parallel fast-fetching all note contents
            const notesPromises = mdFiles.map(async (file) => {
                const contentRes = await fetch(file.url, { headers: { 'Authorization': `token ${this.token}` }});
                const contentData = await contentRes.json();
                const rawContent = this.b64_to_utf8(contentData.content);
                
                const match = rawContent.match(/^#+\s+(.*)/m);
                const title = match ? match[1].replace(/\[([^\]]+)\]\s*\{\s*[a-zA-Z0-9#]+\s*\}/g, '$1').substring(0, 30) : file.name.replace('.md', '');
                
                return {
                    id: file.sha,
                    title: title,
                    content: rawContent,
                    path: file.path,
                    lastUpdated: Date.now()
                };
            });

            const notes = await Promise.all(notesPromises);
            return notes.sort((a, b) => b.path.localeCompare(a.path)); // Final strict sort

        } catch (error) {
            console.error("Fetch Notes Error:", error);
            return [];
        }
    },

    async saveNote(noteId, title, content, existingPath) {
        if (!this.isConfigured) return null;
        
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled';
        const path = existingPath || `${Date.now()}_${safeTitle}.md`; 

        const bodyData = {
            message: `Auto-saved note: ${title}`,
            content: this.utf8_to_b64(content)
        };

        if (noteId && noteId !== 'new') bodyData.sha = noteId; 

        try {
            const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bodyData)
            });
            if (!res.ok) throw new Error("Push failed");
            const data = await res.json();
            return { sha: data.content.sha, path: data.content.path }; 
        } catch(error) {
            console.error("Save Error:", error);
            return null;
        }
    },

    async deleteNote(path, sha) {
        if (!this.isConfigured) return false;
        try {
            await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: "Deleted via Markdown Studio", sha: sha })
            });
            return true;
        } catch(e) { return false; }
    }
};