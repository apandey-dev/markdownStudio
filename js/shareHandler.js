/* ==========================================================================
   SHARE HANDLER – Mode‑Based Secure Sharing
   ========================================================================== */

/**
 * Generates a secure, expiring share token for a GitHub note.
 * Tokens are stored in localStorage with expiry. The actual note content
 * is never exposed in the token; only a reference (note ID and path) is stored.
 *
 * In Local Mode, sharing is blocked with a user‑friendly error.
 */

window.ShareHandler = (function() {
    // Token expiry in milliseconds (24 hours)
    const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

    // Storage key for tokens
    const STORAGE_KEY = 'md_studio_share_tokens';

    // Base URL for share links – FIXED DOMAIN
    const SHARE_BASE_URL = 'https://apandey-studio.vercel.app/share.html';

    /**
     * Load all share tokens from localStorage.
     * @returns {Object} Map of token -> { noteId, path, expiresAt }
     */
    function loadTokens() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    }

    /**
     * Save tokens to localStorage.
     * @param {Object} tokens
     */
    function saveTokens(tokens) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }

    /**
     * Generate a random secure token.
     * @returns {string} 32‑character hex token
     */
    function generateToken() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Clean up expired tokens.
     */
    function pruneExpiredTokens() {
        const tokens = loadTokens();
        const now = Date.now();
        let changed = false;
        Object.keys(tokens).forEach(key => {
            if (tokens[key].expiresAt <= now) {
                delete tokens[key];
                changed = true;
            }
        });
        if (changed) saveTokens(tokens);
    }

    /**
     * Create a share token for the given GitHub note.
     * @param {Object} note - The note object (must contain id and path)
     * @returns {string} The generated token
     */
    function createToken(note) {
        pruneExpiredTokens();
        const tokens = loadTokens();

        // Check if a token for this note already exists and is still valid
        const existing = Object.entries(tokens).find(([_, data]) =>
            data.noteId === note.id && data.expiresAt > Date.now()
        );
        if (existing) return existing[0]; // reuse existing token

        const token = generateToken();
        tokens[token] = {
            noteId: note.id,
            path: note.path,
            expiresAt: Date.now() + TOKEN_EXPIRY_MS
        };
        saveTokens(tokens);
        return token;
    }

    /**
     * Validate a share token.
     * @param {string} token
     * @returns {Object|null} Token data if valid and not expired, otherwise null
     */
    function validateToken(token) {
        pruneExpiredTokens();
        const tokens = loadTokens();
        const data = tokens[token];
        if (!data) return null;
        if (data.expiresAt <= Date.now()) {
            delete tokens[token];
            saveTokens(tokens);
            return null;
        }
        return data;
    }

    /**
     * Main share handler – called when the share button is clicked.
     * @param {Object} note - The currently active note
     * @param {string} mode - Current app mode ('local' or 'github')
     * @returns {Promise<void>}
     */
    async function handleShare(note, mode) {
        if (mode === 'local') {
            window.showToast?.(`<i data-lucide="alert-circle"></i> This feature is available only in GitHub Mode. Please login to enable sharing.`, 4000);
            return;
        }

        if (mode === 'github') {
            if (!note || !note.id) {
                window.showToast?.("<i data-lucide='alert-circle'></i> No note to share.", 3000);
                return;
            }

            // Ensure we have a valid GitHub path
            if (!note.path) {
                window.showToast?.("<i data-lucide='alert-circle'></i> Cannot share: missing note path.", 3000);
                return;
            }

            try {
                const token = createToken(note);
                const shareUrl = `${SHARE_BASE_URL}?shared=${token}`;

                // Use native share if available, otherwise copy to clipboard
                if (navigator.share) {
                    await navigator.share({
                        title: `Shared note: ${note.title}`,
                        text: `View this note in Markdown Studio`,
                        url: shareUrl
                    });
                } else {
                    await navigator.clipboard.writeText(shareUrl);
                    window.showToast?.("<i data-lucide='link'></i> Share link copied to clipboard!", 3000);
                }
            } catch (error) {
                console.error('Share error:', error);
                window.showToast?.("<i data-lucide='alert-circle'></i> Failed to generate share link.", 3000);
            }
        }
    }

    /**
     * Retrieve a shared note using a token.
     * @param {string} token
     * @param {Function} fetchNoteById - Function to fetch a note from GitHub by ID (or path)
     * @returns {Promise<Object|null>} The note if valid, otherwise null
     */
    async function getSharedNote(token, fetchNoteById) {
        const data = validateToken(token);
        if (!data) return null;

        // Attempt to fetch the note using the stored path
        try {
            const note = await fetchNoteById(data.noteId, data.path);
            return note;
        } catch (error) {
            console.error('Failed to fetch shared note:', error);
            return null;
        }
    }

    return {
        handleShare,
        validateToken,
        getSharedNote
    };
})();