/* js/editor-core.js */
/* ==========================================================================
   EDITOR CORE CONTROLLER
   Handles markdown rendering, preview updates, and UI rendering.
   ========================================================================== */
window.EditorCore = {
    highlightedNoteId: null,
    isScrollSync: true,
    isSyncingLeft: false,
    isSyncingRight: false,
    uiScrollTimeout: null,
    debounceTimeout: null,

    customMarkdownParser(rawText) {
        let processedText = rawText.replace(/\r\n/g, '\n');

        processedText = processedText.replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g, (match, alt, url, options) => {
            let style = 'max-width: 100%; border-radius: 8px; transition: all 0.3s ease; ';
            let isCenter = false;

            if (options) {
                const parts = options.split(',').map(p => p.trim().toLowerCase());
                parts.forEach(part => {
                    if (part === 'center') {
                        isCenter = true;
                    } else if (part === 'left') {
                        style += 'float: left; margin-right: 16px; margin-bottom: 16px; ';
                    } else if (part === 'right') {
                        style += 'float: right; margin-left: 16px; margin-bottom: 16px; ';
                    } else if (part.match(/^(\d+(?:px|rem|em|%)?)(?:x(\d+(?:px|rem|em|%)?|auto))?$/)) {
                        const dimMatch = part.match(/^(\d+(?:px|rem|em|%)?)(?:x(\d+(?:px|rem|em|%)?|auto))?$/);
                        let w = dimMatch[1];
                        if (!isNaN(w)) w += 'px';
                        style += `width: ${w}; `;

                        if (dimMatch[2] && dimMatch[2] !== 'auto') {
                            let h = dimMatch[2];
                            if (!isNaN(h)) h += 'px';
                            style += `height: ${h}; object-fit: cover; `;
                        } else {
                            style += `height: auto; `;
                        }
                    }
                });
            }

            const imgTag = `<img src="${url}" alt="${alt}" style="${style}" class="custom-md-image" />`;
            if (isCenter) return `<div style="text-align: center; width: 100%; clear: both; margin: 16px 0;">${imgTag}</div>`;
            return imgTag;
        });

        processedText = processedText.replace(/^={3,}\s*$/gm, '\n\n<hr class="custom-divider" />\n\n');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s*\n([\s\S]*?)\n\/end/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');
        processedText = processedText.replace(/^\/(center|right|left|justify)\s+(.+)$/gm, '<div style="text-align: $1;">\n\n$2\n\n</div>');

        processedText = processedText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, (match, text, color) => {
            const c = color.toLowerCase();
            if (c === 'white' || c === 'black' || c === '#fff' || c === '#ffffff' || c === '#000' || c === '#000000') {
                return `<span class="adaptive-color">${text}</span>`;
            }
            return `<span style="color: ${color};">${text}</span>`;
        });

        processedText = processedText.replace(/\[\[(.*?)\]\]/g, (match, noteTitle) => {
            const cleanTitle = noteTitle.trim();
            const exists = window.EditorState.notes.some(n => n.title.toLowerCase() === cleanTitle.toLowerCase());
            const linkClass = exists ? 'valid-link' : 'dead-link';
            const icon = exists ? 'file-symlink' : 'file-plus';
            return `<a href="#" class="internal-note-link ${linkClass}" data-note="${cleanTitle}"><i data-lucide="${icon}"></i>${cleanTitle}</a>`;
        });

        const htmlContent = marked.parse(processedText, { breaks: true, gfm: true });

        return DOMPurify.sanitize(htmlContent, {
            ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'g', 'defs', 'clipPath', 'use'],
            ADD_ATTR: ['style', 'class', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'width', 'height', 'x', 'y', 'xmlns', 'transform', 'fill-rule', 'clip-rule', 'data-note']
        });
    },

    injectCopyButtons(container) {
        container.querySelectorAll('pre').forEach((pre) => {
            if (pre.querySelector('.copy-code-btn')) return;

            const btn = document.createElement('button');
            btn.className = 'copy-code-btn';
            btn.innerHTML = '<i data-lucide="copy"></i>';
            btn.title = "Copy Code";

            btn.addEventListener('click', () => {
                const codeBlock = pre.querySelector('code');
                if (codeBlock) {
                    navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                        btn.innerHTML = '<i data-lucide="check" style="color: #10b981;"></i>';
                        if (window.lucide) lucide.createIcons();

                        setTimeout(() => {
                            btn.innerHTML = '<i data-lucide="copy"></i>';
                            if (window.lucide) lucide.createIcons();
                        }, 2000);

                        if (window.showToast) window.showToast("<i data-lucide='check-circle'></i> Copied");
                    });
                }
            });
            pre.appendChild(btn);
        });
    },

    attachInternalLinkListeners(container) {
        container.querySelectorAll('.internal-note-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTitle = link.getAttribute('data-note');
                const targetNote = window.EditorState.notes.find(n => n.title.toLowerCase() === targetTitle.toLowerCase());

                if (targetNote) {
                    window.EditorState.activeNoteId = targetNote.id;
                    this.highlightedNoteId = targetNote.id;
                    window.EditorState.activeFolder = targetNote.folder || 'All Notes';
                    const editor = document.getElementById('markdown-input');
                    editor.value = targetNote.content;
                    window.EditorState.saveLocalState();

                    this.renderMarkdownCore(targetNote.content);

                    this.renderFoldersList();
                    this.renderNotesList();

                    if (document.getElementById('notes-modal')?.classList.contains('show')) {
                        this.renderDashboardPreview();
                    } else {
                        if (window.showToast) window.showToast("<i data-lucide='external-link'></i> Opened");
                    }
                } else {
                    if (window.showToast) window.showToast("<i data-lucide='info'></i> Note not found");
                    const promptModal = document.getElementById('prompt-modal');
                    const promptInput = document.getElementById('prompt-input');
                    if (promptModal && promptInput) {
                        promptInput.value = targetTitle;
                        promptModal.classList.add('show');
                        setTimeout(() => { promptInput.focus(); promptInput.select(); }, 100);
                    }
                }
            });
        });
    },

    async renderMarkdownCore(rawText) {
        this.updateLiveStats(rawText);
        const preview = document.getElementById('preview-output');

        await new Promise(resolve => setTimeout(resolve, 0));

        preview.innerHTML = this.customMarkdownParser(rawText);

        await new Promise(resolve => setTimeout(resolve, 0));
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        }

        this.injectCopyButtons(preview);
        this.attachInternalLinkListeners(preview);

        if (typeof hljs !== 'undefined') {
            preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        }
        if (window.lucide) lucide.createIcons();

        if (this.highlightedNoteId === window.EditorState.activeNoteId && document.getElementById('notes-modal')?.classList.contains('show')) {
            this.renderDashboardPreview();
        }
    },

    updateLiveStats(text) {
        if (typeof text !== 'string') return;
        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;

        const wEl = document.getElementById('stat-words');
        const cEl = document.getElementById('stat-chars');
        const rEl = document.getElementById('stat-reading-time');

        if (wEl) wEl.textContent = `${words} Words`;
        if (cEl) cEl.textContent = `${chars} Characters`;
        if (rEl) rEl.textContent = `${Math.max(1, Math.ceil(words / 200))} min read`;
    },

    async renderDashboardPreview() {
        const previewEl = document.getElementById('dashboard-preview-output');
        const note = window.EditorState.notes.find(n => n.id === this.highlightedNoteId);

        if (!note || !previewEl) {
            if (previewEl) previewEl.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">No note selected</div>`;
            return;
        }

        await new Promise(res => setTimeout(res, 0));

        previewEl.innerHTML = this.customMarkdownParser(note.content);
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(previewEl, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        }

        this.injectCopyButtons(previewEl);
        this.attachInternalLinkListeners(previewEl);

        if (typeof hljs !== 'undefined') {
            previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        }
        if (window.lucide) lucide.createIcons();
    },

    renderFoldersList() {
        this.renderNotesDashboard();
        this.renderMainSidebarFolders();
        this.renderMobileSidebarNotes();
    },

    renderMobileSidebarNotes() {
        const container = document.getElementById('mobile-sidebar-notes-list');
        if (!container) return;
        container.innerHTML = '';

        window.EditorState.notes.forEach(note => {
            const btn = document.createElement('button');
            btn.className = `sidebar-btn sidebar-folder-btn ${note.id === window.EditorState.activeNoteId ? 'active' : ''}`;

            btn.innerHTML = `<i data-lucide="file-text"></i> <span style="flex:1; text-align:left;" class="truncate-text">${note.title}</span>`;

            btn.addEventListener('click', async () => {
                window.EditorState.activeNoteId = note.id;
                this.highlightedNoteId = note.id;
                window.EditorState.activeFolder = note.folder || 'All Notes';
                const editor = document.getElementById('markdown-input');
                editor.value = note.content;
                await window.EditorState.saveLocalState();

                this.renderMarkdownCore(note.content);
                this.renderFoldersList();
                this.renderNotesList();

                document.getElementById('mobile-sidebar-overlay').classList.remove('show');
            });
            container.appendChild(btn);
        });

        if (window.lucide) lucide.createIcons();
    },

    renderNotesList() {
        this.renderNotesDashboard();
    },

    renderNotesDashboard() {
        const container = document.getElementById('notes-dashboard-content');
        if (!container) return;
        container.innerHTML = '';

        window.EditorState.extractFoldersFromNotes();

        // Sort folders to keep "All Notes" at the top
        const sortedFolders = [...window.EditorState.folders].sort((a, b) => {
            if (a === 'All Notes') return -1;
            if (b === 'All Notes') return 1;
            return a.localeCompare(b);
        });

        sortedFolders.forEach(folder => {
            const folderNotes = folder === 'All Notes' ? window.EditorState.notes : window.EditorState.notes.filter(n => n.folder === folder);

            // Skip empty folders unless it's "All Notes"
            if (folder !== 'All Notes' && folderNotes.length === 0) return;

            const folderSection = document.createElement('div');
            folderSection.className = 'dashboard-folder-section';

            const folderTitle = document.createElement('div');
            folderTitle.className = 'dashboard-folder-title collapsible';
            folderTitle.innerHTML = `
                <i data-lucide="chevron-down" class="collapse-icon"></i>
                <i data-lucide="${folder === 'All Notes' ? 'library' : 'folder'}"></i>
                <span class="truncate-text">${folder}</span>
                <span style="margin-left: auto; font-size: 0.7rem; opacity: 0.4; font-weight: 600;">${folderNotes.length}</span>
            `;

            const notesList = document.createElement('div');
            notesList.className = 'dashboard-notes-list collapsed';

            folderTitle.addEventListener('click', (e) => {
                const isCollapsed = notesList.classList.toggle('collapsed');
                const chevron = folderTitle.querySelector('.collapse-icon');
                if (chevron) chevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            });

            folderNotes.forEach(note => {
                const noteRow = document.createElement('div');
                noteRow.className = 'dashboard-note-row';
                if (note.id === window.EditorState.activeNoteId) noteRow.classList.add('active');

                const noteInfo = document.createElement('div');
                noteInfo.className = 'dashboard-note-info';
                noteInfo.innerHTML = `<i data-lucide="file-text" style="opacity: 0.5;"></i> <span class="truncate-text">${note.title}</span>`;

                const actions = document.createElement('div');
                actions.className = 'dashboard-note-actions';

                const openBtn = document.createElement('button');
                openBtn.className = 'dashboard-action-btn btn-open';
                openBtn.innerHTML = '<i data-lucide="external-link"></i>';
                openBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    window.EditorState.activeNoteId = note.id;
                    const editor = document.getElementById('markdown-input');
                    editor.value = note.content;
                    await window.EditorState.saveLocalState();
                    this.renderMarkdownCore(note.content);
                    window.closeNotesModal();
                });

                actions.appendChild(openBtn);

                noteRow.appendChild(noteInfo);
                noteRow.appendChild(actions);

                noteRow.addEventListener('click', (e) => {
                    if (window.innerWidth <= 768) {
                        // On mobile, just open the note on click for minimal UX
                        openBtn.click();
                    } else {
                        document.querySelectorAll('.dashboard-note-row').forEach(r => r.classList.remove('active'));
                        noteRow.classList.add('active');
                    }
                });

                notesList.appendChild(noteRow);
            });

            folderSection.appendChild(folderTitle);
            folderSection.appendChild(notesList);
            container.appendChild(folderSection);

            // Initial state for chevron (collapsed)
            const initialChevron = folderTitle.querySelector('.collapse-icon');
            if (initialChevron) initialChevron.style.transform = 'rotate(-90deg)';
        });

        if (window.lucide) lucide.createIcons();
    },

    renderManagementModal() {
        const bodyContent = document.getElementById('manage-body-content');
        const footerActions = document.getElementById('manage-footer-actions');
        const selectModeCheckbox = document.getElementById('manage-select-mode');
        const pushBtn = document.getElementById('btn-push-github');
        if (!bodyContent) return;

        const isSelectMode = selectModeCheckbox ? selectModeCheckbox.checked : false;
        if (footerActions) footerActions.style.display = isSelectMode ? 'flex' : 'none';
        if (pushBtn) pushBtn.style.display = (isSelectMode && window.EditorState.appMode === 'local') ? 'flex' : 'none';

        bodyContent.innerHTML = '';
        window.EditorState.extractFoldersFromNotes();

        window.EditorState.folders.forEach(folder => {
            const folderNotes = folder === 'All Notes' ? window.EditorState.notes : window.EditorState.notes.filter(n => n.folder === folder);
            if (folder !== 'All Notes' && folderNotes.length === 0) return;

            const folderDiv = document.createElement('div');
            folderDiv.className = 'manage-folder';

            const header = document.createElement('div');
            header.className = 'manage-folder-header';

            const collapseIcon = document.createElement('i');
            collapseIcon.setAttribute('data-lucide', 'chevron-down');
            collapseIcon.className = 'collapse-icon';

            const folderTitle = document.createElement('span');
            folderTitle.style.flex = '1';
            folderTitle.innerHTML = `<i data-lucide="folder" style="width:16px; height:16px; margin-right:8px; vertical-align:-3px;"></i>${folder} <span style="opacity:0.5; font-size:0.8rem; margin-left:8px;">(${folderNotes.length})</span>`;

            header.appendChild(collapseIcon);
            header.appendChild(folderTitle);

            if (folder !== 'All Notes') {
                const fActions = document.createElement('div');
                fActions.className = 'manage-actions';

                const renameF = document.createElement('button');
                renameF.className = 'manage-btn';
                renameF.innerHTML = '<i data-lucide="edit-3"></i>';
                renameF.title = "Rename Folder";
                renameF.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.EditorActions.pendingRenameData = { type: 'folder', name: folder };
                    const input = document.getElementById('rename-input');
                    input.value = folder;
                    document.getElementById('rename-modal').classList.add('show');
                    setTimeout(() => input.focus(), 100);
                });

                const deleteF = document.createElement('button');
                deleteF.className = 'manage-btn btn-danger';
                deleteF.innerHTML = '<i data-lucide="trash-2"></i>';
                deleteF.title = "Delete Folder";
                deleteF.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.EditorActions.pendingDeleteData = { type: 'folder', id: folder };
                    document.getElementById('delete-modal-title').textContent = 'Delete Folder?';
                    document.getElementById('delete-modal-desc').textContent = 'All notes in this folder will be moved to "All Notes". Continue?';
                    document.getElementById('delete-modal').classList.add('show');
                });

                fActions.appendChild(renameF);
                fActions.appendChild(deleteF);
                header.appendChild(fActions);
            }

            const notesContainer = document.createElement('div');
            notesContainer.className = 'manage-notes-container';

            let isCollapsed = false;
            header.addEventListener('click', (e) => {
                if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('.manage-actions') || e.target.type === 'checkbox') return;
                isCollapsed = !isCollapsed;
                notesContainer.classList.toggle('collapsed', isCollapsed);
                collapseIcon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            });

            folderNotes.forEach(note => {
                const noteRow = document.createElement('div');
                noteRow.className = 'manage-note-row';

                if (isSelectMode) {
                    const cbContainer = document.createElement('label');
                    cbContainer.className = 'manage-custom-cb-container';

                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'manage-checkbox';
                    cb.value = note.id;

                    const cbCircle = document.createElement('div');
                    cbCircle.className = 'manage-cb-circle';

                    cbContainer.appendChild(cb);
                    cbContainer.appendChild(cbCircle);

                    cb.addEventListener('change', () => {
                        const checkedCount = document.querySelectorAll('#manage-body-content .manage-checkbox:checked').length;
                        document.getElementById('manage-selected-count').textContent = `${checkedCount} selected`;
                    });
                    noteRow.appendChild(cbContainer);
                }

                const nTitle = document.createElement('div');
                nTitle.className = 'manage-note-title';
                nTitle.innerHTML = `<i data-lucide="file-text" style="width:14px; height:14px; margin-right:8px; opacity:0.7; vertical-align:-2px;"></i>${note.title}`;
                nTitle.title = "Open Note";
                nTitle.style.cursor = 'pointer';

                nTitle.addEventListener('click', async () => {
                    if (isSelectMode) {
                        const cb = noteRow.querySelector('.manage-checkbox');
                        if (cb) {
                            cb.checked = !cb.checked;
                            cb.dispatchEvent(new Event('change'));
                        }
                        return;
                    }

                    document.querySelectorAll('.manage-note-row').forEach(r => r.classList.remove('active'));
                    noteRow.classList.add('active');
                });

                const actions = document.createElement('div');
                actions.className = 'manage-actions';

                const openBtn = document.createElement('button');
                openBtn.className = 'manage-btn btn-open';
                openBtn.innerHTML = '<i data-lucide="external-link"></i>';
                openBtn.title = "Open Note";
                openBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    window.EditorState.activeNoteId = note.id;
                    this.highlightedNoteId = note.id;
                    window.EditorState.activeFolder = note.folder || 'All Notes';
                    document.getElementById('markdown-input').value = note.content;
                    await window.EditorState.saveLocalState();
                    this.renderMarkdownCore(note.content);
                    this.renderFoldersList();
                    this.renderNotesList();
                    document.getElementById('management-modal').classList.remove('show');
                    window.showToast("<i data-lucide='edit-2'></i> Opened");
                });

                const renameBtn = document.createElement('button');
                renameBtn.className = 'manage-btn';
                renameBtn.innerHTML = '<i data-lucide="edit-3"></i>';
                renameBtn.title = "Rename Note";
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.EditorActions.pendingRenameData = { type: 'note', id: note.id };
                    const input = document.getElementById('rename-input');
                    input.value = note.title;
                    document.getElementById('rename-modal').classList.add('show');
                    setTimeout(() => input.focus(), 100);
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'manage-btn btn-danger';
                deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
                deleteBtn.title = "Delete Note";
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.EditorActions.pendingDeleteData = { type: 'note', id: note.id };
                    document.getElementById('delete-modal-title').textContent = 'Delete Note?';
                    document.getElementById('delete-modal-desc').textContent = 'This action cannot be undone. Are you sure?';
                    document.getElementById('delete-modal').classList.add('show');
                });

                actions.appendChild(openBtn);
                actions.appendChild(renameBtn);
                actions.appendChild(deleteBtn);

                noteRow.appendChild(nTitle);
                noteRow.appendChild(actions);
                notesContainer.appendChild(noteRow);
            });

            folderDiv.appendChild(header);
            folderDiv.appendChild(notesContainer);
            bodyContent.appendChild(folderDiv);
        });

        if (window.lucide) lucide.createIcons();
    },

    renderMainSidebarFolders() {
        const container = document.getElementById('dynamic-sidebar-folders');
        if (!container) return;
        container.innerHTML = '';

        window.EditorState.folders.forEach(folder => {
            const btn = document.createElement('button');
            btn.className = `sidebar-btn sidebar-folder-btn ${folder === window.EditorState.activeFolder ? 'active' : ''}`;

            let iconType = folder === 'All Notes' ? 'library' : 'folder';
            let count = folder === 'All Notes' ? window.EditorState.notes.length : window.EditorState.notes.filter(n => n.folder === folder).length;

            btn.innerHTML = `<i data-lucide="${iconType}"></i> <span style="flex:1; text-align:left;">${folder}</span> <span style="font-size: 0.75rem; opacity: 0.6; background: var(--shadow-color); padding: 2px 8px; border-radius: 10px;">${count}</span>`;

            btn.addEventListener('click', () => {
                window.EditorState.activeFolder = folder;
                document.getElementById('mobile-sidebar-overlay').classList.remove('show');
                document.getElementById('notes-modal').classList.add('show');
                this.renderFoldersList();
                this.renderNotesList();
                if (window.innerWidth <= 768) {
                    document.querySelector('.notes-dashboard-box')?.classList.add('show-notes-pane');
                }
            });
            container.appendChild(btn);
        });
        if (window.lucide) lucide.createIcons();
    },

    setupFolderDropdown() {
        const dropdown = document.getElementById('note-folder-dropdown');
        if (!dropdown) return;
        const header = dropdown.querySelector('.dropdown-header');
        const list = dropdown.querySelector('.dropdown-list');
        const textEl = document.getElementById('folder-selected-text');

        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);

        if (list && !list.parentNode.isEqualNode(document.body)) {
            document.body.appendChild(list);
        }

        newHeader.addEventListener('click', (e) => {
            e.stopPropagation();

            const isOpen = list.classList.contains('show');
            document.querySelectorAll('.dropdown-list').forEach(d => {
                d.classList.remove('show');
                d.style.opacity = '0';
                d.style.visibility = 'hidden';
            });
            document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));

            if (!isOpen) {
                const rect = newHeader.getBoundingClientRect();
                list.style.position = 'fixed';
                list.style.top = `${rect.bottom + 8}px`;
                list.style.left = `${rect.left}px`;
                list.style.width = `${Math.max(rect.width, 160)}px`;
                list.style.zIndex = '3700';

                list.classList.add('show');
                dropdown.classList.add('open');
                list.style.opacity = '1';
                list.style.visibility = 'visible';
                list.style.transform = 'translateY(0) scale(1)';
            }
        });

        const currentItems = list.querySelectorAll('.dropdown-item');
        currentItems.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', (e) => {
                currentItems.forEach(i => i.classList.remove('active'));
                e.target.classList.add('active');
                textEl.textContent = e.target.textContent;
                textEl.setAttribute('data-selected', e.target.getAttribute('data-value'));

                dropdown.classList.remove('open');
                list.classList.remove('show');
                list.style.opacity = '0';
                list.style.visibility = 'hidden';
            });
        });
    },

    updatePillUI() {
        const isGithub = window.EditorState.appMode === 'github';

        document.querySelectorAll('[data-target]').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll(`[data-target="${window.EditorState.appMode}"]`).forEach(tab => tab.classList.add('active'));

        const indicator = document.getElementById('active-mode-indicator');
        if (indicator) {
            if (isGithub) {
                if (window.EditorState.isSyncing) {
                    indicator.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> Syncing...`;
                    indicator.style.color = '#3b82f6';
                } else if (window.EditorState.pendingSync) {
                    indicator.innerHTML = `<i data-lucide="cloud-upload" style="width:14px; height:14px;"></i> Pending Sync`;
                    indicator.style.color = '#f59e0b';
                } else {
                    indicator.innerHTML = `<i data-lucide="cloud-check" style="width:14px; height:14px;"></i> Cloud Synced`;
                    indicator.style.color = '#10b981';
                }
            } else {
                indicator.innerHTML = `<i data-lucide="hard-drive" style="width:14px; height:14px;"></i> Local Storage`;
                indicator.style.color = 'var(--text-color)';
            }
        }

        const dashboardBadge = document.getElementById('dashboard-mode-badge');
        if (dashboardBadge) {
            if (isGithub) {
                dashboardBadge.innerHTML = '<i data-lucide="cloud" style="width: 12px; height: 12px;"></i> CLOUD';
                dashboardBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                dashboardBadge.style.color = '#10b981';
                dashboardBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            } else {
                dashboardBadge.innerHTML = '<i data-lucide="hard-drive" style="width: 12px; height: 12px;"></i> LOCAL';
                dashboardBadge.style.backgroundColor = 'var(--shadow-color)';
                dashboardBadge.style.color = 'var(--text-color)';
                dashboardBadge.style.border = '1px solid var(--border-color)';
            }
        }

        if (window.lucide) lucide.createIcons();
    },

    finishAppLoad() {
        const note = window.EditorState.getActiveNote();
        if (!note) return;

        // Reset Save button state on load
        const saveBtn = document.getElementById('btn-save-progress');
        if (saveBtn) {
            saveBtn.classList.remove('unsaved', 'saved');
        }

        // ✨ DATA SAFETY: Recovery from unsaved drafts (e.g. after refresh or crash) ✨
        try {
            const drafts = JSON.parse(localStorage.getItem('md_unsaved_drafts') || '{}');
            let restoredCount = 0;
            window.EditorState.notes.forEach(n => {
                if (drafts[n.id] && drafts[n.id] !== n.content) {
                    n.content = drafts[n.id];
                    restoredCount++;
                }
            });
            if (restoredCount > 0 && window.showToast) {
                window.showToast(`<i data-lucide='life-buoy'></i> Restored ${restoredCount} unsaved draft(s)`);
            }
        } catch (e) {}

        this.highlightedNoteId = window.EditorState.activeNoteId;
        window.EditorState.activeFolder = note.folder || 'All Notes';
        if (!window.EditorState.folders.includes(window.EditorState.activeFolder)) window.EditorState.activeFolder = 'All Notes';

        const editor = document.getElementById('markdown-input');
        editor.disabled = false;
        editor.placeholder = "Start typing your Markdown here...";
        editor.value = note.content || "";

        this.renderMarkdownCore(editor.value);

        this.renderFoldersList();
        this.renderNotesList();
        if (document.getElementById('management-modal')?.classList.contains('show')) this.renderManagementModal();
        if (window.lucide) lucide.createIcons();

        requestAnimationFrame(() => {
            setTimeout(() => {
                document.body.classList.remove('is-loading');
                const skel = document.getElementById('preview-skeleton');
                if (skel) {
                    skel.style.opacity = '0';
                    setTimeout(() => skel.style.display = 'none', 400);
                }
            }, 300);
        });
    },

    getDynamicDebounceTime(textLength) {
        if (textLength > 200000) return 1500;
        if (textLength > 50000) return 800;
        return 300;
    },

    updateLineCol(editor) {
        const text = editor.value.substring(0, editor.selectionStart);
        const lines = text.split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        const el = document.getElementById('stat-line-col');
        if (el) el.textContent = `Line ${line}, Col ${col}`;
    },

    dynamicDebounce(rawText) {
        clearTimeout(this.debounceTimeout);
        const waitTime = this.getDynamicDebounceTime(rawText.length);

        this.debounceTimeout = setTimeout(async () => {
            const activeNote = window.EditorState.getActiveNote();
            if (activeNote) {
                // If Auto Save is OFF, we use temporary caching (drafts)
                if (!window.EditorState.autoSave) {
                    try {
                        let drafts = JSON.parse(localStorage.getItem('md_unsaved_drafts') || '{}');
                        drafts[activeNote.id] = rawText;
                        localStorage.setItem('md_unsaved_drafts', JSON.stringify(drafts));

                        const saveBtn = document.getElementById('btn-save-progress');
                        if (saveBtn) {
                            saveBtn.classList.remove('saved');
                            saveBtn.classList.add('unsaved');
                        }
                    } catch (e) {}
                } else {
                    activeNote.content = rawText;
                    activeNote.lastUpdated = Date.now();

                    await window.EditorState.saveLocalState();
                    if (window.EditorState.appMode === 'github') window.EditorState.triggerCloudSync();

                    // Clear drafts on auto-save
                    try {
                        let drafts = JSON.parse(localStorage.getItem('md_unsaved_drafts') || '{}');
                        if (drafts[activeNote.id]) {
                            delete drafts[activeNote.id];
                            localStorage.setItem('md_unsaved_drafts', JSON.stringify(drafts));
                        }
                    } catch (e) {}
                }
            }
            this.renderMarkdownCore(rawText);
        }, waitTime);
    }
};

/* ==========================================================================
   MAIN INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        await window.StorageManager.init();

        const editor = document.getElementById('markdown-input');
        const previewPanel = document.getElementById('preview-panel');
        const preview = document.getElementById('preview-output');

        editor.disabled = true;

        // Mode Toggles
        document.querySelectorAll('[data-target]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                await window.EditorState.switchToMode(target);
            });
        });

        // Editor Events
        editor.addEventListener('input', () => {
            window.EditorCore.dynamicDebounce(editor.value);
            window.EditorCore.updateLineCol(editor);
        });

        editor.addEventListener('click', () => window.EditorCore.updateLineCol(editor));
        editor.addEventListener('keyup', () => window.EditorCore.updateLineCol(editor));

        editor.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 2;
                editor.dispatchEvent(new Event('input'));
            }
        });

        // Scroll Sync
        const btnScrollSync = document.getElementById('btn-scroll-sync');
        if (btnScrollSync) {
            btnScrollSync.addEventListener('click', () => {
                window.EditorCore.isScrollSync = !window.EditorCore.isScrollSync;
                btnScrollSync.classList.toggle('active', window.EditorCore.isScrollSync);
                btnScrollSync.style.opacity = window.EditorCore.isScrollSync ? '1' : '0.4';
            });
        }

        editor.addEventListener('scroll', () => {
            if (!window.EditorCore.isScrollSync || window.EditorCore.isSyncingLeft) return;
            const editorScrollable = editor.scrollHeight - editor.clientHeight;
            const previewScrollable = previewPanel.scrollHeight - previewPanel.clientHeight;
            if (editorScrollable > 0 && previewScrollable > 0) {
                window.EditorCore.isSyncingRight = true;
                const percentage = editor.scrollTop / editorScrollable;
                previewPanel.scrollTop = percentage * previewScrollable;
                clearTimeout(window.EditorCore.uiScrollTimeout);
                window.EditorCore.uiScrollTimeout = setTimeout(() => { window.EditorCore.isSyncingRight = false; }, 50);
            }
        });

        previewPanel.addEventListener('scroll', () => {
            if (!window.EditorCore.isScrollSync || window.EditorCore.isSyncingRight) return;
            const editorScrollable = editor.scrollHeight - editor.clientHeight;
            const previewScrollable = previewPanel.scrollHeight - previewPanel.clientHeight;
            if (editorScrollable > 0 && previewScrollable > 0) {
                window.EditorCore.isSyncingLeft = true;
                const percentage = previewPanel.scrollTop / previewScrollable;
                editor.scrollTop = percentage * editorScrollable;
                clearTimeout(window.EditorCore.uiScrollTimeout);
                window.EditorCore.uiScrollTimeout = setTimeout(() => { window.EditorCore.isSyncingLeft = false; }, 50);
            }
        });

        // Toolbar Actions
        window.EditorActions.initToolbarActions();

        // New Note & Folder
        document.getElementById('btn-new-note')?.addEventListener('click', () => {
            const promptInput = document.getElementById('prompt-input');
            promptInput.value = '';

            const dropList = document.getElementById('note-folder-dropdown-list');
            const dropText = document.getElementById('folder-selected-text');
            if (dropList && dropText) {
                dropList.innerHTML = '';
                window.EditorState.folders.forEach(f => {
                    const div = document.createElement('div');
                    div.className = `dropdown-item ${f === window.EditorState.activeFolder ? 'active' : ''}`;
                    div.setAttribute('data-value', f);
                    div.textContent = f;
                    dropList.appendChild(div);
                });
                dropText.textContent = window.EditorState.activeFolder;
                dropText.setAttribute('data-selected', window.EditorState.activeFolder);
                window.EditorCore.setupFolderDropdown();
            }

            document.getElementById('prompt-modal').classList.add('show');
            setTimeout(() => { promptInput.focus(); }, 100);
        });

        document.getElementById('prompt-confirm')?.addEventListener('click', () => window.EditorActions.handleNoteCreation());
        document.getElementById('prompt-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.EditorActions.handleNoteCreation(); });
        document.getElementById('prompt-cancel')?.addEventListener('click', () => {
            document.getElementById('prompt-modal').classList.remove('show');
            window.EditorActions.pendingNewNoteData = null;
        });

        document.getElementById('btn-new-folder')?.addEventListener('click', () => {
            const folderPromptInput = document.getElementById('folder-prompt-input');
            folderPromptInput.value = '';
            document.getElementById('folder-prompt-modal').classList.add('show');
            setTimeout(() => { folderPromptInput.focus(); }, 100);
        });

        document.getElementById('btn-quick-new-folder')?.addEventListener('click', () => {
            document.getElementById('prompt-modal').classList.remove('show');
            window.EditorActions.returningToNoteModal = true;
            setTimeout(() => { document.getElementById('btn-new-folder').click(); }, 300);
        });

        document.getElementById('folder-prompt-confirm')?.addEventListener('click', () => {
            const input = document.getElementById('folder-prompt-input');
            let folderName = input.value.trim().replace(/[/\\?%*:|"<>]/g, '-');
            if (!folderName) return window.showToast("Folder name cannot be empty.");
            if (window.EditorState.folders.includes(folderName)) return window.showToast("Folder already exists.");

            window.EditorState.folders.push(folderName);
            window.EditorState.activeFolder = folderName;
            window.EditorState.saveFolders();

            window.EditorCore.renderFoldersList();
            window.EditorCore.renderNotesList();

            document.getElementById('folder-prompt-modal').classList.remove('show');
            window.showToast(`<i data-lucide='folder'></i> Created`);

            if (window.EditorActions.returningToNoteModal) {
                setTimeout(() => { document.getElementById('btn-new-note').click(); }, 300);
                window.EditorActions.returningToNoteModal = false;
            } else if (window.innerWidth <= 768) {
                document.querySelector('.notes-dashboard-box')?.classList.add('show-notes-pane');
            }
        });

        document.getElementById('folder-prompt-cancel')?.addEventListener('click', () => {
            document.getElementById('folder-prompt-modal').classList.remove('show');
            if (window.EditorActions.returningToNoteModal) {
                setTimeout(() => { document.getElementById('btn-new-note').click(); }, 300);
                window.EditorActions.returningToNoteModal = false;
            }
        });

        // Dashboard Actions
        document.getElementById('dash-btn-edit')?.addEventListener('click', async () => {
            if (!window.EditorCore.highlightedNoteId) return;

            const activeNote = window.EditorState.getActiveNote();
            if (activeNote && editor.value !== activeNote.content) {
                activeNote.content = editor.value;
                activeNote.lastUpdated = Date.now();
                await window.EditorState.saveLocalState();
                if (window.EditorState.appMode === 'github') window.EditorState.triggerCloudSync();
            }

            window.EditorState.activeNoteId = window.EditorCore.highlightedNoteId;
            await window.EditorState.saveLocalState();
            editor.value = window.EditorState.getActiveNote().content;
            window.EditorCore.renderMarkdownCore(editor.value);
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
        });

        document.getElementById('dash-btn-delete')?.addEventListener('click', () => {
            if (!window.EditorCore.highlightedNoteId) return;
            window.EditorActions.pendingDeleteData = { type: 'note', id: window.EditorCore.highlightedNoteId };
            document.getElementById('delete-modal-title').textContent = 'Delete Note?';
            document.getElementById('delete-modal-desc').textContent = 'This action cannot be undone. Are you sure?';
            document.getElementById('delete-modal').classList.add('show');
        });

        document.getElementById('dash-btn-export')?.addEventListener('click', async () => {
            if (!window.EditorCore.highlightedNoteId) return;
            window.EditorState.activeNoteId = window.EditorCore.highlightedNoteId;
            await window.EditorState.saveLocalState();
            editor.value = window.EditorState.getActiveNote().content;
            window.EditorCore.renderMarkdownCore(editor.value);
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
            setTimeout(() => { document.getElementById('btn-pdf').click(); }, 300);
        });

        document.getElementById('dash-btn-back')?.addEventListener('click', () => {
            document.querySelector('.notes-dashboard-box')?.classList.remove('show-preview-pane');
        });

        document.getElementById('delete-confirm')?.addEventListener('click', () => window.EditorActions.handleConfirmDelete());

        // Rename Modal
        document.getElementById('rename-confirm')?.addEventListener('click', () => window.EditorActions.handleRenameConfirm());
        document.getElementById('rename-cancel')?.addEventListener('click', () => {
            document.getElementById('rename-modal').classList.remove('show');
            window.EditorActions.pendingRenameData = null;
        });
        document.getElementById('rename-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.EditorActions.handleRenameConfirm();
        });

        // Conflict Modal
        document.getElementById('conflict-cancel')?.addEventListener('click', () => {
            document.getElementById('conflict-modal').classList.remove('show');
            window.EditorActions.pendingNewNoteData = null;
        });
        document.getElementById('conflict-rename')?.addEventListener('click', () => {
            document.getElementById('conflict-modal').classList.remove('show');
            const promptInput = document.getElementById('prompt-input');
            promptInput.value = window.EditorActions.pendingNewNoteData.title + " (New)";
            document.getElementById('prompt-modal').classList.add('show');
            window.EditorActions.pendingNewNoteData = null;
        });
        document.getElementById('conflict-overwrite')?.addEventListener('click', () => window.EditorActions.handleConflictOverwrite());


        // Export PDF
        document.getElementById('modal-confirm')?.addEventListener('click', () => window.EditorActions.handlePdfExport());
        document.getElementById('pdf-filename')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.EditorActions.handlePdfExport(); });

        // Secure Share
        document.getElementById('btn-share')?.addEventListener('click', () => window.EditorActions.handleSecureShare());


        // Mobile / Other listeners
        document.getElementById('mob-back-folders')?.addEventListener('click', () => {
            document.querySelector('.notes-dashboard-box')?.classList.remove('show-notes-pane');
        });

        document.getElementById('manage-select-mode')?.addEventListener('change', () => window.EditorCore.renderManagementModal());

        document.getElementById('btn-start-app')?.addEventListener('click', async () => {
            const tokenInput = document.getElementById('github-token-input');
            const token = tokenInput.value.trim();
            const btn = document.getElementById('btn-start-app');

            if (!token) return window.showToast("Invalid Token.");

            btn.innerHTML = "Connecting...";
            btn.disabled = true;

            const success = await GitHubBackend.init(token);
            if (success) {
                localStorage.setItem('md_github_token', token);
                tokenInput.value = '';
                document.getElementById('setup-modal').classList.remove('show');
                window.showToast("<i data-lucide='check'></i> Connected");
                await window.EditorState.switchToMode('github');
            } else {
                window.showToast("Invalid Token.");
            }
            btn.innerHTML = "Connect";
            btn.disabled = false;
        });

        // Init Settings
        window.EditorState.loadAutoSave();

        // Init App Mode
        const savedMode = localStorage.getItem('md_app_mode') || 'local';
        if (savedMode === 'github') {
            const token = localStorage.getItem('md_github_token');
            if (token) {
                window.EditorState.appMode = 'github';
                window.EditorState.initGitHubMode(token);
            } else {
                window.EditorState.loadLocalMode();
            }
        } else {
            window.EditorState.loadLocalMode();
        }

        // Handle URL Hash Import
        if (window.location.hash && window.location.hash.length > 1) {
            try {
                const encodedData = window.location.hash.substring(1);
                const decodedText = decodeURIComponent(atob(encodedData));
                const sharedId = Date.now().toString();
                const sharedTitle = "Shared Note";
                const sharedPath = window.EditorState.generatePath('All Notes', sharedTitle);

                window.EditorState.notes.unshift({ id: sharedId, path: sharedPath, folder: 'All Notes', title: sharedTitle, content: decodedText, lastUpdated: Date.now() });
                window.EditorState.activeNoteId = sharedId;
                window.EditorCore.highlightedNoteId = sharedId;
                window.EditorState.saveLocalState().then(() => {
                    window.showToast("<i data-lucide='download'></i> Saved");
                    history.replaceState(null, null, ' ');
                    window.EditorCore.renderMarkdownCore(decodedText);
                    window.EditorCore.renderFoldersList();
                    window.EditorCore.renderNotesList();
                });
            } catch (e) { console.error("Invalid import link", e); }
        }

        // Sync with beforeunload
        window.addEventListener('beforeunload', () => {
            const activeNote = window.EditorState.getActiveNote();
            if (activeNote && editor.value) {
                activeNote.content = editor.value;
                activeNote.lastUpdated = Date.now();

                // AutoSave is now always enabled
                window.EditorState.saveLocalState();
            }
        });

        // Handle Online Event
        window.addEventListener('online', () => {
            if (window.EditorState.appMode === 'github') {
                window.OfflineQueue.process();
                window.EditorState.triggerCloudSync();
            }
        });

        // Focus Mode Save logic
        window.addEventListener('focusModeEnabled', async () => {
            await window.EditorState.saveLocalState();
        });

    }, 50);
});

// Helper for UI.js integration
window.getActiveNoteTitle = function() { return window.EditorState.getActiveNoteTitle(); };
window.renderFoldersList = function() { window.EditorCore.renderFoldersList(); };
window.renderNotesList = function() { window.EditorCore.renderNotesList(); };
window.renderManagementModal = function() { window.EditorCore.renderManagementModal(); };
window.setupFolderDropdown = function() { window.EditorCore.setupFolderDropdown(); };
window.renderDashboardPreview = function() { window.EditorCore.renderDashboardPreview(); };
window.closeNotesModal = function() {
    document.getElementById('notes-modal')?.classList.remove('show');
    const dashboardBox = document.querySelector('.notes-dashboard-box');
    if (dashboardBox) {
        dashboardBox.classList.remove('show-preview-pane');
        dashboardBox.classList.add('folders-collapsed');
    }
};
