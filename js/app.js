/* js/app.js */
import StorageManager from './storage/indexedDB.js';
import GitHubBackend from './core/githubClient.js';
import OfflineQueue from './storage/offlineQueue.js';
import EditorUI from './ui/editor.js';
import SidebarManager from './ui/sidebar.js';
import NoteCRUD from './notes/noteCRUD.js';
import FolderManager from './notes/folderManager.js';
import DeltaSync from './sync/deltaSync.js';

window.appMode = 'local';

const defaultWelcomeNote = `# Welcome to Markdown Studio 🖤\n\nYour premium workspace.\n\n## [ ✨ Features ]{#3b82f6}\n* **💻 Code Blocks:** Hover over code to copy it!\n* **🖼️ Pro Images:** \`![alt](url){300x400, center}\`\n* **🧠 Wiki Links:** Type \`[[Note Name]]\` to link notes!\n\n## 🧪 Testing Zone\n\n**1. Copy Code Feature**\n\`\`\`javascript\nfunction greet(name) {\n  console.log("Hello, " + name + "!");\n}\ngreet("Markdown Studio");\n\`\`\`\n\n**2. Responsive Image (Left Aligned, 200px)**\n![Nature](https://images.unsplash.com/photo-1506744626753-143d4e8c1874?q=80&w=300&auto=format&fit=crop){200, left}\nThis text automatically wraps around the right side of the beautiful nature image because we used the \`{200, left}\` syntax.\n\n**3. Custom Raw SVG Icon**\n<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>\n\n/center **Enjoy writing!**`;

async function updatePillUI() {
    const indicator = document.getElementById('active-mode-indicator');
    if (indicator) {
        if (window.appMode === 'github') {
            indicator.innerHTML = `<i data-lucide="cloud-check" style="width:14px; height:14px;"></i> Cloud Synced`;
            indicator.style.color = '#10b981';
        } else {
            indicator.innerHTML = `<i data-lucide="hard-drive" style="width:14px; height:14px;"></i> Local Storage`;
            indicator.style.color = 'var(--text-color)';
        }
    }
    if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("App initializing...");
    await StorageManager.init();
    EditorUI.init();
    SidebarManager.init();

    const savedMode = localStorage.getItem('md_app_mode') || 'local';
    const token = localStorage.getItem('md_github_token');

    if (savedMode === 'github' && token) {
        const success = await GitHubBackend.init(token);
        if (success) {
            window.appMode = 'github';
        } else {
            window.appMode = 'local';
        }
    } else {
        window.appMode = 'local';
    }

    updatePillUI();

    // Load notes
    let cachedNotes = await StorageManager.getAllNotes(window.appMode);
    if (!cachedNotes || cachedNotes.length === 0) {
        if (window.appMode === 'local') {
            const id = Date.now().toString();
            cachedNotes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: defaultWelcomeNote, lastUpdated: Date.now() }];
            await StorageManager.saveNotes(cachedNotes, 'local');
        } else {
            cachedNotes = [];
        }
    }

    NoteCRUD.notes = cachedNotes;
    NoteCRUD.activeNoteId = localStorage.getItem(`md_active_${window.appMode}`) || cachedNotes[0]?.id;

    // Initial UI Render
    const activeNote = NoteCRUD.getActiveNote();
    if (activeNote) {
        EditorUI.editor.value = activeNote.content;
        EditorUI.renderMarkdownCore(activeNote.content);
    }

    // Remove loading screen
    document.body.classList.remove('is-loading');
    console.log("App initialized.");

    // Sync
    if (navigator.onLine) {
        if (window.appMode === 'github') {
            const indicator = document.getElementById('active-mode-indicator');
            if (indicator) {
                indicator.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> Syncing...`;
                if (window.lucide) lucide.createIcons();
            }

            await OfflineQueue.process();
            await DeltaSync.runSync();

            const updatedNotes = await StorageManager.getAllNotes('github');
            if (updatedNotes) {
                NoteCRUD.notes = updatedNotes;
                const newActive = NoteCRUD.getActiveNote();
                if (newActive) {
                    EditorUI.editor.value = newActive.content;
                    EditorUI.renderMarkdownCore(newActive.content);
                }
            }
            updatePillUI();
        }
    }

    // Background sync
    setInterval(async () => {
        if (navigator.onLine && window.appMode === 'github') {
            await DeltaSync.runSync();
        }
    }, 60000);
});
