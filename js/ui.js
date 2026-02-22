// Global variables for cross-file communication
window.selectedPageSize = 'A4';
window.toastTimeout = null;

// Global Toast Function
window.showToast = function(message, duration = 3000) {
    const toastEl = document.getElementById('toast');
    clearTimeout(window.toastTimeout);
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.toastTimeout = setTimeout(() => toastEl.classList.remove('show'), duration);
};

// Global function to close the PDF modal
window.closePdfModal = function() {
    document.getElementById('pdf-modal').classList.remove('show');
};

document.addEventListener('DOMContentLoaded', () => {
    // --- Generic Custom Dropdown Logic ---
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
                textEl.textContent = e.target.textContent;
                dropdown.classList.remove('open');
                if(callback) callback(e.target.getAttribute('data-value'));
            });
        });
    }

    document.addEventListener('click', () => { 
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open')); 
    });

    // Font Setup
    setupDropdown('font-dropdown', 'font-selected-text', (val) => {
        document.getElementById('font-selected-text').textContent = `Preview: ${val}`;
        document.documentElement.style.setProperty('--preview-font', `'${val}', sans-serif`);
    });

    // Page Size Setup (saves into global variable)
    setupDropdown('size-dropdown', 'size-selected-text', (val) => { 
        window.selectedPageSize = val; 
    });

    // --- Draggable View Logic ---
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
    const toggleTheme = () => { 
        document.body.classList.toggle('dark-mode'); 
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
    };
    
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) { 
        document.body.classList.add('dark-mode'); 
    }
    themeBtn.addEventListener('click', toggleTheme);

    // --- Modal Open/Close Handling ---
    const pdfBtn = document.getElementById('btn-pdf');
    const btnCancel = document.getElementById('modal-cancel');
    const inputFilename = document.getElementById('pdf-filename');

    pdfBtn.addEventListener('click', () => { 
        document.getElementById('pdf-modal').classList.add('show'); 
        inputFilename.focus(); 
        inputFilename.select(); 
    });
    
    btnCancel.addEventListener('click', window.closePdfModal);
});