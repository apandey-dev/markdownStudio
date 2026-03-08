/* js/editor-actions.js */
/* ==========================================================================
   EDITOR ACTIONS CONTROLLER
   Handles modals rendering, folders & notes mutations, export/import logic.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    // Delay ensures editor-core logic completes DOM bindings
    setTimeout(() => {

        window.renderManagementModal = function () {
            const bodyContent = document.getElementById('manage-body-content');
            const footerActions = document.getElementById('manage-footer-actions');
            const selectModeCheckbox = document.getElementById('manage-select-mode');
            if (!bodyContent) return;

            const isSelectMode = selectModeCheckbox ? selectModeCheckbox.checked : false;
            if (footerActions) footerActions.style.display = isSelectMode ? 'flex' : 'none';

            bodyContent.innerHTML = '';
            window.extractFoldersFromNotes();

            window.folders.forEach(folder => {
                const folderNotes = folder === 'All Notes' ? window.notes : window.notes.filter(n => n.folder === folder);
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
                        window.activeNoteId = note.id;
                        window.highlightedNoteId = note.id;
                        window.activeFolder = note.folder || 'All Notes';
                        if (window.editor) window.editor.value = note.content;
                        await window.saveLocalState();
                        window.renderMarkdownCore(note.content);
                        window.renderFoldersList();
                        window.renderNotesList();
                        document.getElementById('management-modal').classList.remove('show');
                        window.showToast("<i data-lucide='edit-2'></i> Opened");
                    });

                    const actions = document.createElement('div');
                    actions.className = 'manage-actions';

                    const isCloud = window.appMode === 'github';

                    // Rename/Move Button
                    const btnRename = document.createElement('button');
                    btnRename.className = 'manage-btn';
                    btnRename.title = "Rename or Move Note";
                    btnRename.innerHTML = '<i data-lucide="edit"></i>';
                    btnRename.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const renameModal = document.getElementById('rename-modal');
                        const renameInput = document.getElementById('rename-input');
                        if (renameModal && renameInput) {
                            renameInput.value = note.title;
                            window.activeFolder = note.folder || 'All Notes';

                            const dropList = document.getElementById('note-folder-dropdown-list');
                            const dropText = document.getElementById('folder-selected-text');
                            if (dropList && dropText) {
                                dropList.innerHTML = '';
                                window.folders.forEach(f => {
                                    const div = document.createElement('div');
                                    div.className = `dropdown-item ${f === window.activeFolder ? 'active' : ''}`;
                                    div.setAttribute('data-value', f);
                                    div.textContent = f;
                                    dropList.appendChild(div);
                                });
                                dropText.textContent = window.activeFolder;
                                dropText.setAttribute('data-selected', window.activeFolder);
                                if (window.setupFolderDropdown) window.setupFolderDropdown();
                            }

                            window.pendingRenameData = { id: note.id, folder: note.folder };
                            renameModal.classList.add('show');
                            setTimeout(() => { renameInput.focus(); }, 100);
                        }
                    });

                    // Delete Button
                    const btnDel = document.createElement('button');
                    btnDel.className = 'manage-btn btn-delete';
                    btnDel.title = "Delete Note";
                    btnDel.innerHTML = '<i data-lucide="trash-2"></i>';
                    btnDel.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.pendingDeleteData = { type: 'note', id: note.id };
                        document.getElementById('delete-modal-title').textContent = 'Delete Note?';
                        document.getElementById('delete-modal-desc').textContent = 'This action cannot be undone. Are you sure?';
                        document.getElementById('delete-modal').classList.add('show');
                    });

                    actions.appendChild(btnRename);
                    actions.appendChild(btnDel);

                    noteRow.appendChild(nTitle);
                    noteRow.appendChild(actions);
                    notesContainer.appendChild(noteRow);
                });

                folderDiv.appendChild(header);
                folderDiv.appendChild(notesContainer);
                bodyContent.appendChild(folderDiv);
            });

            if (window.lucide) lucide.createIcons();
        };

        document.getElementById('manage-select-mode')?.addEventListener('change', () => {
            if (typeof window.renderManagementModal === 'function') window.renderManagementModal();
        });

        window.renderMainSidebarFolders = function () {
            const container = document.getElementById('dynamic-sidebar-folders');
            if (!container) return;
            container.innerHTML = '';

            window.folders.forEach(folder => {
                const btn = document.createElement('button');
                btn.className = `sidebar-btn sidebar-folder-btn ${folder === window.activeFolder ? 'active' : ''}`;

                let iconType = folder === 'All Notes' ? 'library' : 'folder';
                let count = folder === 'All Notes' ? window.notes.length : window.notes.filter(n => n.folder === folder).length;

                btn.innerHTML = `<i data-lucide="${iconType}"></i> <span style="flex:1; text-align:left;">${folder}</span> <span style="font-size: 0.75rem; opacity: 0.6; background: var(--shadow-color); padding: 2px 8px; border-radius: 10px;">${count}</span>`;

                btn.addEventListener('click', () => {
                    window.activeFolder = folder;
                    document.getElementById('mobile-sidebar-overlay')?.classList.remove('show');
                    document.getElementById('notes-modal')?.classList.add('show');
                    window.renderFoldersList();
                    window.renderNotesList();
                    if (window.innerWidth <= 768) {
                        document.querySelector('.notes-dashboard-box')?.classList.add('show-notes-pane');
                    }
                });
                container.appendChild(btn);
            });
            if (window.lucide) lucide.createIcons();
        }

        window.setupFolderDropdown = function () {
            const dropdown = document.getElementById('note-folder-dropdown');
            if (!dropdown) return;
            const header = dropdown.querySelector('.dropdown-header');
            const items = dropdown.querySelectorAll('.dropdown-item');
            const textEl = document.getElementById('folder-selected-text');

            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);

            const list = dropdown.querySelector('.dropdown-list');
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
        }

        window.renderFoldersList = function () {
            const container = document.getElementById('folders-list-container');
            if (!container) return;
            container.innerHTML = '';

            window.extractFoldersFromNotes();

            window.folders.forEach(folder => {
                const div = document.createElement('div');
                div.className = `folder-item ${folder === window.activeFolder ? 'active' : ''}`;

                const iconEl = document.createElement('i');
                iconEl.setAttribute('data-lucide', folder === 'All Notes' ? 'library' : 'folder');

                const textSpan = document.createElement('span');
                textSpan.textContent = folder;
                textSpan.style.flex = "1";
                textSpan.style.whiteSpace = 'nowrap';
                textSpan.style.overflow = 'hidden';
                textSpan.style.textOverflow = 'ellipsis';

                let count = folder === 'All Notes' ? window.notes.length : window.notes.filter(n => n.folder === folder).length;
                const countSpan = document.createElement('span');
                countSpan.textContent = count;
                countSpan.style.fontSize = "0.75rem";
                countSpan.style.opacity = "0.6";

                div.appendChild(iconEl);
                div.appendChild(textSpan);
                div.appendChild(countSpan);

                if (folder !== 'All Notes') {
                    const delBtn = document.createElement('button');
                    delBtn.className = 'folder-del-btn';
                    delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
                    delBtn.title = "Delete Folder";

                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const folderNotes = window.notes.filter(n => n.folder === folder);
                        if (folderNotes.length > 0) {
                            window.showToast("<i data-lucide='alert-circle'></i> Move notes first.");
                            return;
                        }
                        window.pendingDeleteData = { type: 'folder', id: folder };
                        document.getElementById('delete-modal-title').textContent = 'Delete Folder?';
                        document.getElementById('delete-modal-desc').textContent = 'This empty folder will be removed. Are you sure?';
                        document.getElementById('delete-modal').classList.add('show');
                    });
                    div.appendChild(delBtn);
                }

                div.addEventListener('click', () => {
                    window.activeFolder = folder;
                    window.renderFoldersList();
                    window.renderNotesList();

                    if (window.innerWidth <= 768) {
                        document.querySelector('.notes-dashboard-box')?.classList.add('show-notes-pane');
                    }
                });

                container.appendChild(div);
            });

            window.renderMainSidebarFolders();
            if (window.lucide) lucide.createIcons();
        };

        window.renderNotesList = function () {
            const container = document.getElementById('notes-list-container');
            const folderTitle = document.getElementById('current-folder-name');
            if (!container) return;

            container.innerHTML = '';
            if (folderTitle) folderTitle.textContent = window.activeFolder;

            if (window.updatePillUI) window.updatePillUI();

            let displayNotes = window.activeFolder === 'All Notes' ? window.notes : window.notes.filter(n => n.folder === window.activeFolder);

            if (displayNotes.length > 0 && !displayNotes.find(n => n.id === window.highlightedNoteId)) {
                window.highlightedNoteId = displayNotes[0].id;
            } else if (displayNotes.length === 0) {
                window.highlightedNoteId = null;
            }

            displayNotes.forEach(note => {
                const div = document.createElement('div');
                div.className = `note-item ${note.id === window.highlightedNoteId ? 'active' : ''}`;

                const titleContainer = document.createElement('div');
                titleContainer.className = 'note-title';

                const iconEl = document.createElement('i');
                iconEl.setAttribute('data-lucide', 'file-text');

                const textSpan = document.createElement('span');
                textSpan.textContent = note.title;

                titleContainer.appendChild(iconEl);
                titleContainer.appendChild(textSpan);
                div.appendChild(titleContainer);

                div.addEventListener('click', () => {
                    window.highlightedNoteId = note.id;
                    window.renderNotesList();
                    window.renderDashboardPreview();
                    if (window.innerWidth <= 768) {
                        document.querySelector('.notes-dashboard-box')?.classList.add('show-preview-pane');
                    }
                });

                div.addEventListener('dblclick', () => { document.getElementById('dash-btn-edit')?.click(); });
                container.appendChild(div);
            });

            if (window.lucide) lucide.createIcons();
            window.renderDashboardPreview();
        };

        // UI Event Listeners

        document.getElementById('btn-start-app')?.addEventListener('click', async () => {
            const tokenInput = document.getElementById('github-token-input');
            const token = tokenInput.value.trim();
            const btn = document.getElementById('btn-start-app');

            if (!token) return window.showToast("Invalid Token.");

            btn.innerHTML = "Connecting...";
            btn.disabled = true;

            const success = await window.GitHubBackend.init(token);
            if (success) {
                localStorage.setItem('md_github_token', token);
                tokenInput.value = '';
                document.getElementById('setup-modal').classList.remove('show');
                window.showToast("<i data-lucide='check'></i> Connected");
                if (window.switchToMode) await window.switchToMode('github');
            } else {
                window.showToast("Invalid Token.");
            }
            btn.innerHTML = "Connect";
            btn.disabled = false;
        });

        document.querySelectorAll('[data-target]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                if (window.switchToMode) await window.switchToMode(target);
            });
        });

        document.getElementById('mob-back-folders')?.addEventListener('click', () => {
            document.querySelector('.notes-dashboard-box')?.classList.remove('show-notes-pane');
        });

        document.getElementById('dash-btn-edit')?.addEventListener('click', async () => {
            if (!window.highlightedNoteId) return;

            if (window.getActiveNote() && window.editor && window.editor.value !== window.getActiveNote().content) {
                window.getActiveNote().content = window.editor.value;
                window.getActiveNote().lastUpdated = Date.now();
                await window.saveLocalState();
            }

            window.activeNoteId = window.highlightedNoteId;
            await window.saveLocalState();
            if (window.editor) {
                window.editor.value = window.getActiveNote().content;
                window.renderMarkdownCore(window.editor.value);
            }
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
        });

        document.getElementById('dash-btn-delete')?.addEventListener('click', () => {
            if (!window.highlightedNoteId) return;
            window.pendingDeleteData = { type: 'note', id: window.highlightedNoteId };
            document.getElementById('delete-modal-title').textContent = 'Delete Note?';
            document.getElementById('delete-modal-desc').textContent = 'This action cannot be undone. Are you sure?';
            document.getElementById('delete-modal').classList.add('show');
        });

        document.getElementById('dash-btn-export')?.addEventListener('click', async () => {
            if (!window.highlightedNoteId) return;
            window.activeNoteId = window.highlightedNoteId;
            await window.saveLocalState();
            if (window.editor) {
                window.editor.value = window.getActiveNote().content;
                window.renderMarkdownCore(window.editor.value);
            }
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
            setTimeout(() => { document.getElementById('btn-pdf')?.click(); }, 300);
        });

        document.getElementById('dash-btn-back')?.addEventListener('click', () => {
            document.querySelector('.notes-dashboard-box')?.classList.remove('show-preview-pane');
        });

        document.getElementById('delete-confirm')?.addEventListener('click', async () => {
            if (!window.pendingDeleteData.type) return;

            if (window.pendingDeleteData.type === 'note') {
                const idx = window.notes.findIndex(n => n.id === window.pendingDeleteData.id);
                if (idx === -1) return;

                const noteToDelete = window.notes[idx];
                window.notes.splice(idx, 1);

                if (window.activeNoteId === window.pendingDeleteData.id) {
                    window.activeNoteId = window.notes.length > 0 ? window.notes[Math.max(0, idx - 1)].id : null;
                    if (window.editor) {
                        if (window.activeNoteId) window.editor.value = window.getActiveNote().content;
                        else window.editor.value = "";
                    }
                }

                if (window.highlightedNoteId === window.pendingDeleteData.id) {
                    let displayNotes = window.activeFolder === 'All Notes' ? window.notes : window.notes.filter(n => n.folder === window.activeFolder);
                    window.highlightedNoteId = displayNotes.length > 0 ? displayNotes[0].id : null;
                }

                if (window.appMode === 'github' && noteToDelete.path) {
                    if (navigator.onLine) {
                        window.GitHubBackend.deleteNote(noteToDelete.path, noteToDelete.id).catch(() => {
                            window.AppOfflineQueue.add('delete', { path: noteToDelete.path, sha: noteToDelete.id });
                        });
                    } else {
                        window.AppOfflineQueue.add('delete', { path: noteToDelete.path, sha: noteToDelete.id });
                    }
                }

                if (window.notes.length === 0) {
                    const id = Date.now().toString();
                    window.notes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: window.defaultWelcomeNote, lastUpdated: Date.now() }];
                    window.activeNoteId = id;
                    if (window.editor) window.editor.value = window.notes[0].content;
                }

                await window.saveLocalState();
                await window.AppStorageManager.deleteNote(window.pendingDeleteData.id);

                if (window.editor) window.renderMarkdownCore(window.editor.value);
                window.renderFoldersList();
                window.renderNotesList();

                if (typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
                if (window.showToast) window.showToast("<i data-lucide='trash-2'></i> Deleted");

                if (document.getElementById('management-modal')?.classList.contains('show') && typeof window.renderManagementModal === 'function') {
                    window.renderManagementModal();
                }
            } else if (window.pendingDeleteData.type === 'folder') {
                window.folders = window.folders.filter(f => f !== window.pendingDeleteData.id);
                if (window.activeFolder === window.pendingDeleteData.id) window.activeFolder = 'All Notes';
                window.saveFolders();
                window.renderFoldersList();
                window.renderNotesList();
                if (document.getElementById('management-modal')?.classList.contains('show') && typeof window.renderManagementModal === 'function') {
                    window.renderManagementModal();
                }
                if (typeof window.closeDeleteModal === 'function') window.closeDeleteModal();
                window.showToast("<i data-lucide='trash-2'></i> Deleted");
            }

            window.pendingDeleteData = { type: null, id: null };
        });

        const btnNewFolder = document.getElementById('btn-new-folder');
        const folderPromptModal = document.getElementById('folder-prompt-modal');
        const folderPromptInput = document.getElementById('folder-prompt-input');
        let returningToNoteModal = false;

        btnNewFolder?.addEventListener('click', () => {
            folderPromptInput.value = '';
            folderPromptModal.classList.add('show');
            setTimeout(() => { folderPromptInput.focus(); }, 100);
        });

        document.getElementById('btn-quick-new-folder')?.addEventListener('click', () => {
            document.getElementById('prompt-modal').classList.remove('show');
            returningToNoteModal = true;
            setTimeout(() => { btnNewFolder.click(); }, 300);
        });

        document.getElementById('folder-prompt-confirm')?.addEventListener('click', () => {
            let folderName = folderPromptInput.value.trim().replace(/[/\\?%*:|"<>]/g, '-');
            if (!folderName) return window.showToast("Folder name cannot be empty.");
            if (window.folders.includes(folderName)) return window.showToast("Folder already exists.");

            window.folders.push(folderName);
            window.activeFolder = folderName;
            window.saveFolders();

            window.renderFoldersList();
            window.renderNotesList();

            folderPromptModal.classList.remove('show');
            window.showToast(`<i data-lucide='folder'></i> Created`);

            if (returningToNoteModal) {
                setTimeout(() => { document.getElementById('btn-new-note')?.click(); }, 300);
                returningToNoteModal = false;
            } else if (window.innerWidth <= 768) {
                document.querySelector('.notes-dashboard-box')?.classList.add('show-notes-pane');
            }
        });

        document.getElementById('folder-prompt-cancel')?.addEventListener('click', () => {
            folderPromptModal.classList.remove('show');
            if (returningToNoteModal) {
                setTimeout(() => { document.getElementById('btn-new-note')?.click(); }, 300);
                returningToNoteModal = false;
            }
        });

        const btnNewNote = document.getElementById('btn-new-note');
        const promptModal = document.getElementById('prompt-modal');
        const promptInput = document.getElementById('prompt-input');

        btnNewNote?.addEventListener('click', () => {
            promptInput.value = '';

            const dropList = document.getElementById('note-folder-dropdown-list');
            const dropText = document.getElementById('folder-selected-text');
            if (dropList && dropText) {
                dropList.innerHTML = '';
                window.folders.forEach(f => {
                    const div = document.createElement('div');
                    div.className = `dropdown-item ${f === window.activeFolder ? 'active' : ''}`;
                    div.setAttribute('data-value', f);
                    div.textContent = f;
                    dropList.appendChild(div);
                });
                dropText.textContent = window.activeFolder;
                dropText.setAttribute('data-selected', window.activeFolder);
                if (window.setupFolderDropdown) window.setupFolderDropdown();
            }

            promptModal.classList.add('show');
            setTimeout(() => { promptInput.focus(); }, 100);
        });

        window.executeNoteCreation = async function (noteData) {
            window.notes.unshift(noteData);
            window.activeNoteId = noteData.id;
            window.highlightedNoteId = noteData.id;
            window.activeFolder = noteData.folder; 
            
            if (window.editor) window.editor.value = noteData.content;

            await window.saveLocalState();
            window.renderMarkdownCore(noteData.content);
            window.renderFoldersList();
            window.renderNotesList();

            promptModal.classList.remove('show');
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();

            window.showToast("<i data-lucide='check-circle'></i> Created");
        };

        const createNoteFlow = async () => {
            let noteName = promptInput.value.trim() || "Untitled Note";

            const dropText = document.getElementById('folder-selected-text');
            let targetFolder = dropText ? dropText.getAttribute('data-selected') : window.activeFolder;
            if (!targetFolder) targetFolder = window.activeFolder;

            const generatedPath = window.generatePath(targetFolder, noteName);
            const existingNote = window.notes.find(n => n.path === generatedPath);

            if (window.pendingNewNoteData && window.pendingNewNoteData.isRename) {
                if (existingNote && existingNote.id !== window.pendingNewNoteData.targetId) {
                    window.showToast("Note already exists in target folder.");
                    return;
                }
                let noteToRename = window.notes.find(n => n.id === window.pendingNewNoteData.targetId);
                if (noteToRename) {
                    noteToRename.title = noteName;
                    noteToRename.folder = targetFolder;
                    noteToRename.path = generatedPath;
                    noteToRename.lastUpdated = Date.now();

                    await window.saveLocalState();
                    window.renderFoldersList();
                    window.renderNotesList();
                    if (typeof window.renderManagementModal === 'function') window.renderManagementModal();

                    window.showToast("<i data-lucide='check-circle'></i> Updated");
                }
                promptModal.classList.remove('show');
                window.pendingNewNoteData = null;
                return;
            }

            const newId = Date.now().toString();
            const content = `# ${noteName}\n\nStart typing here...`;

            if (existingNote) {
                window.pendingNewNoteData = { id: newId, path: generatedPath, folder: targetFolder, title: noteName, content: content, existingId: existingNote.id };
                document.getElementById('conflict-filename').textContent = noteName + ".md";
                promptModal.classList.remove('show');
                document.getElementById('conflict-modal').classList.add('show');
                return;
            }

            await window.executeNoteCreation({ id: newId, path: generatedPath, folder: targetFolder, title: noteName, content: content, lastUpdated: Date.now() });
        };

        document.getElementById('prompt-confirm')?.addEventListener('click', createNoteFlow);
        promptInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') createNoteFlow(); });
        document.getElementById('prompt-cancel')?.addEventListener('click', () => {
            promptModal.classList.remove('show');
            window.pendingNewNoteData = null;
        });

        document.getElementById('rename-confirm')?.addEventListener('click', async () => {
            if (!window.pendingRenameData) return;
            const newTitle = document.getElementById('rename-input').value.trim();
            if (!newTitle) return window.showToast("Name cannot be empty.");

            const targetFolder = window.pendingRenameData.folder || 'All Notes';
            const newPath = window.generatePath(targetFolder, newTitle);

            const existing = window.notes.find(n => n.path === newPath && n.id !== window.pendingRenameData.id);
            if (existing) return window.showToast("Note already exists.");

            let noteToRename = window.notes.find(n => n.id === window.pendingRenameData.id);
            if (noteToRename) {
                noteToRename.title = newTitle;
                noteToRename.path = newPath;
                noteToRename.lastUpdated = Date.now();

                await window.saveLocalState();
                window.renderFoldersList();
                window.renderNotesList();
                if (typeof window.renderManagementModal === 'function') window.renderManagementModal();
                window.showToast("<i data-lucide='check-circle'></i> Renamed");
            }
            document.getElementById('rename-modal').classList.remove('show');
            window.pendingRenameData = null;
        });
        
        document.getElementById('rename-cancel')?.addEventListener('click', () => {
            document.getElementById('rename-modal').classList.remove('show');
            window.pendingRenameData = null;
        });
        document.getElementById('rename-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('rename-confirm')?.click();
        });

        document.getElementById('conflict-cancel')?.addEventListener('click', () => {
            document.getElementById('conflict-modal').classList.remove('show');
            window.pendingNewNoteData = null;
        });

        document.getElementById('conflict-rename')?.addEventListener('click', () => {
            document.getElementById('conflict-modal').classList.remove('show');
            promptInput.value = window.pendingNewNoteData.title + " (New)";
            promptModal.classList.add('show');
            window.pendingNewNoteData = null;
        });

        document.getElementById('conflict-overwrite')?.addEventListener('click', async () => {
            if (!window.pendingNewNoteData) return;
            let exNote = window.notes.find(n => n.id === window.pendingNewNoteData.existingId);
            if (exNote) {
                exNote.content = window.pendingNewNoteData.content;
                exNote.lastUpdated = Date.now();
                window.activeNoteId = exNote.id;
                window.highlightedNoteId = exNote.id;
                if (window.editor) window.editor.value = exNote.content;

                await window.saveLocalState();
                window.renderMarkdownCore(exNote.content);
                window.renderNotesList();
                window.showToast("<i data-lucide='copy'></i> Overwritten");
            }
            document.getElementById('conflict-modal').classList.remove('show');
            if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
            window.pendingNewNoteData = null;
        });

        document.querySelectorAll('.tool-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!window.editor) return;
                const action = btn.getAttribute('data-action');
                const start = window.editor.selectionStart;
                const end = window.editor.selectionEnd;
                let selection = window.editor.value.substring(start, end);
                const fullText = window.editor.value;

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

                window.editor.focus();

                if (prefix && suffix && selection.startsWith(prefix) && selection.endsWith(suffix) && selection.length >= prefix.length + suffix.length) {
                    const unstripped = selection.substring(prefix.length, selection.length - suffix.length);
                    window.editor.value = fullText.substring(0, start) + unstripped + fullText.substring(end);
                    window.editor.selectionStart = start;
                    window.editor.selectionEnd = start + unstripped.length;
                    window.editor.dispatchEvent(new Event('input'));
                    return;
                }

                const textBefore = fullText.substring(Math.max(0, start - prefix.length), start);
                const textAfter = fullText.substring(end, end + suffix.length);

                if (prefix && suffix && textBefore === prefix && textAfter === suffix) {
                    window.editor.value = fullText.substring(0, start - prefix.length) + selection + fullText.substring(end + suffix.length);
                    window.editor.selectionStart = start - prefix.length;
                    window.editor.selectionEnd = start - prefix.length + selection.length;
                    window.editor.dispatchEvent(new Event('input'));
                    return;
                }

                if (action === 'heading') {
                    const lineStart = fullText.lastIndexOf('\n', start - 1) + 1;
                    const lineEnd = fullText.indexOf('\n', end);
                    const actualLineEnd = lineEnd === -1 ? fullText.length : lineEnd;
                    const lineText = fullText.substring(lineStart, actualLineEnd);

                    if (lineText.trimStart().startsWith('### ')) {
                        const stripped = lineText.replace(/^\s*###\s*/, '');
                        window.editor.value = fullText.substring(0, lineStart) + stripped + fullText.substring(actualLineEnd);
                        const offset = Math.max(lineStart, start - 4);
                        window.editor.selectionStart = window.editor.selectionEnd = offset;
                        window.editor.dispatchEvent(new Event('input'));
                        return;
                    }
                }

                const textToWrap = selection || defaultText;
                window.editor.value = fullText.substring(0, start) + prefix + textToWrap + suffix + fullText.substring(end);

                if (!selection) {
                    window.editor.selectionStart = start + prefix.length;
                    window.editor.selectionEnd = start + prefix.length + defaultText.length;
                } else {
                    window.editor.selectionStart = start + prefix.length;
                    window.editor.selectionEnd = start + prefix.length + selection.length;
                }
                window.editor.dispatchEvent(new Event('input'));
            });
        });

        const btnExportMd = document.getElementById('btn-export-md');
        const btnImportMd = document.getElementById('btn-import-md');
        const importFile = document.getElementById('import-file');

        btnExportMd?.addEventListener('click', () => {
            if (!window.editor) return;
            const text = window.editor.value;
            const blob = new Blob([text], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            let safeTitle = window.getActiveNote().title.replace(/[/\\?%*:|"<>]/g, '_').toLowerCase();
            if (safeTitle === 'untitled_note' || !safeTitle) safeTitle = 'markdown_document';
            a.download = `${safeTitle}.md`;
            a.click();
            URL.revokeObjectURL(url);
            window.showToast("<i data-lucide='download'></i> Downloaded");
        });

        btnImportMd?.addEventListener('click', () => importFile.click());

        importFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target.result;
                const rawTitle = file.name.replace('.md', '').replace('.txt', '');
                const folder = window.activeFolder;
                const newPath = window.generatePath(folder, rawTitle);
                const newId = Date.now().toString();

                if (window.notes.find(n => n.path === newPath)) {
                    window.showToast("<i data-lucide='alert-triangle'></i> File exists.");
                    return;
                }

                window.notes.unshift({ id: newId, path: newPath, folder: folder, title: rawTitle, content: content, lastUpdated: Date.now() });
                window.activeNoteId = newId;
                window.highlightedNoteId = newId;
                if (window.editor) window.editor.value = content;

                await window.saveLocalState();
                window.renderMarkdownCore(content);
                if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
                if (typeof window.renderNotesList === 'function') window.renderNotesList();
                if (typeof window.renderManagementModal === 'function') window.renderManagementModal();
                window.showToast("<i data-lucide='file-up'></i> Imported");
            };
            reader.readAsText(file);
            importFile.value = '';
        });

        if (window.location.hash && window.location.hash.length > 1) {
            try {
                const encodedData = window.location.hash.substring(1);
                const decodedText = decodeURIComponent(atob(encodedData));
                const sharedId = Date.now().toString();
                const sharedTitle = "Shared Note";
                const sharedPath = window.generatePath('All Notes', sharedTitle);

                window.notes.unshift({ id: sharedId, path: sharedPath, folder: 'All Notes', title: sharedTitle, content: decodedText, lastUpdated: Date.now() });
                window.activeNoteId = sharedId;
                window.highlightedNoteId = sharedId;
                window.saveLocalState().then(() => {
                    window.showToast("<i data-lucide='download'></i> Saved");
                    history.replaceState(null, null, ' ');
                });
            } catch (e) { console.error("Invalid import link", e); }
        }

        window.inputFilename?.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.btnConfirmPdf?.click(); });

        window.btnConfirmPdf?.addEventListener('click', () => {
            let fileName = window.inputFilename.value.trim() || window.getActiveNote().title || "Document";
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
        });

        window.shareBtn?.addEventListener('click', async () => {
            if (!window.editor) return;
            const textToShare = window.editor.value;
            if (!textToShare.trim()) return window.showToast("Note is empty.");

            const token = localStorage.getItem('md_github_token');
            if (!token) {
                window.showToast("Connect GitHub first.");
                document.getElementById('setup-modal').classList.add('show');
                return;
            }

            const originalHtml = window.shareBtn.innerHTML;
            window.shareBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width: 16px;"></i> Generating`;
            window.shareBtn.disabled = true;
            if (window.lucide) lucide.createIcons();

            try {
                const secretKey = CryptoJS.lib.WordArray.random(16).toString();
                const encryptedText = CryptoJS.AES.encrypt(textToShare, secretKey).toString();

                await window.GitHubBackend.init(token);
                const gistResult = await window.GitHubBackend.createSecretGist(encryptedText);

                if (gistResult && !gistResult.error) {
                    const shareableUrl = `https://apandey-studio.vercel.app/share.html?id=${gistResult.id}#${secretKey}`;
                    if (navigator.share) {
                        try { await navigator.share({ title: window.getActiveNote().title, url: shareableUrl }); }
                        catch (err) { console.log(err); }
                    } else {
                        await navigator.clipboard.writeText(shareableUrl);
                        window.showToast("<i data-lucide='link'></i> Link Copied");
                    }
                } else {
                    window.showToast("Needs 'gist' permission.");
                }
            } catch (err) {
                window.showToast("Encryption Error.");
            }

            window.shareBtn.innerHTML = originalHtml;
            window.shareBtn.disabled = false;
            if (window.lucide) lucide.createIcons();
        });

    }, 100);
});