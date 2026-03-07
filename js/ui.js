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
window.closeBulkSyncModal = function () { document.getElementById('bulk-sync-modal')?.classList.remove('show'); };
window.closeMoveModal = function () { document.getElementById('move-modal')?.classList.remove('show'); };
window.closeRenameModal = function () { document.getElementById('rename-modal')?.classList.remove('show'); };

window.closeNotesModal = function () {
    document.getElementById('notes-modal')?.classList.remove('show');
    const dashboardBox = document.querySelector('.notes-dashboard-box');
    if (dashboardBox) {
        dashboardBox.classList.remove('show-preview-pane');
        dashboardBox.classList.add('folders-collapsed');
    }
};

document.addEventListener('DOMContentLoaded', () => {

    if (window.lucide) lucide.createIcons();

    // ✨ FOCUS MODE LOGIC ✨
    const btnFocusMode = document.getElementById('btn-focus-mode');
    const btnExitFocus = document.getElementById('btn-exit-focus');

    btnFocusMode?.addEventListener('click', () => {
        document.body.classList.add('focus-mode');
        if (window.showToast) window.showToast("<i data-lucide='focus'></i> Focus Mode");
    });

    btnExitFocus?.addEventListener('click', () => {
        document.body.classList.remove('focus-mode');
        if (window.showToast) window.showToast("<i data-lucide='minimize'></i> Focus Exited");
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

    document.getElementById('notes-modal-close')?.addEventListener('click', window.closeNotesModal);

    document.getElementById('btn-docs')?.addEventListener('click', () => {
        document.getElementById('docs-modal')?.classList.add('show');
    });
    document.getElementById('sidebar-btn-docs-mobile')?.addEventListener('click', () => {
        document.getElementById('mobile-sidebar-overlay')?.classList.remove('show');
        document.getElementById('docs-modal')?.classList.add('show');
    });
    document.getElementById('docs-modal-close')?.addEventListener('click', window.closeDocsModal);

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

    // ✨ FIXED ESC KEY LOGIC ✨
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (sidebarOverlay?.classList.contains('show')) { sidebarOverlay.classList.remove('show'); return; }
            
            // Close active dropdowns first
            const openDropdownList = document.querySelector('.dropdown-list[style*="display: block"]');
            if(openDropdownList) {
                openDropdownList.style.display = 'none';
                return;
            }
            const openDropdown = document.querySelector('.custom-dropdown.open');
            if (openDropdown) { openDropdown.classList.remove('open'); return; }

            const modals = [
                { id: 'conflict-modal', closeBtn: 'conflict-cancel' },
                { id: 'folder-prompt-modal', closeBtn: 'folder-prompt-cancel' },
                { id: 'prompt-modal', closeBtn: 'prompt-cancel' },
                { id: 'delete-modal', closeBtn: 'delete-cancel' },
                { id: 'move-modal', closeBtn: 'move-cancel' },
                { id: 'rename-modal', closeBtn: 'rename-cancel' },
                { id: 'pdf-modal', closeBtn: 'modal-cancel' },
                { id: 'setup-modal', closeBtn: 'btn-cancel-setup' },
                { id: 'pat-guide-modal', closeBtn: 'pat-guide-close' },
                { id: 'manager-modal', closeBtn: 'manager-modal-close' },
                { id: 'bulk-sync-modal', closeBtn: 'bulk-sync-cancel' },
                { id: 'docs-modal', closeBtn: 'docs-modal-close' },
                { id: 'notes-modal', closeBtn: 'notes-modal-close' }
            ];

            for (let modal of modals) {
                const el = document.getElementById(modal.id);
                if (el && el.classList.contains('show')) {
                    const btn = document.getElementById(modal.closeBtn);
                    if (btn) btn.click();
                    else el.classList.remove('show');
                    return; 
                }
            }
        }
    });

    const toggleFoldersBtn = document.getElementById('toggle-folders-btn');
    const dashboardBox = document.querySelector('.notes-dashboard-box');
    toggleFoldersBtn?.addEventListener('click', () => {
        dashboardBox.classList.toggle('folders-collapsed');
    });

    // ✨ ESCAPING CLIPPED CONTAINERS FOR FONTS ✨
    window.setupDropdown = function(dropdownId, textId, callback) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        const header = dropdown.querySelector('.dropdown-header');
        const items = dropdown.querySelectorAll('.dropdown-item');
        const textEl = document.getElementById(textId);
        const list = dropdown.querySelector('.dropdown-list');

        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);

        newHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            
            document.querySelectorAll('.custom-dropdown').forEach(d => {
                d.classList.remove('open');
                const lst = d.querySelector('.dropdown-list');
                if(lst && lst.style.position === 'fixed') lst.style.display = 'none';
            });

            if(!isOpen) {
                dropdown.classList.add('open');
                
                // Magic positioning to escape toolbar overflow
                if(dropdownId === 'font-dropdown') {
                    const rect = newHeader.getBoundingClientRect();
                    list.style.display = 'block';
                    list.style.position = 'fixed';
                    list.style.top = (rect.bottom + 8) + 'px';
                    list.style.left = rect.left + 'px';
                    list.style.width = Math.max(rect.width, 150) + 'px';
                    list.style.zIndex = '9999';
                }
            }
        });

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                items.forEach(i => i.classList.remove('active'));
                e.target.classList.add('active');
                if (textEl) {
                    textEl.textContent = e.target.textContent;
                    if(e.target.getAttribute('data-value')) {
                        textEl.setAttribute('data-selected', e.target.getAttribute('data-value'));
                    }
                }
                dropdown.classList.remove('open');
                if(list.style.position === 'fixed') list.style.display = 'none';
                if (callback) callback(e.target.getAttribute('data-value'));
            });
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown').forEach(d => {
            d.classList.remove('open');
            const lst = d.querySelector('.dropdown-list');
            if(lst && lst.style.position === 'fixed') lst.style.display = 'none';
        });
    });

    document.querySelector('.editor-toolbar')?.addEventListener('scroll', () => {
        document.querySelectorAll('.custom-dropdown').forEach(d => {
            d.classList.remove('open');
            const lst = d.querySelector('.dropdown-list');
            if(lst && lst.style.position === 'fixed') lst.style.display = 'none';
        });
    });

    // ✨ GLOBAL FONT SYNC (EDITOR & PREVIEW) ✨
    const savedFont = localStorage.getItem('md_studio_font') || 'Fredoka';
    document.documentElement.style.setProperty('--preview-font', `'${savedFont}', sans-serif`);
    document.documentElement.style.setProperty('--editor-font', `'${savedFont}', sans-serif`);

    const fontDropdownItems = document.querySelectorAll('#font-dropdown .dropdown-item');
    const fontSelectedText = document.getElementById('font-selected-text');
    if (fontDropdownItems.length > 0 && fontSelectedText) {
        fontDropdownItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-value') === savedFont) {
                item.classList.add('active');
                fontSelectedText.textContent = `${item.textContent}`;
            }
        });
    }

    window.setupDropdown('font-dropdown', 'font-selected-text', (val) => {
        document.documentElement.style.setProperty('--preview-font', `'${val}', sans-serif`);
        document.documentElement.style.setProperty('--editor-font', `'${val}', sans-serif`);
        localStorage.setItem('md_studio_font', val);
    });

    window.setupDropdown('size-dropdown', 'size-selected-text', (val) => {
        window.selectedPageSize = val;
    });

    const divider = document.getElementById('drag-divider');
    const editorPanel = document.getElementById('editor-panel-wrapper');
    const container = document.getElementById('split-workspace');
    let isDragging = false;

    if (divider && editorPanel && container) {
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
});