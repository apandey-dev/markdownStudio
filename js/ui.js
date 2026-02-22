window.selectedPageSize = 'A4';
window.toastTimeout = null;

window.showToast = function(message, duration = 3000) {
    const toastEl = document.getElementById('toast');
    clearTimeout(window.toastTimeout);
    
    if(message.includes('<i')) {
        toastEl.innerHTML = message;
        lucide.createIcons();
    } else {
        toastEl.textContent = message;
    }
    
    toastEl.classList.add('show');
    window.toastTimeout = setTimeout(() => toastEl.classList.remove('show'), duration);
};

window.closePdfModal = function() {
    document.getElementById('pdf-modal').classList.remove('show');
};

window.closeNotesModal = function() {
    document.getElementById('notes-modal').classList.remove('show');
};

window.closeDeleteModal = function() {
    document.getElementById('delete-modal').classList.remove('show');
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // --- SMART ESCAPE KEY LOGIC (Modal Stacking) ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            
            // Priority 1: Dropdowns (Agar koi dropdown khula hai toh pehle use band karo)
            const openDropdown = document.querySelector('.custom-dropdown.open');
            if (openDropdown) {
                openDropdown.classList.remove('open');
                return; // Yahin ruk jao, baaki kuch close mat karo
            }

            // Priority 2: Delete Modal (Ye sabse upar aata hai)
            const deleteModal = document.getElementById('delete-modal');
            if (deleteModal && deleteModal.classList.contains('show')) {
                window.closeDeleteModal();
                return; // Yahin ruk jao
            }

            // Priority 3: Notes Modal
            const notesModal = document.getElementById('notes-modal');
            if (notesModal && notesModal.classList.contains('show')) {
                window.closeNotesModal();
                return; // Yahin ruk jao
            }

            // Priority 4: PDF Export Modal
            const pdfModal = document.getElementById('pdf-modal');
            if (pdfModal && pdfModal.classList.contains('show')) {
                window.closePdfModal();
                return; // Yahin ruk jao
            }
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
                if(d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                items.forEach(i => i.classList.remove('active'));
                e.target.classList.add('active');
                textEl.textContent = `Preview: ${e.target.textContent}`;
                dropdown.classList.remove('open');
                if(callback) callback(e.target.getAttribute('data-value'));
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

    // Theme Logic & Code Block CSS Switching
    const themeBtn = document.getElementById('btn-theme');
    const themeIcon = document.getElementById('theme-icon');
    
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
    
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) { applyTheme(true); } 
    else { applyTheme(false); }
    
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
        if(typeof window.renderNotesList === 'function') window.renderNotesList();
    });
    btnCancelNotes.addEventListener('click', window.closeNotesModal);

    // Cancel Delete Button
    document.getElementById('delete-cancel').addEventListener('click', window.closeDeleteModal);
});