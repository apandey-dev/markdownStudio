/* js/ui.js */
/* ==========================================================================
   UI CONTROLLER
   Handles interactions, modals, themes, folders collapse, fonts, layout safely.
   ========================================================================== */

window.selectedPageSize = 'A4';
window.toastTimeout = null;

// Short duration for minimal intrusion
window.showToast = function (message, duration = 2500) {
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

window.closePdfModal = function () { document.getElementById('pdf-modal')?.classList.remove('show'); };
window.closeDeleteModal = function () { document.getElementById('delete-modal')?.classList.remove('show'); };
window.closePromptModal = function () { document.getElementById('prompt-modal')?.classList.remove('show'); };
window.closePatGuideModal = function () { document.getElementById('pat-guide-modal')?.classList.remove('show'); };
window.closeDocsModal = function () { document.getElementById('docs-modal')?.classList.remove('show'); };
window.closeManageModal = function () { document.getElementById('management-modal')?.classList.remove('show'); };
window.closeTransferModal = function () { document.getElementById('transfer-modal')?.classList.remove('show'); };
window.closeSettingsModal = function () { document.getElementById('settings-modal')?.classList.remove('show'); };

// window.closeNotesModal is now handled in editor-core.js

document.addEventListener('DOMContentLoaded', () => {

    if (window.lucide) lucide.createIcons();

    // ✨ CUSTOM TOOLTIP SYSTEM ✨
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    document.body.appendChild(tooltip);

    let tooltipTimeout;

    const showTooltip = (el, text) => {
        if (!el || el.offsetWidth === 0) return;

        tooltip.textContent = text;

        // Temporarily show to measure dimensions accurately
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'hidden';
        tooltip.classList.remove('show');

        const rect = el.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top = rect.top - tooltipRect.height - 10;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // Viewport boundaries
        const padding = 12;
        if (left < padding) left = padding;
        if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }

        // Vertical flipping with bottom boundary check
        if (top < padding) {
            const bottomTop = rect.bottom + 10;
            if (bottomTop + tooltipRect.height > window.innerHeight - padding) {
                // If it doesn't fit at bottom either, pick the side with more space
                if (rect.top > (window.innerHeight - rect.bottom)) {
                    top = padding;
                } else {
                    top = window.innerHeight - tooltipRect.height - padding;
                }
            } else {
                top = bottomTop;
            }
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;

        // Clear measurement styles and show
        tooltip.style.display = '';
        tooltip.style.visibility = '';
        tooltip.classList.add('show');
    };

    const hideTooltip = () => {
        tooltip.classList.remove('show');
    };

    let currentTooltipTarget = null;

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target && target !== currentTooltipTarget) {
            currentTooltipTarget = target;
            clearTimeout(tooltipTimeout);
            tooltipTimeout = setTimeout(() => showTooltip(target, target.getAttribute('data-tooltip')), 400);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip]');
        const related = e.relatedTarget?.closest?.('[data-tooltip]');

        if (target && target !== related) {
            currentTooltipTarget = null;
            clearTimeout(tooltipTimeout);
            hideTooltip();
        }
    });

    // Init Focus Mode
    const initFocusMode = () => {
        if(localStorage.getItem('md_focus_mode') === 'true') {
            document.body.classList.add('focus-mode');
            setTimeout(() => window.dispatchEvent(new Event('focusModeEnabled')), 100);
        }
    };
    initFocusMode();

    document.getElementById('btn-focus-mode')?.addEventListener('click', () => {
        document.body.classList.add('focus-mode');
        localStorage.setItem('md_focus_mode', 'true');
        window.dispatchEvent(new Event('focusModeEnabled'));

        // Reapply UI visibility to handle Focus Mode recovery buttons
        window.EditorState.applyUIVisibility();
        window.showToast("<i data-lucide='scan'></i> Focus Mode Enabled");
    });

    document.getElementById('btn-exit-focus')?.addEventListener('click', () => {
        document.body.classList.remove('focus-mode');
        localStorage.setItem('md_focus_mode', 'false');

        window.EditorState.applyUIVisibility();
        window.showToast("<i data-lucide='minimize'></i> Focus Mode Disabled");
    });

    document.getElementById('btn-exit-focus-floating')?.addEventListener('click', () => {
        document.getElementById('btn-exit-focus')?.click();
    });

    document.getElementById('btn-exit-focus-status')?.addEventListener('click', () => {
        document.getElementById('btn-exit-focus')?.click();
    });

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

    document.querySelectorAll('.modal-trigger-notes').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('notes-modal')?.classList.add('show');
            if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
            if (typeof window.renderNotesList === 'function') window.renderNotesList();
            document.getElementById('mobile-sidebar-overlay')?.classList.remove('show');
        });
    });

    document.getElementById('btn-manage')?.addEventListener('click', () => {
        document.getElementById('management-modal')?.classList.add('show');
        if (typeof window.renderManagementModal === 'function') window.renderManagementModal();
    });

    document.getElementById('sidebar-btn-manage-mobile')?.addEventListener('click', () => {
        document.getElementById('mobile-sidebar-overlay')?.classList.remove('show');
        document.getElementById('management-modal')?.classList.add('show');
        if (typeof window.renderManagementModal === 'function') window.renderManagementModal();
    });

    document.getElementById('manage-modal-close')?.addEventListener('click', window.closeManageModal);
    document.getElementById('notes-modal-close')?.addEventListener('click', window.closeNotesModal);
    document.getElementById('transfer-modal-close')?.addEventListener('click', window.closeTransferModal);

    document.getElementById('btn-docs')?.addEventListener('click', () => {
        document.getElementById('docs-modal')?.classList.add('show');
    });
    document.getElementById('sidebar-btn-docs-mobile')?.addEventListener('click', () => {
        document.getElementById('mobile-sidebar-overlay')?.classList.remove('show');
        document.getElementById('docs-modal')?.classList.add('show');
    });
    document.getElementById('docs-modal-close')?.addEventListener('click', window.closeDocsModal);

    // ✨ SETTINGS MODAL ✨
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        initSettingsToggles();
        document.getElementById('settings-modal')?.classList.add('show');
    });
    document.getElementById('btn-settings-minimal')?.addEventListener('click', () => {
        initSettingsToggles();
        document.getElementById('settings-modal')?.classList.add('show');
    });
    document.getElementById('sidebar-btn-settings-mobile')?.addEventListener('click', () => {
        document.getElementById('mobile-sidebar-overlay')?.classList.remove('show');
        initSettingsToggles();
        document.getElementById('settings-modal')?.classList.add('show');
    });
    document.getElementById('settings-modal-close')?.addEventListener('click', () => {
        initSettingsToggles(); // Revert local DOM changes on close
        window.closeSettingsModal();
    });

    document.getElementById('btn-pat-help')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('pat-guide-modal')?.classList.add('show');
    });
    document.getElementById('pat-guide-close')?.addEventListener('click', window.closePatGuideModal);
    
    document.getElementById('btn-cancel-setup')?.addEventListener('click', () => {
        document.getElementById('setup-modal').classList.remove('show');
    });

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

    const mobileViewToggle = document.getElementById('mobile-view-toggle');
    if (mobileViewToggle) {
        mobileViewToggle.addEventListener('click', () => {
            document.body.classList.toggle('show-preview');
            const isPreview = document.body.classList.contains('show-preview');
            mobileViewToggle.innerHTML = isPreview ? '<i data-lucide="edit-2"></i>' : '<i data-lucide="eye"></i>';
            if (window.lucide) lucide.createIcons();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (sidebarOverlay?.classList.contains('show')) { sidebarOverlay.classList.remove('show'); return; }
            const openDropdown = document.querySelector('.custom-dropdown.open');
            if (openDropdown) { 
                openDropdown.classList.remove('open'); 
                document.querySelectorAll('.dropdown-list').forEach(l => {
                    l.style.opacity = '0';
                    l.style.visibility = 'hidden';
                });
                return; 
            }
            
            if (document.getElementById('conflict-modal')?.classList.contains('show')) { document.getElementById('conflict-cancel')?.click(); return; }
            if (document.getElementById('folder-prompt-modal')?.classList.contains('show')) { document.getElementById('folder-prompt-cancel')?.click(); return; }
            if (document.getElementById('prompt-modal')?.classList.contains('show')) { document.getElementById('prompt-cancel')?.click(); return; }
            if (document.getElementById('delete-modal')?.classList.contains('show')) { document.getElementById('delete-cancel')?.click(); return; }
            if (document.getElementById('pdf-modal')?.classList.contains('show')) { document.getElementById('modal-cancel')?.click(); return; }
            if (document.getElementById('rename-modal')?.classList.contains('show')) { document.getElementById('rename-cancel')?.click(); return; }
            if (document.getElementById('transfer-modal')?.classList.contains('show')) { window.closeTransferModal(); return; }
            
            if (document.getElementById('setup-modal')?.classList.contains('show')) { document.getElementById('btn-cancel-setup')?.click(); return; }
            if (document.getElementById('pat-guide-modal')?.classList.contains('show')) { document.getElementById('pat-guide-close')?.click(); return; }
            if (document.getElementById('docs-modal')?.classList.contains('show')) { window.closeDocsModal(); return; }
            if (document.getElementById('management-modal')?.classList.contains('show')) { window.closeManageModal(); return; }
            if (document.getElementById('settings-modal')?.classList.contains('show')) { window.closeSettingsModal(); return; }
            
            if (document.getElementById('notes-modal')?.classList.contains('show')) { if (typeof window.closeNotesModal === 'function') window.closeNotesModal(); return; }
        }
    });

    const toggleFoldersBtn = document.getElementById('toggle-folders-btn');
    const dashboardBox = document.querySelector('.notes-dashboard-box');
    toggleFoldersBtn?.addEventListener('click', () => {
        dashboardBox.classList.toggle('folders-collapsed');
    });

    // Modified setupDropdown for Font Picker Fix to detach the list and avoid clipping
    function setupToolbarDropdown(dropdownId, textId, callback) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        const header = dropdown.querySelector('.dropdown-header');
        const list = dropdown.querySelector('.dropdown-list');
        const textEl = document.getElementById(textId);

        // Break out of overflow:hidden parent by appending to body
        if (list && !list.parentNode.isEqualNode(document.body)) {
            document.body.appendChild(list);
        }

        header?.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const isOpen = list.classList.contains('show');
            
            // Close others
            document.querySelectorAll('.dropdown-list').forEach(d => {
                d.classList.remove('show');
                d.style.opacity = '0';
                d.style.visibility = 'hidden';
            });
            document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
            
            if (!isOpen) {
                const rect = header.getBoundingClientRect();
                list.style.position = 'fixed';
                list.style.top = `${rect.bottom + 8}px`;
                list.style.left = `${rect.left}px`;
                list.style.width = `${Math.max(rect.width, 160)}px`;
                list.style.zIndex = '3000';
                
                list.classList.add('show');
                dropdown.classList.add('open');
                list.style.opacity = '1';
                list.style.visibility = 'visible';
                list.style.transform = 'translateY(0) scale(1)';
            }
        });

        // Use event delegation for dynamically added items or query them directly
        const items = list.querySelectorAll('.dropdown-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                items.forEach(i => i.classList.remove('active'));
                e.target.classList.add('active');
                if (textEl) textEl.textContent = e.target.textContent;
                
                dropdown.classList.remove('open');
                list.classList.remove('show');
                list.style.opacity = '0';
                list.style.visibility = 'hidden';
                
                if (callback) callback(e.target.getAttribute('data-value'));
            });
        });
    }

    // Generic setupDropdown for other static non-toolbar dropdowns (like in PDF modal)
    function setupStaticDropdown(dropdownId, textId, callback) {
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
                if (textEl) textEl.textContent = e.target.textContent;
                dropdown.classList.remove('open');
                if (callback) callback(e.target.getAttribute('data-value'));
            });
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
        document.querySelectorAll('.dropdown-list').forEach(l => {
            // Only affect the detached/floating ones that we manage via JS styles
            if (l.parentNode.isEqualNode(document.body)) {
                l.classList.remove('show');
                l.style.opacity = '0';
                l.style.visibility = 'hidden';
            }
        });
    });

    const savedFont = localStorage.getItem('md_studio_font') || 'Fredoka';
    let initialFallback = savedFont === 'Fredoka' ? 'sans-serif' : 'cursive';
    document.documentElement.style.setProperty('--preview-font', `'${savedFont}', ${initialFallback}`);
    document.documentElement.style.setProperty('--editor-font', `'${savedFont}', ${initialFallback}`);

    const fontDropdownItems = document.querySelectorAll('#font-dropdown .dropdown-item');
    const fontSelectedText = document.getElementById('font-selected-text');
    if (fontDropdownItems.length > 0 && fontSelectedText) {
        fontDropdownItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-value') === savedFont) {
                item.classList.add('active');
                fontSelectedText.textContent = item.textContent;
            }
        });
    }

    setupToolbarDropdown('font-dropdown', 'font-selected-text', (val) => {
        let fallback = val === 'Fredoka' ? 'sans-serif' : 'cursive';
        document.documentElement.style.setProperty('--preview-font', `'${val}', ${fallback}`);
        document.documentElement.style.setProperty('--editor-font', `'${val}', ${fallback}`);
        localStorage.setItem('md_studio_font', val);
    });

    setupStaticDropdown('size-dropdown', 'size-selected-text', (val) => {
        window.selectedPageSize = val;
    });

    const divider = document.getElementById('drag-divider');
    const editorPanel = document.getElementById('editor-panel-wrapper');
    const previewPanel = document.getElementById('preview-panel');
    const container = document.getElementById('split-workspace');
    const restoreLeft = document.getElementById('restore-left');
    const restoreRight = document.getElementById('restore-right');
    let isDragging = false;
    let dragRaf;

    if (divider && editorPanel && container) {
        const startDragging = () => {
            isDragging = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            container.classList.add('is-resizing');
        };

        divider.addEventListener('mousedown', startDragging);
        restoreLeft?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startDragging();
        });
        restoreRight?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startDragging();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            if (dragRaf) cancelAnimationFrame(dragRaf);

            dragRaf = requestAnimationFrame(() => {
                const containerRect = container.getBoundingClientRect();
                let newWidthPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;

                // Keep within bounds
                newWidthPercentage = Math.max(0, Math.min(100, newWidthPercentage));

                if (newWidthPercentage <= 5) {
                    // Snap to Preview Only if very close to left
                    if (document.body.classList.contains('view-preview')) return;
                    document.body.classList.add('view-preview');
                    document.body.classList.remove('view-editor');
                    restoreLeft.style.display = 'flex';
                    restoreRight.style.display = 'none';
                } else if (newWidthPercentage >= 95) {
                    // Snap to Editor Only if very close to right
                    if (document.body.classList.contains('view-editor')) return;
                    document.body.classList.add('view-editor');
                    document.body.classList.remove('view-preview');
                    restoreRight.style.display = 'flex';
                    restoreLeft.style.display = 'none';
                } else {
                    // Standard Split Mode
                    document.body.classList.remove('view-editor', 'view-preview');
                    restoreLeft.style.display = 'none';
                    restoreRight.style.display = 'none';
                    editorPanel.style.flex = `0 0 ${newWidthPercentage}%`;

                    // Update Toolbar Buttons state
                    document.querySelectorAll('.view-btn').forEach(b => {
                        b.classList.remove('active');
                        if (b.getAttribute('data-view') === 'split') b.classList.add('active');
                    });
                }
            });
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                container.classList.remove('is-resizing');

                // If we ended dragging while in a collapsed state, make sure handles are visible
                if (document.body.classList.contains('view-preview')) {
                    restoreLeft.style.display = 'flex';
                } else if (document.body.classList.contains('view-editor')) {
                    restoreRight.style.display = 'flex';
                }
            }
        });

        const restoreSplit = () => {
            document.body.classList.remove('view-editor', 'view-preview');
            editorPanel.style.flex = '0 0 50%';
            restoreLeft.style.display = 'none';
            restoreRight.style.display = 'none';
            if (window.lucide) lucide.createIcons();

            // Update view buttons UI
            document.querySelectorAll('.view-btn').forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('data-view') === 'split') b.classList.add('active');
            });
        };

        restoreLeft?.addEventListener('click', restoreSplit);
        restoreRight?.addEventListener('click', restoreSplit);
    }

    const applyTheme = (themeName) => {
        const isDark = themeName === 'dark';
        
        if (isDark) {
            document.body.classList.add('dark-mode');
            document.getElementById('theme-light').disabled = true;
            document.getElementById('theme-dark').disabled = false;
        } else {
            document.body.classList.remove('dark-mode');
            document.getElementById('theme-light').disabled = false;
            document.getElementById('theme-dark').disabled = true;
        }
        localStorage.setItem('theme', themeName);

        document.querySelectorAll('.theme-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-theme') === themeName) {
                tab.classList.add('active');
            }
        });
        
        if (window.lucide) lucide.createIcons();
    };

    document.querySelectorAll('.theme-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTheme = e.currentTarget.getAttribute('data-theme');
            applyTheme(targetTheme);
        });
    });

    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) ? 'dark' : 'light';
    
    document.querySelectorAll('.theme-tab').forEach(tab => {
        if (tab.getAttribute('data-theme') === initialTheme) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
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

    // ✨ SETTINGS LOGIC ✨
    const settingsNavItems = document.querySelectorAll('.settings-nav-item');
    const settingsContents = document.querySelectorAll('.settings-content');

    settingsNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.getAttribute('data-section');
            settingsNavItems.forEach(nav => nav.classList.remove('active'));
            settingsContents.forEach(content => content.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(`settings-section-${section}`).classList.add('active');
        });
    });

    const initSettingsToggles = () => {
        window.EditorState.loadUIVisibility();

        const uiToggles = document.querySelectorAll('.settings-modal-box input[data-component]');
        uiToggles.forEach(toggle => {
            const isVisible = window.EditorState.uiVisibility[toggle.id] !== false;
            toggle.checked = isVisible;
        });

        const currentStorage = document.getElementById('current-storage-pref');
        if (currentStorage) {
            currentStorage.textContent = window.StorageManager.useIDB ? "IndexedDB (High Capacity)" : "Local Storage (Standard)";
        }

        updateStatusBarChildrenState();
        window.EditorState.applyUIVisibility();
    };

    const updateStatusBarChildrenState = () => {
        const parentToggle = document.getElementById('toggle-bottom-toolbar');
        const children = ['toggle-bottom-words', 'toggle-bottom-chars', 'toggle-bottom-reading', 'toggle-bottom-cursor', 'toggle-bottom-theme', 'toggle-bottom-mode'];

        children.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                const card = checkbox.closest('.setting-card');
                if (parentToggle.checked) {
                    card.classList.remove('disabled');
                    checkbox.disabled = false;
                } else {
                    card.classList.add('disabled');
                    checkbox.disabled = true;
                }
            }
        });
    };

    document.getElementById('toggle-bottom-toolbar')?.addEventListener('change', updateStatusBarChildrenState);

    // Collapsible Groups Logic
    document.querySelectorAll('.settings-group-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('open');
        });
    });

    const saveSettingsChanges = () => {
        const uiToggles = document.querySelectorAll('.settings-modal-box input[data-component]');
        uiToggles.forEach(toggle => {
            window.EditorState.uiVisibility[toggle.id] = toggle.checked;
        });
        window.EditorState.saveUIVisibility();

        window.showToast("<i data-lucide='check-circle'></i> Settings Saved");
        window.closeSettingsModal();
    };

    document.getElementById('settings-modal-save-btn')?.addEventListener('click', saveSettingsChanges);

    // Initial load
    setTimeout(initSettingsToggles, 100);
});