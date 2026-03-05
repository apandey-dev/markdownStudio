/* js/core/githubClient.js */
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

            const repoRes = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            if (repoRes.ok) {
                const repoData = await repoRes.json();
                this.defaultBranch = repoData.default_branch || 'main';
                this.isConfigured = true;
                return true;
            }
            return false;
        } catch (error) {
            console.error("GitHub Init Error:", error);
            return false;
        }
    },

    async getFile(path) {
        const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
            headers: { 'Authorization': `token ${this.token}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            content: this.b64_to_utf8(data.content),
            sha: data.sha
        };
    },

    async putFile(path, content, message, sha = null) {
        const body = {
            message: message,
            content: this.utf8_to_b64(content)
        };
        if (sha) body.sha = sha;

        const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return res.ok ? await res.json() : null;
    },

    async deleteNote(path, sha) {
        if (!this.isConfigured) return false;
        try {
            const res = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, {
                method: 'DELETE',
                headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "Deleted via Markdown Studio", sha: sha, branch: this.defaultBranch })
            });
            return res.ok;
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
    },

    getHashedPath(id) {
        const char1 = id.charAt(0) || 'z';
        const char2 = id.charAt(1) || 'z';
        return `notes/${char1}/${char2}/${id}.md`;
    }
};

export default GitHubBackend;
