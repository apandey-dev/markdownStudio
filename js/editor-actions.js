/* js/editor-actions.js */
/* ==========================================================================
   EDITOR ACTIONS CONTROLLER
   Handles toolbar actions, note creation, deletion, renaming, and more.
   ========================================================================== */
window.EditorActions = {
    pendingDeleteData: { type: null, id: null },
    pendingNewNoteData: null,
    pendingRenameData: null,
    returningToNoteModal: false,

    initToolbarActions() {
        document.querySelectorAll('.tool-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                const editor = document.getElementById('markdown-input');
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
                else if (action === 'note-link') { prefix = '[['; suffix = ']]'; defaultText = 'Note Name'; }
                else if (action === 'image') { prefix = '!['; suffix = '](https://example.com/image.jpg){center, 400xauto}'; defaultText = 'alt text'; }
                else if (action === 'table') {
                    prefix = '\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n';
                    suffix = ''; defaultText = '';
                }
                else if (action === 'align-left') { prefix = '/left '; suffix = ''; defaultText = 'Left aligned text'; }
                else if (action === 'align-center') { prefix = '/center '; suffix = ''; defaultText = 'Centered text'; }
                else if (action === 'align-right') { prefix = '/right '; suffix = ''; defaultText = 'Right aligned text'; }

                editor.focus();

                if (prefix && suffix && selection.startsWith(prefix) && selection.endsWith(suffix) && selection.length >= prefix.length + suffix.length) {
                    const unstripped = selection.substring(prefix.length, selection.length - suffix.length);
                    editor.value = fullText.substring(0, start) + unstripped + fullText.substring(end);
                    editor.selectionStart = start;
                    editor.selectionEnd = start + unstripped.length;
                    editor.dispatchEvent(new Event('input'));
                    return;
                }

                const textBefore = fullText.substring(Math.max(0, start - prefix.length), start);
                const textAfter = fullText.substring(end, end + suffix.length);

                if (prefix && suffix && textBefore === prefix && textAfter === suffix) {
                    editor.value = fullText.substring(0, start - prefix.length) + selection + fullText.substring(end + suffix.length);
                    editor.selectionStart = start - prefix.length;
                    editor.selectionEnd = start - prefix.length + selection.length;
                    editor.dispatchEvent(new Event('input'));
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
                        editor.dispatchEvent(new Event('input'));
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
                editor.dispatchEvent(new Event('input'));
            });
        });
    },

    async handleNoteCreation() {
        const promptInput = document.getElementById('prompt-input');
        const promptModal = document.getElementById('prompt-modal');
        let noteName = promptInput.value.trim() || "Untitled Note";

        const dropText = document.getElementById('folder-selected-text');
        let targetFolder = dropText ? dropText.getAttribute('data-selected') : window.EditorState.activeFolder;
        if (!targetFolder) targetFolder = window.EditorState.activeFolder;

        const generatedPath = window.EditorState.generatePath(targetFolder, noteName);
        const existingNote = window.EditorState.notes.find(n => n.path === generatedPath);


        const newId = Date.now().toString();
        const content = `# ${noteName}\n\nStart typing here...`;

        if (existingNote) {
            this.pendingNewNoteData = { id: newId, path: generatedPath, folder: targetFolder, title: noteName, content: content, existingId: existingNote.id };
            document.getElementById('conflict-filename').textContent = noteName + ".md";
            promptModal.classList.remove('show');
            document.getElementById('conflict-modal').classList.add('show');
            return;
        }

        await this.executeNoteCreation({ id: newId, path: generatedPath, folder: targetFolder, title: noteName, content: content, lastUpdated: Date.now() });
    },

    async executeNoteCreation(noteData) {
        window.EditorState.notes.unshift(noteData);
        window.EditorState.activeNoteId = noteData.id;
        window.EditorCore.highlightedNoteId = noteData.id;
        window.EditorState.activeFolder = noteData.folder;
        document.getElementById('markdown-input').value = noteData.content;

        await window.EditorState.saveLocalState();
        window.EditorCore.renderMarkdownCore(noteData.content);
        window.EditorCore.renderFoldersList();
        window.EditorCore.renderNotesList();

        document.getElementById('prompt-modal').classList.remove('show');
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();

        if (window.EditorState.appMode === 'github' && window.EditorState.autoSave) {
            window.EditorState.triggerCloudSync();
        }
        window.showToast("<i data-lucide='check-circle'></i> Created");
    },

    async handleSaveProgress() {
        const editor = document.getElementById('markdown-input');
        const activeNote = window.EditorState.getActiveNote();
        if (!activeNote) return;

        activeNote.content = editor.value;
        activeNote.lastUpdated = Date.now();

        await window.EditorState.saveLocalState();

        const saveBtn = document.getElementById('btn-save-progress');
        if (saveBtn) {
            saveBtn.classList.remove('unsaved');
            saveBtn.classList.add('saved');
            setTimeout(() => {
                saveBtn.classList.remove('saved');
            }, 2000);
        }

        if (window.EditorState.appMode === 'github') {
            window.EditorState.triggerCloudSync();
        } else {
            window.showToast("<i data-lucide='save'></i> Saved Locally");
        }
    },

    async handlePushToGitHub() {
        if (window.EditorState.appMode !== 'local') return;
        const selectedIds = Array.from(document.querySelectorAll('#manage-body-content .manage-checkbox:checked')).map(cb => cb.value);
        if (selectedIds.length === 0) return window.showToast("No notes selected.");

        const token = localStorage.getItem('md_github_token');
        if (!token) {
            window.showToast("Connect GitHub first.");
            document.getElementById('setup-modal').classList.add('show');
            return;
        }

        const pushBtn = document.getElementById('btn-push-github');
        const originalHtml = pushBtn.innerHTML;
        pushBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width: 14px;"></i> PUSHING...`;
        pushBtn.disabled = true;
        if (window.lucide) lucide.createIcons();

        let successCount = 0;
        await GitHubBackend.init(token);

        for (const id of selectedIds) {
            const note = window.EditorState.notes.find(n => n.id === id);
            if (!note) continue;

            const result = await GitHubBackend.saveNote(note.id, note.path, note.title, note.content);
            if (result) successCount++;
        }

        pushBtn.innerHTML = originalHtml;
        pushBtn.disabled = false;
        if (window.lucide) lucide.createIcons();

        if (successCount > 0) {
            window.showToast(`<i data-lucide='cloud-check'></i> Pushed ${successCount} notes`);
            document.getElementById('management-modal').classList.remove('show');
        } else {
            window.showToast("<i data-lucide='alert-circle'></i> Push failed");
        }
    },

    async handleConfirmDelete() {
        if (!this.pendingDeleteData.type) return;

        if (this.pendingDeleteData.type === 'note') {
            const idx = window.EditorState.notes.findIndex(n => n.id === this.pendingDeleteData.id);
            if (idx === -1) return;

            const noteToDelete = window.EditorState.notes[idx];
            window.EditorState.notes.splice(idx, 1);

            const editor = document.getElementById('markdown-input');
            if (window.EditorState.activeNoteId === this.pendingDeleteData.id) {
                window.EditorState.activeNoteId = window.EditorState.notes.length > 0 ? window.EditorState.notes[Math.max(0, idx - 1)].id : null;
                if (window.EditorState.activeNoteId) editor.value = window.EditorState.getActiveNote().content;
                else editor.value = "";
            }

            if (window.EditorCore.highlightedNoteId === this.pendingDeleteData.id) {
                let displayNotes = window.EditorState.activeFolder === 'All Notes' ? window.EditorState.notes : window.EditorState.notes.filter(n => n.folder === window.EditorState.activeFolder);
                window.EditorCore.highlightedNoteId = displayNotes.length > 0 ? displayNotes[0].id : null;
            }

            if (window.EditorState.appMode === 'github' && noteToDelete.path) {
                if (navigator.onLine) {
                    GitHubBackend.deleteNote(noteToDelete.path, noteToDelete.id).catch(() => {
                        window.OfflineQueue.add('delete', { path: noteToDelete.path, sha: noteToDelete.id });
                    });
                } else {
                    window.OfflineQueue.add('delete', { path: noteToDelete.path, sha: noteToDelete.id });
                }
            }

            if (window.EditorState.notes.length === 0) {
                const id = Date.now().toString();
                window.EditorState.notes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: window.EditorState.defaultWelcomeNote, lastUpdated: Date.now() }];
                window.EditorState.activeNoteId = id;
                editor.value = window.EditorState.notes[0].content;
            }

            await window.EditorState.saveLocalState();
            await window.StorageManager.deleteNote(this.pendingDeleteData.id);

            window.EditorCore.renderMarkdownCore(editor.value);
            window.EditorCore.renderFoldersList();
            window.EditorCore.renderNotesList();

            if (typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
            if (window.showToast) window.showToast("<i data-lucide='trash-2'></i> Deleted");

            if (document.getElementById('management-modal')?.classList.contains('show')) {
                window.EditorCore.renderManagementModal();
            }
        } else if (this.pendingDeleteData.type === 'folder') {
            window.EditorState.folders = window.EditorState.folders.filter(f => f !== this.pendingDeleteData.id);
            if (window.EditorState.activeFolder === this.pendingDeleteData.id) window.EditorState.activeFolder = 'All Notes';
            window.EditorState.saveFolders();
            window.EditorCore.renderFoldersList();
            window.EditorCore.renderNotesList();
            if (document.getElementById('management-modal')?.classList.contains('show')) {
                window.EditorCore.renderManagementModal();
            }
            if (typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
            window.showToast("<i data-lucide='trash-2'></i> Deleted");
        }

        this.pendingDeleteData = { type: null, id: null };
    },

    async handleRenameConfirm() {
        if (!this.pendingRenameData) return;
        const newTitle = document.getElementById('rename-input').value.trim();
        if (!newTitle) return window.showToast("Name cannot be empty.");

        const targetFolder = this.pendingRenameData.folder || 'All Notes';
        const newPath = window.EditorState.generatePath(targetFolder, newTitle);

        const existing = window.EditorState.notes.find(n => n.path === newPath && n.id !== this.pendingRenameData.id);
        if (existing) return window.showToast("Note already exists.");

        let noteToRename = window.EditorState.notes.find(n => n.id === this.pendingRenameData.id);
        if (noteToRename) {
            noteToRename.title = newTitle;
            noteToRename.path = newPath;
            noteToRename.lastUpdated = Date.now();

            await window.EditorState.saveLocalState();
            window.EditorCore.renderFoldersList();
            window.EditorCore.renderNotesList();
            window.EditorCore.renderManagementModal();
            if (window.EditorState.appMode === 'github') window.EditorState.triggerCloudSync();
            window.showToast("<i data-lucide='check-circle'></i> Renamed");
        }
        document.getElementById('rename-modal').classList.remove('show');
        this.pendingRenameData = null;
    },

    async handleConflictOverwrite() {
        if (!this.pendingNewNoteData) return;
        let exNote = window.EditorState.notes.find(n => n.id === this.pendingNewNoteData.existingId);
        if (exNote) {
            exNote.content = this.pendingNewNoteData.content;
            exNote.lastUpdated = Date.now();
            window.EditorState.activeNoteId = exNote.id;
            window.EditorCore.highlightedNoteId = exNote.id;
            document.getElementById('markdown-input').value = exNote.content;

            await window.EditorState.saveLocalState();
            window.EditorCore.renderMarkdownCore(exNote.content);
            window.EditorCore.renderNotesList();
            if (window.EditorState.appMode === 'github') window.EditorState.triggerCloudSync();
            window.showToast("<i data-lucide='copy'></i> Overwritten");
        }
        document.getElementById('conflict-modal').classList.remove('show');
        if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
        this.pendingNewNoteData = null;
    },

    async handleSecureShare() {
        const editor = document.getElementById('markdown-input');
        const textToShare = editor.value;
        if (!textToShare.trim()) return window.showToast("Note is empty.");

        const token = localStorage.getItem('md_github_token');
        if (!token) {
            window.showToast("Connect GitHub first.");
            document.getElementById('setup-modal').classList.add('show');
            return;
        }

        document.getElementById('share-modal').classList.add('show');
        document.getElementById('share-modal-loading').style.display = 'block';
        document.getElementById('share-modal-content').style.display = 'none';
        if (window.lucide) lucide.createIcons();

        try {
            const secretKey = CryptoJS.lib.WordArray.random(16).toString();
            const encryptedText = CryptoJS.AES.encrypt(textToShare, secretKey).toString();

            await GitHubBackend.init(token);
            const gistResult = await GitHubBackend.createSecretGist(encryptedText);

            if (gistResult && !gistResult.error) {
                const shareableUrl = `https://apandey-studio.vercel.app/share.html?id=${gistResult.id}#${secretKey}`;
                document.getElementById('share-url-input').value = shareableUrl;
                document.getElementById('share-modal-loading').style.display = 'none';
                document.getElementById('share-modal-content').style.display = 'block';
                if (window.lucide) lucide.createIcons();
            } else {
                window.showToast("Needs 'gist' permission.");
                document.getElementById('share-modal').classList.remove('show');
            }
        } catch (err) {
            window.showToast("Encryption Error.");
            document.getElementById('share-modal').classList.remove('show');
        }
    },

    handlePdfExport(customFilename = null) {
        const inputFilename = document.getElementById('pdf-filename');
        let fileName = customFilename || inputFilename.value.trim() || window.EditorState.getActiveNote().title || "Document";
        if (typeof window.closePdfModal === "function") window.closePdfModal();

        const style = document.createElement('style');
        let pageCss = "";

        if (window.selectedPageSize === 'A4') {
            pageCss = `@page { size: A4 portrait; margin: 0; } #preview-output { padding: 24px 48px !important; }`;
        }
        else if (window.selectedPageSize === 'A2') {
            pageCss = `@page { size: A2 portrait; margin: 0; } #preview-output { padding: 36px 64px !important; font-size: 1.2rem !important; }`;
        }
        else if (window.selectedPageSize === 'Infinity') {
            const previewEl = document.getElementById('preview-output');
            const previewPanel = document.getElementById('preview-panel');

            const isHidden = window.getComputedStyle(previewPanel).display === 'none';
            if (isHidden) {
                previewPanel.style.setProperty('display', 'block', 'important');
                previewPanel.style.setProperty('position', 'absolute', 'important');
                previewPanel.style.setProperty('visibility', 'hidden', 'important');
                previewPanel.style.setProperty('z-index', '-1000', 'important');
            }

            const contentHeightPx = previewEl.scrollHeight;

            if (isHidden) {
                previewPanel.style.removeProperty('display');
                previewPanel.style.removeProperty('position');
                previewPanel.style.removeProperty('visibility');
                previewPanel.style.removeProperty('z-index');
            }

            const contentHeightMm = Math.max(Math.ceil(contentHeightPx * 0.264583) + 40, 297);
            pageCss = `@page { size: 210mm ${contentHeightMm}mm; margin: 0; } #preview-output { padding: 24px 48px !important; }`;
        }

        style.innerHTML = pageCss;
        document.head.appendChild(style);

        const originalTitle = document.title;
        document.title = fileName;

        setTimeout(() => {
            window.print();
            document.title = originalTitle;
            document.head.removeChild(style);
            if (typeof window.showToast === "function") window.showToast("<i data-lucide='check'></i> Exported");
        }, 400);
    }
};
