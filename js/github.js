/* ==========================================================================
   GITHUB SYNC CONTROLLER (Zero-Backend)
   Handles all API calls to GitHub (Fetch, Create, Update, Delete notes)
   ========================================================================== */

const GitHubBackend = {
    token: null,
    repoOwner: '',
    repoName: 'markdown-studio-notes',
    isConfigured: false,

    // Robust Base64 Helpers for full Unicode & Emoji support
    utf8_to_b64(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
    },
    b64_to_utf8(str) {
        return decodeURIComponent(atob(str).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    },

    // 1. Initialize and Verify Token
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

    // 2. Auto-create Private Repo if it doesn't exist
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
                const contentRes = await fetch(file.url, {
                    headers: { 'Authorization': `token ${this.token}` }
                });
                const contentData = await contentRes.json();

                const rawContent = this.b64_to_utf8(contentData.content);
                const match = rawContent.match(/^#+\s+(.*)/m);
                let title = file.name.replace('.md', '');

                if (match && match[1]) {
                    let extracted = match[1].replace(/\[([^\]]+)\]\s*\{\s*[a-zA-Z0-9#]+\s*\}/g, '$1').trim();
                    title = extracted.length > 30 ? extracted.substring(0, 30) + '...' : extracted;
                }

                notes.push({
                    id: file.sha,
                    title: title,
                    content: rawContent,
                    path: file.path,
                    lastUpdated: Date.now()
                });
            }
            return notes.reverse();
        } catch (error) {
            console.error("Fetch Notes Error:", error);
            return [];
        }
    },

    // 4. Save/Update Note 
    async saveNote(noteId, existingPath, title, content) {
        if (!this.isConfigured) return null;

        let path = existingPath;
        if (!path) {
            let safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            if (!safeTitle) safeTitle = 'untitled';
            path = `${safeTitle}_${Date.now().toString().slice(-4)}.md`;
        }

        const bodyData = {
            message: `Auto-saved note: ${title}`,
            content: this.utf8_to_b64(content)
        };

        if (noteId && noteId !== 'new' && noteId !== 'temp') {
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

            if (res.ok) {
                return { sha: data.content.sha, path: data.content.path };
            } else {
                console.error("GitHub Update Conflict / Error", data);
                return null;
            }
        } catch (error) {
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
        } catch (e) {
            return false;
        }
    }
};