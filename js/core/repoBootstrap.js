/* js/core/repoBootstrap.js */
import GitHubBackend from './githubClient.js';

const RepoBootstrap = {
    async initRepo() {
        if (!GitHubBackend.token) return false;

        const res = await fetch(`https://api.github.com/repos/${GitHubBackend.repoOwner}/${GitHubBackend.repoName}`, {
            headers: { 'Authorization': `token ${GitHubBackend.token}` }
        });

        if (res.status === 404) {
            await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${GitHubBackend.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: GitHubBackend.repoName,
                    description: "Private notes synced from Markdown Studio",
                    private: true,
                    auto_init: true
                })
            });
            await new Promise(r => setTimeout(r, 2000));
        }

        await this.ensureFile('metadata/index.json', JSON.stringify({ notes: [] }, null, 2));
        await this.ensureFile('shared/shared_notes.json', JSON.stringify({ shared: [] }, null, 2));

        GitHubBackend.isConfigured = true;
        return true;
    },

    async ensureFile(path, content) {
        const res = await fetch(`https://api.github.com/repos/${GitHubBackend.repoOwner}/${GitHubBackend.repoName}/contents/${path}`, {
            headers: { 'Authorization': `token ${GitHubBackend.token}` }
        });

        if (res.status === 404) {
            const encodedContent = GitHubBackend.utf8_to_b64(content);
            await fetch(`https://api.github.com/repos/${GitHubBackend.repoOwner}/${GitHubBackend.repoName}/contents/${path}`, {
                method: 'PUT',
                headers: { 'Authorization': `token ${GitHubBackend.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Initial bootstrap: ${path}`,
                    content: encodedContent
                })
            });
        }
    }
};

export default RepoBootstrap;
