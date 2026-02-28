/* ==========================================================================
   GITHUB SYNC CONTROLLER (Zero-Backend)
   Description: Handles all API calls to GitHub (Fetch, Create, Delete notes)
   ========================================================================== */

const GitHubBackend = {
    token: null,
    repoOwner: '',
    repoName: 'markdown-studio-notes', // Name of the repo created automatically
    isConfigured: false,

    // Base64 Helpers for Unicode (Emoji) support
    utf8_to_b64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    },
    b64_to_utf8(str) {
        return decodeURIComponent(escape(window.atob(str)));
    },

    // 1. Initialize and Verify Token
    async init(token) {
        this.token = token;
        try {
            // Get user info
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${this.token}` }
            });
            
            if (!userRes.ok) throw new Error('Invalid Token');
            
            const userData = await userRes.json();
            this.repoOwner = userData.login;

            // Check if repo exists, if not, create it
            await this.checkAndCreateRepo();
            
            this.isConfigured = true;
            localStorage.setItem('md_github_token', token);
            return true;

        } catch (error) {
            console.error("GitHub Init Error:", error);
            return false;
        }
    },

    // 2. Auto-create Private Repo if it doesn't exist
    async checkAndCreateRepo() {
        const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}`, {
            headers: { 'Authorization': `token ${this.token}` }
        });

        if (res.status === 404) {
            // Repo not found, create a private one
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
            console.log("Created new private repository for notes!");
        }
    },

    // 3. Fetch all Notes from Repo
    async getAllNotes() {
        if (!this.isConfigured) return [];
        
        try {
            const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            
            if (!res.ok) return [];
            
            const files = await res.json();
            const mdFiles = files.filter(f => f.name.endsWith('.md'));
            
            let notes = [];
            for (let file of mdFiles) {
                // Fetch actual content of each file
                const contentRes = await fetch(file.url, {
                    headers: { 'Authorization': `token ${this.token}` }
                });
                const contentData = await contentRes.json();
                
                const rawContent = this.b64_to_utf8(contentData.content);
                // Extract Title from content
                const match = rawContent.match(/^#+\s+(.*)/m);
                const title = match ? match[1].replace(/\[([^\]]+)\]\s*\{\s*[a-zA-Z0-9#]+\s*\}/g, '$1').substring(0, 30) : file.name.replace('.md', '');
                
                notes.push({
                    id: file.sha, // We use SHA as ID for GitHub files
                    title: title,
                    content: rawContent,
                    path: file.path,
                    lastUpdated: Date.now() // Approximated
                });
            }
            // Sort by newest first
            return notes.reverse();
        } catch (error) {
            console.error("Fetch Notes Error:", error);
            return [];
        }
    },

    // 4. Save/Update Note
    async saveNote(noteId, title, content) {
        if (!this.isConfigured) return null;
        
        // Generate a safe filename
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled';
        const path = `${safeTitle}_${Date.now().toString().slice(-6)}.md`; 

        const bodyData = {
            message: `Auto-saved note: ${title}`,
            content: this.utf8_to_b64(content)
        };

        if (noteId && noteId !== 'new') {
            bodyData.sha = noteId; 
        }

        try {
            const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            return data.content.sha; // Return new SHA to update ID locally
        } catch(error) {
            console.error("Save Error:", error);
            return null;
        }
    },

    // 5. Delete Note
    async deleteNote(path, sha) {
        if (!this.isConfigured) return false;
        try {
            await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: "Deleted via Markdown Studio",
                    sha: sha
                })
            });
            return true;
        } catch(e) {
            return false;
        }
    }
};