/* js/editor-core.js */
/* ==========================================================================
   EDITOR CORE CONTROLLER
   Handles core editor operations, markdown parsing, debouncing and logic.
   ========================================================================== */

window.updatePillUI = function () {
    const isGithub = window.appMode === 'github';

    document.querySelectorAll('[data-target]').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll(`[data-target="${window.appMode}"]`).forEach(tab => tab.classList.add('active'));

    const indicator = document.getElementById('active-mode-indicator');
    if (indicator) {
        if (isGithub) {
            if (window.isSyncing) {
                indicator.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> Syncing...`;
                indicator.style.color = '#3b82f6';
            } else if (window.pendingSync) {
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
};

window.finishAppLoad = function () {
    const note = window.getActiveNote();
    if (!note) return;

    window.highlightedNoteId = window.activeNoteId;
    window.activeFolder = note.folder || 'All Notes';
    if (!window.folders.includes(window.activeFolder)) window.activeFolder = 'All Notes';

    if (window.editor) {
        window.editor.disabled = false;
        window.editor.placeholder = "Start typing your Markdown here...";
        window.editor.value = note.content || "";
        window.renderMarkdownCore(window.editor.value);
    }

    if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
    if (typeof window.renderNotesList === 'function') window.renderNotesList();
    if (typeof window.renderManagementModal === 'function' && document.getElementById('management-modal')?.classList.contains('show')) window.renderManagementModal();
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
};

window.initGitHubMode = async function (token) {
    window.loadFolders();
    const localCachedNotes = await window.AppStorageManager.getAllNotes('github') || [];

    if (localCachedNotes.length > 0) {
        window.notes = localCachedNotes;
        window.extractFoldersFromNotes();
        window.activeNoteId = localStorage.getItem('md_active_github') || window.notes[0]?.id;
        window.finishAppLoad();
    }

    const success = await window.GitHubBackend.init(token);
    if (success) {
        const cloudNotes = await window.GitHubBackend.getAllNotes();

        if (localCachedNotes.length === 0) {
            if (cloudNotes.length > 0) {
                window.notes = cloudNotes;
            } else {
                const result = await window.GitHubBackend.saveNote('new', 'Welcome.md', "Welcome", window.defaultWelcomeNote);
                window.notes = [{ id: result?.sha || 'temp', path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: window.defaultWelcomeNote, lastUpdated: Date.now() }];
            }
            window.activeNoteId = window.notes[0]?.id;
        } else {
            let mergedMap = new Map();
            localCachedNotes.forEach(n => mergedMap.set(n.path, n));

            let addedOrUpdated = false;
            cloudNotes.forEach(cn => {
                const ln = mergedMap.get(cn.path);
                if (!ln || cn.id !== ln.id) {
                    if (ln) cn.lastUpdated = Date.now();
                    mergedMap.set(cn.path, cn);
                    addedOrUpdated = true;
                }
            });

            window.notes = Array.from(mergedMap.values()).sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

            if (addedOrUpdated) {
                if (!window.notes.find(n => n.id === window.activeNoteId)) window.activeNoteId = window.notes[0]?.id;
                if (document.getElementById('notes-modal')?.classList.contains('show')) {
                    if (window.renderFoldersList) window.renderFoldersList();
                    if (window.renderNotesList) window.renderNotesList();
                }
            }
        }

        window.extractFoldersFromNotes();
        await window.saveLocalState();
        window.finishAppLoad();
        window.updatePillUI();

    } else {
        window.showToast("Working locally.");
        window.finishAppLoad();
    }
};

window.loadLocalMode = async function () {
    window.loadFolders();
    const cachedNotes = await window.AppStorageManager.getAllNotes('local');
    if (cachedNotes && cachedNotes.length > 0) {
        window.notes = cachedNotes;
        window.extractFoldersFromNotes();
        window.activeNoteId = localStorage.getItem('md_active_local') || window.notes[0]?.id;
    } else {
        const id = Date.now().toString();
        window.notes = [{ id: id, path: 'Welcome.md', folder: 'All Notes', title: "Welcome", content: window.defaultWelcomeNote, lastUpdated: Date.now() }];
        window.folders = ['All Notes'];
        window.activeNoteId = id;
        await window.saveLocalState();
        window.saveFolders();
    }
    window.finishAppLoad();
    window.updatePillUI();
};

window.switchToMode = async function (targetMode) {
    if (window.appMode === targetMode && window.editor && window.editor.disabled === false) return;

    if (window.notes.length > 0) await window.saveLocalState();

    if (targetMode === 'github') {
        const token = localStorage.getItem('md_github_token');
        if (!token) {
            document.getElementById('setup-modal').classList.add('show');
            return;
        }

        window.appMode = 'github';
        localStorage.setItem('md_app_mode', 'github');
        document.querySelectorAll(`[data-target="github"]`).forEach(tab => tab.innerHTML = '<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> <span class="tab-text">Cloud</span>');
        if (window.lucide) lucide.createIcons();

        if (window.editor) window.editor.disabled = true;
        document.body.classList.add('is-loading');
        await window.initGitHubMode(token);
    } else {
        window.appMode = 'local';
        localStorage.setItem('md_app_mode', 'local');
        if (window.editor) window.editor.disabled = true;
        document.body.classList.add('is-loading');
        await window.loadLocalMode();
    }
};

window.customMarkdownParser = function (rawText) {
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
        const exists = window.notes.some(n => n.title.toLowerCase() === cleanTitle.toLowerCase());
        const linkClass = exists ? 'valid-link' : 'dead-link';
        const icon = exists ? 'file-symlink' : 'file-plus';
        return `<a href="#" class="internal-note-link ${linkClass}" data-note="${cleanTitle}"><i data-lucide="${icon}"></i>${cleanTitle}</a>`;
    });

    const htmlContent = marked.parse(processedText, { breaks: true, gfm: true });

    return DOMPurify.sanitize(htmlContent, {
        ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'g', 'defs', 'clipPath', 'use'],
        ADD_ATTR: ['style', 'class', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'width', 'height', 'x', 'y', 'xmlns', 'transform', 'fill-rule', 'clip-rule', 'data-note']
    });
};

window.injectCopyButtons = function (container) {
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
};

window.attachInternalLinkListeners = function (container) {
    container.querySelectorAll('.internal-note-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTitle = link.getAttribute('data-note');
            const targetNote = window.notes.find(n => n.title.toLowerCase() === targetTitle.toLowerCase());

            if (targetNote) {
                window.activeNoteId = targetNote.id;
                window.highlightedNoteId = targetNote.id;
                window.activeFolder = targetNote.folder || 'All Notes';
                if (window.editor) window.editor.value = targetNote.content;
                window.saveLocalState();

                window.renderMarkdownCore(targetNote.content);

                if (typeof window.renderFoldersList === 'function') window.renderFoldersList();
                if (typeof window.renderNotesList === 'function') window.renderNotesList();

                if (document.getElementById('notes-modal')?.classList.contains('show')) {
                    if (window.renderDashboardPreview) window.renderDashboardPreview();
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
};

window.renderDashboardPreview = async function () {
    const previewEl = document.getElementById('dashboard-preview-output');
    const note = window.notes.find(n => n.id === window.highlightedNoteId);

    if (!note || !previewEl) {
        if (previewEl) previewEl.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">No note selected</div>`;
        return;
    }

    await new Promise(res => setTimeout(res, 0));

    previewEl.innerHTML = window.customMarkdownParser(note.content);
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(previewEl, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
    }

    window.injectCopyButtons(previewEl);
    window.attachInternalLinkListeners(previewEl);

    if (typeof hljs !== 'undefined') {
        previewEl.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    }
    if (window.lucide) lucide.createIcons();
};

window.updateLiveStats = function (text) {
    if (typeof text !== 'string') return;
    const chars = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;

    const wEl = document.getElementById('stat-words');
    const cEl = document.getElementById('stat-chars');
    const rEl = document.getElementById('stat-reading-time');

    if (wEl) wEl.textContent = `${words} Words`;
    if (cEl) cEl.textContent = `${chars} Characters`;
    if (rEl) rEl.textContent = `${Math.max(1, Math.ceil(words / 200))} min read`;
};

window.renderMarkdownCore = async function (rawText) {
    window.updateLiveStats(rawText);

    await new Promise(resolve => setTimeout(resolve, 0));

    if (window.preview) window.preview.innerHTML = window.customMarkdownParser(rawText);

    await new Promise(resolve => setTimeout(resolve, 0));
    if (typeof renderMathInElement === 'function' && window.preview) {
        renderMathInElement(window.preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
    }

    if (window.preview) {
        window.injectCopyButtons(window.preview);
        window.attachInternalLinkListeners(window.preview);

        if (typeof hljs !== 'undefined') {
            window.preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        }
    }
    if (window.lucide) lucide.createIcons();

    if (window.highlightedNoteId === window.activeNoteId && document.getElementById('notes-modal')?.classList.contains('show')) {
        window.renderDashboardPreview();
    }
};

window.getDynamicDebounceTime = function (textLength) {
    if (textLength > 200000) return 1500;
    if (textLength > 50000) return 800;
    return 300;
};

let debounceTimeout;
window.dynamicDebounce = function (rawText) {
    clearTimeout(debounceTimeout);
    const waitTime = window.getDynamicDebounceTime(rawText.length);

    debounceTimeout = setTimeout(async () => {
        const activeNote = window.getActiveNote();
        if (activeNote) {
            activeNote.content = rawText;
            activeNote.lastUpdated = Date.now();
            await window.saveLocalState();
        }
        window.renderMarkdownCore(rawText);
    }, waitTime);
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        window.editor = document.getElementById('markdown-input');
        window.previewPanel = document.getElementById('preview-panel');
        window.preview = document.getElementById('preview-output');
        window.shareBtn = document.getElementById('btn-share');
        window.btnConfirmPdf = document.getElementById('modal-confirm');
        window.inputFilename = document.getElementById('pdf-filename');

        if (window.editor) window.editor.disabled = true;
        
        // Critical Fix: Initializing properly renamed Manager
        await window.AppStorageManager.init();

        window.editor?.addEventListener('input', () => {
            window.dynamicDebounce(window.editor.value);
        });

        window.editor?.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 2;
                window.editor.dispatchEvent(new Event('input'));
            }
        });

        let isScrollSync = true;
        let isSyncingLeft = false;
        let isSyncingRight = false;
        let uiScrollTimeout;

        const btnScrollSync = document.getElementById('btn-scroll-sync');
        if (btnScrollSync) {
            btnScrollSync.addEventListener('click', () => {
                isScrollSync = !isScrollSync;
                btnScrollSync.classList.toggle('active', isScrollSync);
                btnScrollSync.style.opacity = isScrollSync ? '1' : '0.4';
            });
        }

        window.editor?.addEventListener('scroll', () => {
            if (!isScrollSync || isSyncingLeft) return;
            const editorScrollable = window.editor.scrollHeight - window.editor.clientHeight;
            const previewScrollable = window.previewPanel.scrollHeight - window.previewPanel.clientHeight;
            if (editorScrollable > 0 && previewScrollable > 0) {
                isSyncingRight = true;
                const percentage = window.editor.scrollTop / editorScrollable;
                window.previewPanel.scrollTop = percentage * previewScrollable;
                clearTimeout(uiScrollTimeout);
                uiScrollTimeout = setTimeout(() => { isSyncingRight = false; }, 50);
            }
        });

        window.previewPanel?.addEventListener('scroll', () => {
            if (!isScrollSync || isSyncingRight) return;
            const editorScrollable = window.editor.scrollHeight - window.editor.clientHeight;
            const previewScrollable = window.previewPanel.scrollHeight - window.previewPanel.clientHeight;
            if (editorScrollable > 0 && previewScrollable > 0) {
                isSyncingLeft = true;
                const percentage = window.previewPanel.scrollTop / previewScrollable;
                window.editor.scrollTop = percentage * editorScrollable;
                clearTimeout(uiScrollTimeout);
                uiScrollTimeout = setTimeout(() => { isSyncingLeft = false; }, 50);
            }
        });

        window.addEventListener('beforeunload', () => {
            if (window.getActiveNote() && window.editor && window.editor.value) {
                window.getActiveNote().content = window.editor.value;
                window.getActiveNote().lastUpdated = Date.now();
                const key = window.appMode === 'local' ? 'md_notes_local' : 'md_notes_github';
                window.AppStorageManager.safeSetLocal(key, JSON.stringify(window.notes));
                window.AppStorageManager.safeSetLocal(`md_active_${window.appMode}`, window.activeNoteId);
            }
        });

        window.addEventListener('online', () => {
            if (window.appMode === 'github') {
                window.AppOfflineQueue.process();
            }
        });

        // Initialize Modes
        const savedMode = localStorage.getItem('md_app_mode') || 'local';
        if (savedMode === 'github') {
            const token = localStorage.getItem('md_github_token');
            if (token) {
                window.appMode = 'github';
                await window.initGitHubMode(token);
            } else {
                await window.loadLocalMode();
            }
        } else {
            await window.loadLocalMode();
        }

    }, 50);
});