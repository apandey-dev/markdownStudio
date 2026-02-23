window.selectedPageSize = 'A4';
window.toastTimeout = null;

window.showToast = function (message, duration = 3000) {
    const toastEl = document.getElementById('toast');
    clearTimeout(window.toastTimeout);

    if (message.includes('<i')) {
        toastEl.innerHTML = message;
        lucide.createIcons();
    } else {
        toastEl.textContent = message;
    }

    toastEl.classList.add('show');
    window.toastTimeout = setTimeout(() => toastEl.classList.remove('show'), duration);
};

window.closePdfModal = function () {
    document.getElementById('pdf-modal').classList.remove('show');
};

window.closeNotesModal = function () {
    document.getElementById('notes-modal').classList.remove('show');
};

window.closeDeleteModal = function () {
    document.getElementById('delete-modal').classList.remove('show');
};

document.addEventListener('DOMContentLoaded', () => {

    const themeIcon = document.getElementById('theme-icon');
    const isCurrentlyDark = document.body.classList.contains('dark-mode');
    themeIcon.setAttribute('data-lucide', isCurrentlyDark ? 'sun' : 'moon');

    lucide.createIcons();

    // --- MOBILE SIDEBAR LOGIC ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebarOverlay = document.getElementById('mobile-sidebar-overlay');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');

    if(mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => sidebarOverlay.classList.add('show'));
        closeSidebarBtn.addEventListener('click', () => sidebarOverlay.classList.remove('show'));
        sidebarOverlay.addEventListener('click', (e) => { 
            if(e.target === sidebarOverlay) sidebarOverlay.classList.remove('show'); 
        });
    }

    document.getElementById('sidebar-btn-notes')?.addEventListener('click', () => { 
        sidebarOverlay.classList.remove('show'); 
        document.getElementById('btn-notes').click(); 
    });
    document.getElementById('sidebar-btn-share')?.addEventListener('click', () => { 
        sidebarOverlay.classList.remove('show'); 
        document.getElementById('btn-share').click(); 
    });
    document.getElementById('sidebar-btn-pdf')?.addEventListener('click', () => { 
        sidebarOverlay.classList.remove('show'); 
        document.getElementById('btn-pdf').click(); 
    });
    document.getElementById('sidebar-btn-theme')?.addEventListener('click', () => { 
        document.getElementById('btn-theme').click(); 
        const isDark = document.body.classList.contains('dark-mode');
        document.getElementById('sidebar-theme-icon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
    });

    // --- MOBILE FLOATING VIEW TOGGLE ---
    const mobileViewToggle = document.getElementById('mobile-view-toggle');
    if(mobileViewToggle) {
        mobileViewToggle.addEventListener('click', () => {
            document.body.classList.toggle('show-preview');
            const isPreview = document.body.classList.contains('show-preview');
            mobileViewToggle.innerHTML = isPreview ? '<i data-lucide="edit-2"></i>' : '<i data-lucide="eye"></i>';
            lucide.createIcons();
        });
    }

    // --- ESCAPE KEY LOGIC ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if(sidebarOverlay && sidebarOverlay.classList.contains('show')) { 
                sidebarOverlay.classList.remove('show'); 
                return; 
            }

            const openDropdown = document.querySelector('.custom-dropdown.open');
            if (openDropdown) { openDropdown.classList.remove('open'); return; }

            const deleteModal = document.getElementById('delete-modal');
            if (deleteModal && deleteModal.classList.contains('show')) { window.closeDeleteModal(); return; }

            const notesModal = document.getElementById('notes-modal');
            if (notesModal && notesModal.classList.contains('show')) { window.closeNotesModal(); return; }

            const pdfModal = document.getElementById('pdf-modal');
            if (pdfModal && pdfModal.classList.contains('show')) { window.closePdfModal(); return; }
        }
    });

    function setupDropdown(dropdownId, textId, callback) {
        const dropdown = document.getElementById(dropdownId);
        const header = dropdown.querySelector('.dropdown-header');
        const items = dropdown.querySelectorAll('.dropdown-item');
        const textEl = document.getElementById(textId);

        header.addEventListener('click', (e) => {
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
                textEl.textContent = `Preview: ${e.target.textContent}`;
                dropdown.classList.remove('open');
                if (callback) callback(e.target.getAttribute('data-value'));
            });
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
    });

    setupDropdown('font-dropdown', 'font-selected-text', (val) => {
        document.documentElement.style.setProperty('--preview-font', `'${val}', sans-serif`);
    });

    setupDropdown('size-dropdown', 'size-selected-text', (val) => {
        window.selectedPageSize = val;
    });

    const divider = document.getElementById('drag-divider');
    const editorPanel = document.getElementById('editor-panel-wrapper');
    const container = document.querySelector('.app-container');
    let isDragging = false;

    if(divider) {
        divider.addEventListener('mousedown', () => {
            isDragging = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
    }

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

    const themeBtn = document.getElementById('btn-theme');
    const applyTheme = (isDark) => {
        if (isDark) {
            document.body.classList.add('dark-mode');
            themeIcon.setAttribute('data-lucide', 'sun');
            document.getElementById('theme-light').disabled = true;
            document.getElementById('theme-dark').disabled = false;
        } else {
            document.body.classList.remove('dark-mode');
            themeIcon.setAttribute('data-lucide', 'moon');
            document.getElementById('theme-light').disabled = false;
            document.getElementById('theme-dark').disabled = true;
        }
        lucide.createIcons();
    };

    const toggleTheme = () => {
        const isDark = !document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyTheme(isDark);
    };

    themeBtn.addEventListener('click', toggleTheme);

    const pdfBtn = document.getElementById('btn-pdf');
    const btnCancelPdf = document.getElementById('modal-cancel');
    const inputFilename = document.getElementById('pdf-filename');

    pdfBtn.addEventListener('click', () => {
        document.getElementById('pdf-modal').classList.add('show');
        inputFilename.focus();
        inputFilename.select();
    });
    btnCancelPdf.addEventListener('click', window.closePdfModal);

    const notesBtn = document.getElementById('btn-notes');
    const btnCancelNotes = document.getElementById('notes-modal-close');

    notesBtn.addEventListener('click', () => {
        document.getElementById('notes-modal').classList.add('show');
        if (typeof window.renderNotesList === 'function') window.renderNotesList();
    });
    btnCancelNotes.addEventListener('click', window.closeNotesModal);
    document.getElementById('delete-cancel').addEventListener('click', window.closeDeleteModal);
});