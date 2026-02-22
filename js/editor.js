document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('markdown-input');
    const preview = document.getElementById('preview-output');
    const shareBtn = document.getElementById('btn-share');
    const btnConfirmPdf = document.getElementById('modal-confirm');
    const inputFilename = document.getElementById('pdf-filename');

    // --- Modal Note Management System ---
    let notes = [];
    let activeNoteId = null;

    function loadNotes() {
        const saved = localStorage.getItem('md_studio_notes_modal_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            notes = parsed.notes;
            activeNoteId = parsed.activeNoteId;
        } else {
            const id = Date.now().toString();
            notes = [{
                id: id,
                title: "Welcome Note",
                content: "# Welcome to Markdown Studio 🖤\n\n## [ Directory Supported! ]{#3b82f6}\n\nClick **📂 Notes** in the navbar to create or switch between your notes."
            }];
            activeNoteId = id;
        }
    }

    function saveNotes() {
        localStorage.setItem('md_studio_notes_modal_v2', JSON.stringify({ notes, activeNoteId }));
    }

    function getActiveNote() {
        return notes.find(n => n.id === activeNoteId);
    }

    function extractTitle(content) {
        const match = content.match(/^#+\s+(.*)/m);
        if (match && match[1]) {
            let text = match[1].replace(/\[([^\]]+)\]\s*\{\s*[a-zA-Z0-9#]+\s*\}/g, '$1');
            return text.substring(0, 25) + (text.length > 25 ? '...' : '');
        }
        return "Untitled Note";
    }

    window.renderNotesList = function () {
        const container = document.getElementById('notes-list-container');
        container.innerHTML = '';

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;

            // Delete button uses Lucide Trash icon
            div.innerHTML = `
                <div class="note-title"><i data-lucide="file-text" style="width: 16px; height: 16px; opacity: 0.6;"></i> ${note.title}</div>
                <button class="btn-delete-note" title="Delete Note">
                    <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                </button>
            `;

            // Switch Note
            div.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-note')) return;
                activeNoteId = note.id;
                editor.value = note.content;
                saveNotes();
                renderMarkdown();
                window.closeNotesModal();
            });

            // Delete Note
            div.querySelector('.btn-delete-note').addEventListener('click', (e) => {
                e.stopPropagation();
                if (notes.length === 1) {
                    notes[0].content = "# Untitled Note\n";
                    notes[0].title = "Untitled Note";
                    editor.value = notes[0].content;
                } else {
                    const idx = notes.findIndex(n => n.id === note.id);
                    notes.splice(idx, 1);
                    if (activeNoteId === note.id) {
                        activeNoteId = notes[Math.max(0, idx - 1)].id;
                        editor.value = getActiveNote().content;
                    }
                }
                saveNotes();
                renderMarkdown();
                window.renderNotesList();
            });

            container.appendChild(div);
        });

        // Crucial: Re-render lucide icons for dynamic content
        lucide.createIcons();
    };

    // New Note Button inside Modal
    document.getElementById('btn-new-note').addEventListener('click', () => {
        const newId = Date.now().toString();
        notes.unshift({
            id: newId,
            title: "New Note",
            content: "# New Note\n"
        });
        activeNoteId = newId;
        editor.value = getActiveNote().content;
        saveNotes();
        renderMarkdown();
        window.renderNotesList();
        window.closeNotesModal();
        window.showToast("<i data-lucide='check-circle'></i> New note created!");
    });

    // --- Markdown Render Pipeline ---
    marked.setOptions({ breaks: true, gfm: true, headerIds: true, mangle: false });

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    const renderMarkdown = debounce(() => {
        const rawText = editor.value;

        const activeNote = getActiveNote();
        if (activeNote) {
            activeNote.content = rawText;
            activeNote.title = extractTitle(rawText);
            saveNotes();
        }

        const colorProcessedText = rawText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, '<span style="color: $2;">$1</span>');
        const htmlContent = marked.parse(colorProcessedText);
        const cleanHtml = DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['style'] });

        preview.innerHTML = cleanHtml;

        renderMathInElement(preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    }, 50);

    editor.addEventListener('input', renderMarkdown);

    editor.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 2;
            renderMarkdown();
        }
    });

    // --- Initialize App ---
    loadNotes();

    if (window.location.hash && window.location.hash.length > 1) {
        try {
            const encodedData = window.location.hash.substring(1);
            const decodedText = decodeURIComponent(atob(encodedData));

            const sharedId = Date.now().toString();
            notes.unshift({
                id: sharedId,
                title: extractTitle(decodedText) || "Shared Note",
                content: decodedText
            });
            activeNoteId = sharedId;

            window.showToast("<i data-lucide='download'></i> Shared document saved!");
            history.replaceState(null, null, ' ');
        } catch (e) {
            console.error("Invalid share link", e);
        }
    }

    editor.value = getActiveNote().content;
    renderMarkdown();

    // --- PDF Export Logic ---
    inputFilename.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnConfirmPdf.click();
    });

    btnConfirmPdf.addEventListener('click', () => {
        let fileName = inputFilename.value.trim() || getActiveNote().title || "Document";
        if (typeof window.closePdfModal === "function") window.closePdfModal();

        const style = document.createElement('style');
        let pageCss = "";

        if (window.selectedPageSize === 'A4') {
            pageCss = `@page { size: A4 portrait; margin: 0; } #preview-output { padding: 5px !important; }`;
        } else if (window.selectedPageSize === 'A2') {
            pageCss = `@page { size: A2 portrait; margin: 0; } #preview-output { padding: 5px !important; font-size: 1.2rem !important; }`;
        } else if (window.selectedPageSize === 'Infinity') {
            const contentHeightPx = document.getElementById('preview-output').scrollHeight;
            const contentHeightMm = Math.ceil(contentHeightPx * 0.264583) + 10;
            pageCss = `@page { size: 210mm ${contentHeightMm}mm; margin: 0; } #preview-output { padding: 5px !important; }`;
        }

        style.innerHTML = pageCss;
        document.head.appendChild(style);

        const originalTitle = document.title;
        document.title = fileName;

        setTimeout(() => {
            window.print();
            document.title = originalTitle;
            document.head.removeChild(style);
            if (typeof window.showToast === "function") window.showToast("<i data-lucide='check'></i> Export Successful!");
        }, 300);
    });

    // --- Share ---
    shareBtn.addEventListener('click', async () => {
        const textToShare = editor.value;
        const encodedData = btoa(encodeURIComponent(textToShare));
        const shareableUrl = window.location.origin + window.location.pathname + "#" + encodedData;

        if (navigator.share) {
            try {
                await navigator.share({ title: getActiveNote().title, url: shareableUrl });
            } catch (err) { console.log(err); }
        } else {
            navigator.clipboard.writeText(shareableUrl).then(() => {
                if (typeof window.showToast === "function") window.showToast("<i data-lucide='link'></i> Link Copied!");
            });
        }
    });
});