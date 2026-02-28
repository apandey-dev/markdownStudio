/* ==========================================================================
   SHARE VIEW – Handles displaying shared notes from a token
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('shared');

    const titleEl = document.getElementById('shared-note-title');
    const previewEl = document.getElementById('shared-note-preview');
    const errorEl = document.getElementById('shared-error');
    const containerEl = document.getElementById('shared-note-container');

    if (!token) {
        showError();
        return;
    }

    // Need GitHub token to fetch note
    const githubToken = localStorage.getItem('md_github_token');
    if (!githubToken) {
        // No token – show error with link to main app
        showError('You need to be logged into GitHub to view shared notes. Please visit the main app first.');
        return;
    }

    // Initialize GitHub backend
    const initSuccess = await window.GitHubBackend.init(githubToken);
    if (!initSuccess) {
        showError('GitHub authentication failed. Please re‑authenticate in the main app.');
        return;
    }

    // Function to fetch a note by ID (reuse from GitHubBackend)
    async function fetchNoteById(noteId, path) {
        const allNotes = await window.GitHubBackend.getAllNotes();
        return allNotes.find(n => n.id === noteId || n.path === path) || null;
    }

    const note = await window.ShareHandler.getSharedNote(token, fetchNoteById);
    if (!note) {
        showError();
        return;
    }

    // Display the note
    titleEl.textContent = note.title;
    previewEl.innerHTML = customMarkdownParser(note.content);

    // Apply math rendering and syntax highlighting
    renderMathInElement(previewEl, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
        ],
        throwOnError: false
    });
    previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));

    // Show container, hide error
    containerEl.style.display = 'block';
    errorEl.style.display = 'none';

    // Helper function – same as in editor.js
    function customMarkdownParser(rawText) {
        let processedText = rawText;
        processedText = processedText.replace(/^={3,}\s*$/gm, '\n\n<hr class="custom-divider" />\n\n');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s*\n([\s\S]*?)\n\/end/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s+(.+)$/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, '<span style="color: $2;">$1</span>');
        const htmlContent = marked.parse(processedText);
        return DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['style', 'class'] });
    }

    function showError(message = 'This share link is invalid or has expired.') {
        containerEl.style.display = 'none';
        errorEl.style.display = 'block';
        const errorMsg = errorEl.querySelector('p');
        if (errorMsg) errorMsg.textContent = message;
    }

    // Theme toggle (optional)
    const themeBtn = document.getElementById('btn-theme');
    const themeIcon = document.getElementById('theme-icon');
    const applyTheme = (isDark) => {
        if (isDark) {
            document.body.classList.add('dark-mode');
            themeIcon?.setAttribute('data-lucide', 'sun');
            document.getElementById('theme-light').disabled = true;
            document.getElementById('theme-dark').disabled = false;
        } else {
            document.body.classList.remove('dark-mode');
            themeIcon?.setAttribute('data-lucide', 'moon');
            document.getElementById('theme-light').disabled = false;
            document.getElementById('theme-dark').disabled = true;
        }
        if (window.lucide) lucide.createIcons();
    };
    themeBtn?.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyTheme(isDark);
    });
    // Set initial icon
    const isDark = document.body.classList.contains('dark-mode');
    themeIcon?.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
});