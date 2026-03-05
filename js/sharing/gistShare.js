/* js/sharing/gistShare.js */
import GitHubBackend from '../core/githubClient.js';
import NoteCRUD from '../notes/noteCRUD.js';

const GistShare = {
    async shareNote(noteId) {
        const note = NoteCRUD.notes.find(n => n.id === noteId);
        if (!note || !note.content.trim()) return { error: "Cannot share an empty note." };

        const token = localStorage.getItem('md_github_token');
        if (!token) {
            return { error: "GitHub token required" };
        }

        try {
            const secretKey = CryptoJS.lib.WordArray.random(16).toString();
            const encryptedText = CryptoJS.AES.encrypt(note.content, secretKey).toString();

            await GitHubBackend.init(token);
            const gistResult = await GitHubBackend.createSecretGist(encryptedText);

            if (gistResult && !gistResult.error) {
                const shareableUrl = `https://apandey-studio.vercel.app/share.html?id=${gistResult.id}#${secretKey}`;
                return { url: shareableUrl };
            } else {
                return { error: "Failed: Please ensure your PAT has 'gist' permission." };
            }
        } catch (err) {
            return { error: "An error occurred during encryption." };
        }
    }
};

export default GistShare;
