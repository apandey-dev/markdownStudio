/* js/core/authManager.js */
import GitHubBackend from './githubClient.js';

const AuthManager = {
    async login(token) {
        const success = await GitHubBackend.init(token);
        if (success) {
            localStorage.setItem('md_github_token', token);
            return true;
        } else {
            return false;
        }
    },

    getToken() {
        return localStorage.getItem('md_github_token');
    },

    logout() {
        localStorage.removeItem('md_github_token');
        localStorage.removeItem('md_app_mode');
    }
};

export default AuthManager;
