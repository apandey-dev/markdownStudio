/* ==========================================================================
   UI CONTROLLER
   Handles interactions, modals, themes, fonts, and workspace layout safely.
   ========================================================================== */

window.selectedPageSize = 'A4';
window.toastTimeout = null;

window.showToast = function (message, duration = 3000) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    clearTimeout(window.toastTimeout);

    if (message.includes('<i')) {
        toastEl.innerHTML = message;
        if (window.lucide) lucide.createIcons();
    } else {
        toastEl.textContent = message;
    }

    toastEl.classList.add('show');
    window.toastTimeout = setTimeout(() => toastEl.classList.remove('show'), duration);
};

// --- MODAL CLOSURE EXPORTS ---
window.closePdfModal = function () { document.getElementById('pdf-modal')?.classList.remove('show'); };
window.closeDeleteModal = function () { document.getElementById('delete-modal')?.classList.remove('show'); };
window.closeNotesModal = function () {
    document.getElementById('notes-modal')?.classList.remove('show');
    document.querySelector('.notes-dashboard-box')?.classList.remove('show-preview-pane');
};
window.closePromptModal = function () { document.getElementById('prompt-modal')?.classList.remove('show'); };
window.closePatGuideModal = function () { document.getElementById('pat-guide-modal')?.classList.remove('show'); };

document.addEventListener('DOMContentLoaded', () => {

    const themeIcon = document.getElementById('theme-icon');
    const isCurrentlyDark = document.body.classList.contains('dark-mode');
    if (themeIcon) themeIcon.setAttribute('data-lucide', isCurrentlyDark ? 'sun' : 'moon');

    if (window.lucide) lucide.createIcons();

    // --- DESKTOP VIEW TOGGLE LOGIC ---
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            document.body.classList.remove('view-editor', 'view-preview');
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (view === 'editor') document.body.classList.add('view-editor');
            if (view === 'preview') document.body.classList.add('view-preview');

            const editorPanel = document.getElementById('editor-panel-wrapper');
            if (editorPanel) editorPanel.style.flex = '';
        });
    });

    // --- MODAL TRIGGERS ---
    document.querySelectorAll('.modal-trigger-notes').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('notes-modal')?.classList.add('show');
            if (typeof window.renderNotesList === 'function') window.renderNotesList();
            document.getElementById('mobile-sidebar-overlay')?.classList.remove('show');
        });
    });

    document.getElementById('notes-modal-close')?.addEventListener('click', window.closeNotesModal);

    document.getElementById('btn-pat-help')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('pat-guide-modal')?.classList.add('show');
    });
    document.getElementById('pat-guide-close')?.addEventListener('click', window.closePatGuideModal);

    document.getElementById('btn-cancel-setup')?.addEventListener('click', () => {
        document.getElementById('setup-modal').classList.remove('show');
    });

    // --- MOBILE SIDEBAR LOGIC ---
    const sidebarOverlay = document.getElementById('mobile-sidebar-overlay');
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => sidebarOverlay?.classList.add('show'));
    document.getElementById('close-sidebar-btn')?.addEventListener('click', () => sidebarOverlay?.classList.remove('show'));

    sidebarOverlay?.addEventListener('click', (e) => {
        if (e.target === sidebarOverlay) sidebarOverlay.classList.remove('show');
    });

    document.getElementById('sidebar-btn-share')?.addEventListener('click', () => {
        sidebarOverlay?.classList.remove('show');
        document.getElementById('btn-share')?.click();
    });
    document.getElementById('sidebar-btn-pdf')?.addEventListener('click', () => {
        sidebarOverlay?.classList.remove('show');
        document.getElementById('btn-pdf')?.click();
    });
    document.getElementById('sidebar-btn-theme')?.addEventListener('click', () => {
        document.getElementById('btn-theme')?.click();
        const isDark = document.body.classList.contains('dark-mode');
        document.getElementById('sidebar-theme-icon')?.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        if (window.lucide) lucide.createIcons();
    });

    // --- MOBILE FLOATING VIEW TOGGLE ---
    const mobileViewToggle = document.getElementById('mobile-view-toggle');
    if (mobileViewToggle) {
        mobileViewToggle.addEventListener('click', () => {
            document.body.classList.toggle('show-preview');
            const isPreview = document.body.classList.contains('show-preview');
            mobileViewToggle.innerHTML = isPreview ? '<i data-lucide="edit-2"></i>' : '<i data-lucide="eye"></i>';
            if (window.lucide) lucide.createIcons();
        });
    }

    // --- ESCAPE KEY LOGIC ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (sidebarOverlay?.classList.contains('show')) { sidebarOverlay.classList.remove('show'); return; }
            const openDropdown = document.querySelector('.custom-dropdown.open');
            if (openDropdown) { openDropdown.classList.remove('open'); return; }
            const setupModal = document.getElementById('setup-modal');
            if (setupModal?.classList.contains('show')) { setupModal.classList.remove('show'); return; }

            if (document.getElementById('pat-guide-modal')?.classList.contains('show')) { window.closePatGuideModal(); return; }
            if (document.getElementById('prompt-modal')?.classList.contains('show')) { window.closePromptModal(); return; }
            if (document.getElementById('delete-modal')?.classList.contains('show')) { window.closeDeleteModal(); return; }
            if (document.getElementById('notes-modal')?.classList.contains('show')) { window.closeNotesModal(); return; }
            if (document.getElementById('pdf-modal')?.classList.contains('show')) { window.closePdfModal(); return; }
        }
    });

    // --- DROPDOWN LOGIC ---
    function setupDropdown(dropdownId, textId, callback) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        const header = dropdown.querySelector('.dropdown-header');
        const items = dropdown.querySelectorAll('.dropdown-item');
        const textEl = document.getElementById(textId);

        header?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                items.forEach(i => i.classList.remove('active'));
                e.target.classList.add('active');
                if (textEl) textEl.textContent = `Preview: ${e.target.textContent}`;
                dropdown.classList.remove('open');
                if (callback) callback(e.target.getAttribute('data-value'));
            });
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
    });

    const savedFont = localStorage.getItem('md_studio_font') || 'Fredoka';
    document.documentElement.style.setProperty('--preview-font', `'${savedFont}', sans-serif`);

    const fontDropdownItems = document.querySelectorAll('#font-dropdown .dropdown-item');
    const fontSelectedText = document.getElementById('font-selected-text');
    if (fontDropdownItems.length > 0 && fontSelectedText) {
        fontDropdownItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-value') === savedFont) {
                item.classList.add('active');
                fontSelectedText.textContent = `Preview: ${item.textContent}`;
            }
        });
    }

    setupDropdown('font-dropdown', 'font-selected-text', (val) => {
        document.documentElement.style.setProperty('--preview-font', `'${val}', sans-serif`);
        localStorage.setItem('md_studio_font', val);
    });

    setupDropdown('size-dropdown', 'size-selected-text', (val) => {
        window.selectedPageSize = val;
    });

    // --- DRAGGABLE SPLIT PANE ---
    const divider = document.getElementById('drag-divider');
    const editorPanel = document.getElementById('editor-panel-wrapper');
    const container = document.getElementById('split-workspace');
    let isDragging = false;

    if (divider && editorPanel && container) {
        divider.addEventListener('mousedown', () => {
            isDragging = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newWidthPercentage = ((e.clientX - container.getBoundingClientRect().left) / container.getBoundingClientRect().width) * 100;
            if (newWidthPercentage < 20) newWidthPercentage = 20;
            if (newWidthPercentage > 80) newWidthPercentage = 80;
            editorPanel.style.flex = `0 0 ${newWidthPercentage}%`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        });
    }

    // --- THEME TOGGLE ---
    const themeBtn = document.getElementById('btn-theme');
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

    const pdfBtn = document.getElementById('btn-pdf');
    const btnCancelPdf = document.getElementById('modal-cancel');
    const inputFilename = document.getElementById('pdf-filename');

    pdfBtn?.addEventListener('click', () => {
        document.getElementById('pdf-modal')?.classList.add('show');
        if (window.getActiveNoteTitle && inputFilename) {
            inputFilename.value = window.getActiveNoteTitle();
            inputFilename.focus();
            inputFilename.select();
        }
    });
    btnCancelPdf?.addEventListener('click', window.closePdfModal);

    document.getElementById('delete-cancel')?.addEventListener('click', window.closeDeleteModal);
});