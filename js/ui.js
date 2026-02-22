window.selectedPageSize = 'A4';
window.toastTimeout = null;

window.showToast = function (message, duration = 3000) {
    const toastEl = document.getElementById('toast');
    clearTimeout(window.toastTimeout);

    // Check if message is purely text or contains HTML/Icon
    if (message.includes('<i')) {
        toastEl.innerHTML = message;
        lucide.createIcons(); // Render icon in toast
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

document.addEventListener('DOMContentLoaded', () => {

    // Render Lucide Icons
    lucide.createIcons();

    // --- ESCAPE KEY LOGIC ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close Modals
            window.closePdfModal();
            window.closeNotesModal();

            // Also close any open dropdowns for a better UX
            document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
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

    // Close Dropdowns on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
    });

    setupDropdown('font-dropdown', 'font-selected-text', (val) => {
        document.documentElement.style.setProperty('--preview-font', `'${val}', sans-serif`);
    });

    setupDropdown('size-dropdown', 'size-selected-text', (val) => {
        window.selectedPageSize = val;
    });

    // --- Divider Dragging Logic ---
    const divider = document.getElementById('drag-divider');
    const editorPanel = document.getElementById('editor-panel');
    const container = document.querySelector('.app-container');
    let isDragging = false;

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

    // --- Dark Mode Logic ---
    const themeBtn = document.getElementById('btn-theme');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    const toggleTheme = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        // Switch Icon dynamically
        themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        lucide.createIcons();
    };

    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        themeIcon.setAttribute('data-lucide', 'sun');
        themeText.textContent = 'Light Mode';
    }
    themeBtn.addEventListener('click', toggleTheme);

    // --- PDF Modal Buttons ---
    const pdfBtn = document.getElementById('btn-pdf');
    const btnCancelPdf = document.getElementById('modal-cancel');
    const inputFilename = document.getElementById('pdf-filename');

    pdfBtn.addEventListener('click', () => {
        document.getElementById('pdf-modal').classList.add('show');
        inputFilename.focus();
        inputFilename.select();
    });
    btnCancelPdf.addEventListener('click', window.closePdfModal);

    // --- Notes Modal Buttons ---
    const notesBtn = document.getElementById('btn-notes');
    const btnCancelNotes = document.getElementById('notes-modal-close');

    notesBtn.addEventListener('click', () => {
        document.getElementById('notes-modal').classList.add('show');
        if (typeof window.renderNotesList === 'function') window.renderNotesList();
    });
    btnCancelNotes.addEventListener('click', window.closeNotesModal);
});