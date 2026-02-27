document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('markdown-input');
    const previewPanel = document.getElementById('preview-panel');
    const preview = document.getElementById('preview-output');
    const shareBtn = document.getElementById('btn-share');
    const btnConfirmPdf = document.getElementById('modal-confirm');
    const inputFilename = document.getElementById('pdf-filename');

    let notes = [];
    let activeNoteId = null;
    let noteToDeleteId = null;
    let highlightedNoteId = null; // Used for Dashboard Preview without changing active editor

    const defaultWelcomeNote = `# Welcome to Markdown Studio 🖤\n\nYour premium, zero-backend workspace. Here is a quick guide to what you can do:\n\n## [ ✨ Pro Features ]{#3b82f6}\n\n* **🖨️ Native PDF Export:** Click "Export" to perfectly scale vector PDFs.\n* **🎨 Smart Toggle:** Format text quickly! Select text and click the **B** icon in the toolbar. Click it again to undo!\n* **🔗 Zero-Backend Sharing:** Click "Share" to generate a secure URL containing your entire document.\n* **📊 Live Stats & Sync Scroll:** Keep track of your word count at the bottom.\n\n### Code Example\nCode blocks automatically switch themes depending on your Light/Dark mode setting!\n\n\`\`\`javascript\nfunction greet() {\n  console.log('Welcome to your new Markdown Studio!');\n}\n\`\`\`\n\n> Start typing to explore, or click **📂 Notes** to create a new one!`;

    function loadNotes() {
        const saved = localStorage.getItem('md_studio_notes_modal_v4');
        if (saved) {
            const parsed = JSON.parse(saved);
            notes = parsed.notes;
            activeNoteId = parsed.activeNoteId;
        } else {
            const id = Date.now().toString();
            notes = [{ id: id, title: "Welcome to Markdown Studio", content: defaultWelcomeNote }];
            activeNoteId = id;
        }
    }

    function saveNotes() {
        localStorage.setItem('md_studio_notes_modal_v4', JSON.stringify({ notes, activeNoteId }));
    }

    function getActiveNote() {
        return notes.find(n => n.id === activeNoteId);
    }

    window.getActiveNoteTitle = function () {
        const note = getActiveNote();
        return note ? note.title : "Document";
    };

    function extractTitle(content) {
        const match = content.match(/^#+\s+(.*)/m);
        if (match && match[1]) {
            let text = match[1].replace(/\[([^\]]+)\]\s*\{\s*[a-zA-Z0-9#]+\s*\}/g, '$1');
            return text.substring(0, 30) + (text.length > 30 ? '...' : '');
        }
        return "Untitled Note";
    }

    // --- DASHBOARD: LIST RENDER & PREVIEW LOGIC ---
    window.renderNotesList = function () {
        const container = document.getElementById('notes-list-container');
        container.innerHTML = '';
        
        if(!highlightedNoteId) highlightedNoteId = activeNoteId;

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = `note-item ${note.id === highlightedNoteId ? 'active' : ''}`;
            div.innerHTML = `
                <div class="note-title"><i data-lucide="file-text" style="width: 18px; height: 18px; opacity: 0.7;"></i> ${note.title}</div>
            `;

            div.addEventListener('click', () => {
                highlightedNoteId = note.id;
                window.renderNotesList(); // Re-render to show active border
                window.renderDashboardPreview();
                
                // If on mobile, slide the preview pane in
                if (window.innerWidth <= 768) {
                    document.querySelector('.notes-dashboard-box').classList.add('show-preview-pane');
                }
            });

            // Double click directly opens editor (Desktop speed feature)
            div.addEventListener('dblclick', () => {
                document.getElementById('dash-btn-edit').click();
            });

            container.appendChild(div);
        });
        lucide.createIcons();
        window.renderDashboardPreview();
    };

    window.renderDashboardPreview = function() {
        const previewEl = document.getElementById('dashboard-preview-output');
        const note = notes.find(n => n.id === highlightedNoteId) || notes[0];
        if(!note) return;
        
        const colorProcessedText = note.content.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, '<span style="color: $2;">$1</span>');
        const htmlContent = marked.parse(colorProcessedText);
        const cleanHtml = DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['style'] });
        
        previewEl.innerHTML = cleanHtml;
        renderMathInElement(previewEl, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    };

    // --- DASHBOARD ACTIONS (Pill Buttons) ---
    document.getElementById('dash-btn-edit').addEventListener('click', () => {
        activeNoteId = highlightedNoteId;
        editor.value = getActiveNote().content;
        saveNotes();
        renderMarkdown();
        if(typeof window.closeNotesModal === 'function') window.closeNotesModal();
    });

    document.getElementById('dash-btn-delete').addEventListener('click', () => {
        noteToDeleteId = highlightedNoteId;
        document.getElementById('delete-modal').classList.add('show');
    });

    document.getElementById('dash-btn-export').addEventListener('click', () => {
        activeNoteId = highlightedNoteId;
        editor.value = getActiveNote().content;
        saveNotes();
        renderMarkdown();
        
        if(typeof window.closeNotesModal === 'function') window.closeNotesModal();
        setTimeout(() => {
            document.getElementById('btn-pdf').click();
        }, 300);
    });

    // Mobile Back Button
    document.getElementById('dash-btn-back').addEventListener('click', () => {
        document.querySelector('.notes-dashboard-box').classList.remove('show-preview-pane');
    });

    // --- DELETE CONFIRM LOGIC ---
    document.getElementById('delete-confirm').addEventListener('click', () => {
        if (!noteToDeleteId) return;

        if (notes.length === 1) {
            notes[0].content = "# Untitled Note\n";
            notes[0].title = "Untitled Note";
            editor.value = notes[0].content;
        } else {
            const idx = notes.findIndex(n => n.id === noteToDeleteId);
            notes.splice(idx, 1);
            
            // Fix states if active or highlighted note is deleted
            if (activeNoteId === noteToDeleteId) {
                activeNoteId = notes[Math.max(0, idx - 1)].id;
                editor.value = getActiveNote().content;
            }
            if (highlightedNoteId === noteToDeleteId) {
                highlightedNoteId = activeNoteId;
            }
        }

        saveNotes();
        renderMarkdown();
        window.renderNotesList();

        noteToDeleteId = null;
        if(typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
        window.showToast("<i data-lucide='trash-2'></i> Note deleted");
    });

    // --- CUSTOM PROMPT MODAL LOGIC FOR NEW NOTE ---
    const btnNewNote = document.getElementById('btn-new-note');
    const promptModal = document.getElementById('prompt-modal');
    const promptInput = document.getElementById('prompt-input');
    const btnPromptConfirm = document.getElementById('prompt-confirm');
    const btnPromptCancel = document.getElementById('prompt-cancel');

    btnNewNote.addEventListener('click', () => {
        promptInput.value = 'New Note';
        promptModal.classList.add('show');
        setTimeout(() => {
            promptInput.focus();
            promptInput.select();
        }, 100);
    });

    const createNoteFromPrompt = () => {
        let noteName = promptInput.value.trim();
        if (noteName === "") noteName = "Untitled Note";

        const newId = Date.now().toString();
        notes.unshift({ id: newId, title: noteName, content: `# ${noteName}\n\nStart typing here...` });

        activeNoteId = newId;
        highlightedNoteId = newId;
        editor.value = getActiveNote().content;

        saveNotes();
        renderMarkdown();
        window.renderNotesList();
        
        promptModal.classList.remove('show');
        
        // Auto open the new note in editor
        if(typeof window.closeNotesModal === 'function') window.closeNotesModal();
        window.showToast("<i data-lucide='check-circle'></i> " + noteName + " created!");
    };

    btnPromptConfirm.addEventListener('click', createNoteFromPrompt);
    promptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createNoteFromPrompt();
    });
    btnPromptCancel.addEventListener('click', () => {
        promptModal.classList.remove('show');
    });

    // --- STATS LOGIC ---
    function updateLiveStats(text) {
        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const readingTime = Math.max(1, Math.ceil(words / 200));

        document.getElementById('stat-words').textContent = `${words} Words`;
        document.getElementById('stat-chars').textContent = `${chars} Characters`;
        document.getElementById('stat-reading-time').textContent = `${readingTime} min read`;
    }

    marked.setOptions({ breaks: true, gfm: true, headerIds: true, mangle: false });
    function debounce(func, wait) { let timeout; return function (...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }

    const renderMarkdown = debounce(() => {
        const rawText = editor.value;

        const activeNote = getActiveNote();
        if (activeNote) {
            activeNote.content = rawText;
            activeNote.title = extractTitle(rawText);
            saveNotes();
        }

        updateLiveStats(rawText);

        const colorProcessedText = rawText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, '<span style="color: $2;">$1</span>');
        const htmlContent = marked.parse(colorProcessedText);
        const cleanHtml = DOMPurify.sanitize(htmlContent, { ADD_ATTR: ['style'] });

        preview.innerHTML = cleanHtml;
        renderMathInElement(preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        
        // Auto update dashboard preview if the active note is currently highlighted there
        if(highlightedNoteId === activeNoteId && document.getElementById('notes-modal').classList.contains('show')) {
            window.renderDashboardPreview();
        }
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

    // --- SCROLL SYNC LOGIC ---
    let isScrollSync = true;
    const btnScrollSync = document.getElementById('btn-scroll-sync');
    if(btnScrollSync) {
        btnScrollSync.addEventListener('click', () => {
            isScrollSync = !isScrollSync;
            btnScrollSync.classList.toggle('active', isScrollSync);
            if (!isScrollSync) {
                btnScrollSync.style.opacity = '0.4';
            } else {
                btnScrollSync.style.opacity = '1';
            }
        });
    }

    editor.addEventListener('scroll', () => {
        if (!isScrollSync) return;
        const percentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        if (previewPanel.scrollHeight > previewPanel.clientHeight) {
            previewPanel.scrollTop = percentage * (previewPanel.scrollHeight - previewPanel.clientHeight);
        }
    });

    document.querySelectorAll('.tool-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            let selection = editor.value.substring(start, end);
            const fullText = editor.value;

            let prefix = ''; let suffix = ''; let defaultText = '';

            if (action === 'bold') { prefix = '**'; suffix = '**'; defaultText = 'bold text'; }
            else if (action === 'italic') { prefix = '*'; suffix = '*'; defaultText = 'italic text'; }
            else if (action === 'math') { prefix = '$$'; suffix = '$$'; defaultText = 'e=mc^2'; }
            else if (action === 'code') { prefix = '\n```\n'; suffix = '\n```\n'; defaultText = 'code here'; }
            else if (action === 'heading') { prefix = '### '; suffix = ''; defaultText = 'Heading'; }
            else if (action === 'link') { prefix = '['; suffix = '](url)'; defaultText = 'link text'; }
            else if (action === 'image') { prefix = '!['; suffix = '](image_url)'; defaultText = 'alt text'; }
            else if (action === 'table') {
                prefix = '\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n';
                suffix = ''; defaultText = '';
            }

            editor.focus();

            if (prefix && suffix && selection.startsWith(prefix) && selection.endsWith(suffix) && selection.length >= prefix.length + suffix.length) {
                const unstripped = selection.substring(prefix.length, selection.length - suffix.length);
                editor.value = fullText.substring(0, start) + unstripped + fullText.substring(end);
                editor.selectionStart = start;
                editor.selectionEnd = start + unstripped.length;
                renderMarkdown();
                return;
            }

            const textBefore = fullText.substring(Math.max(0, start - prefix.length), start);
            const textAfter = fullText.substring(end, end + suffix.length);

            if (prefix && suffix && textBefore === prefix && textAfter === suffix) {
                editor.value = fullText.substring(0, start - prefix.length) + selection + fullText.substring(end + suffix.length);
                editor.selectionStart = start - prefix.length;
                editor.selectionEnd = start - prefix.length + selection.length;
                renderMarkdown();
                return;
            }

            if (action === 'heading') {
                const lineStart = fullText.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = fullText.indexOf('\n', end);
                const actualLineEnd = lineEnd === -1 ? fullText.length : lineEnd;
                const lineText = fullText.substring(lineStart, actualLineEnd);

                if (lineText.trimStart().startsWith('### ')) {
                    const stripped = lineText.replace(/^\s*###\s*/, '');
                    editor.value = fullText.substring(0, lineStart) + stripped + fullText.substring(actualLineEnd);
                    const offset = Math.max(lineStart, start - 4);
                    editor.selectionStart = editor.selectionEnd = offset;
                    renderMarkdown();
                    return;
                }
            }

            const textToWrap = selection || defaultText;
            editor.value = fullText.substring(0, start) + prefix + textToWrap + suffix + fullText.substring(end);

            if (!selection) {
                editor.selectionStart = start + prefix.length;
                editor.selectionEnd = start + prefix.length + defaultText.length;
            } else {
                editor.selectionStart = start + prefix.length;
                editor.selectionEnd = start + prefix.length + selection.length;
            }

            renderMarkdown();
        });
    });

    const btnExportMd = document.getElementById('btn-export-md');
    const btnImportMd = document.getElementById('btn-import-md');
    const importFile = document.getElementById('import-file');

    btnExportMd.addEventListener('click', () => {
        const text = editor.value;
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        let safeTitle = getActiveNote().title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        if (safeTitle === 'untitled_note' || !safeTitle) safeTitle = 'markdown_document';
        a.download = `${safeTitle}.md`;
        a.click();
        URL.revokeObjectURL(url);
        window.showToast("<i data-lucide='download'></i> .md file downloaded!");
    });

    btnImportMd.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const newId = Date.now().toString();
            notes.unshift({ id: newId, title: file.name.replace('.md', '').replace('.txt', ''), content: content });
            activeNoteId = newId;
            highlightedNoteId = newId;
            editor.value = content;
            saveNotes();
            renderMarkdown();
            if (typeof window.renderNotesList === 'function') window.renderNotesList();
            window.showToast("<i data-lucide='file-up'></i> Document imported!");
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    loadNotes();
    highlightedNoteId = activeNoteId;

    if (window.location.hash && window.location.hash.length > 1) {
        try {
            const encodedData = window.location.hash.substring(1);
            const decodedText = decodeURIComponent(atob(encodedData));
            const sharedId = Date.now().toString();
            notes.unshift({ id: sharedId, title: extractTitle(decodedText) || "Shared Note", content: decodedText });
            activeNoteId = sharedId;
            highlightedNoteId = sharedId;
            window.showToast("<i data-lucide='download'></i> Shared document saved!");
            history.replaceState(null, null, ' ');
        } catch (e) { console.error("Invalid share link", e); }
    }

    editor.value = getActiveNote().content;
    renderMarkdown();

    inputFilename.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnConfirmPdf.click(); });

    // PDF Export Confirmed
    btnConfirmPdf.addEventListener('click', () => {
        let fileName = inputFilename.value.trim() || getActiveNote().title || "Document";
        if (typeof window.closePdfModal === "function") window.closePdfModal();

        const style = document.createElement('style');
        let pageCss = "";
        if (window.selectedPageSize === 'A4') { pageCss = `@page { size: A4 portrait; margin: 0; } #preview-output { padding: 5px !important; }`; }
        else if (window.selectedPageSize === 'A2') { pageCss = `@page { size: A2 portrait; margin: 0; } #preview-output { padding: 5px !important; font-size: 1.2rem !important; }`; }
        else if (window.selectedPageSize === 'Infinity') {
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

    shareBtn.addEventListener('click', async () => {
        const textToShare = editor.value;
        const encodedData = btoa(encodeURIComponent(textToShare));
        const shareableUrl = window.location.origin + window.location.pathname + "#" + encodedData;

        if (navigator.share) {
            try { await navigator.share({ title: getActiveNote().title, url: shareableUrl }); }
            catch (err) { console.log(err); }
        } else {
            navigator.clipboard.writeText(shareableUrl).then(() => {
                if (typeof window.showToast === "function") window.showToast("<i data-lucide='link'></i> Link Copied!");
            });
        }
    });
});