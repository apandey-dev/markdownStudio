/* js/ui/editor.js */
import NoteCRUD from '../notes/noteCRUD.js';
import FolderManager from '../notes/folderManager.js';

const EditorUI = {
    editor: null,
    preview: null,
    previewPanel: null,

    init() {
        this.editor = document.getElementById('markdown-input');
        this.preview = document.getElementById('preview-output');
        this.previewPanel = document.getElementById('preview-panel');

        if (!this.editor) return;

        this.setupEventListeners();
        this.setupToolbar();
        this.setupScrollSync();
    },

    setupEventListeners() {
        this.editor.addEventListener('input', () => {
            this.dynamicDebounce(this.editor.value);
        });

        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.editor.selectionStart;
                const end = this.editor.selectionEnd;
                this.editor.value = this.editor.value.substring(0, start) + "  " + this.editor.value.substring(end);
                this.editor.selectionStart = this.editor.selectionEnd = start + 2;
                this.editor.dispatchEvent(new Event('input'));
            }
        });
    },

    setupToolbar() {
        document.querySelectorAll('.tool-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                this.handleToolbarAction(action);
            });
        });
    },

    handleToolbarAction(action) {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        let selection = this.editor.value.substring(start, end);
        const fullText = this.editor.value;

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

        this.editor.focus();

        const textToWrap = selection || defaultText;
        this.editor.value = fullText.substring(0, start) + prefix + textToWrap + suffix + fullText.substring(end);

        if (!selection) {
            this.editor.selectionStart = start + prefix.length;
            this.editor.selectionEnd = start + prefix.length + defaultText.length;
        } else {
            this.editor.selectionStart = start + prefix.length;
            this.editor.selectionEnd = start + prefix.length + selection.length;
        }
        this.editor.dispatchEvent(new Event('input'));
    },

    setupScrollSync() {
        let isScrollSync = true;
        let isSyncingLeft = false;
        let isSyncingRight = false;
        let uiScrollTimeout;

        this.editor.addEventListener('scroll', () => {
            if (!isScrollSync || isSyncingLeft) return;
            const editorScrollable = this.editor.scrollHeight - this.editor.clientHeight;
            const previewScrollable = this.previewPanel.scrollHeight - this.previewPanel.clientHeight;
            if (editorScrollable > 0 && previewScrollable > 0) {
                isSyncingRight = true;
                const percentage = this.editor.scrollTop / editorScrollable;
                this.previewPanel.scrollTop = percentage * previewScrollable;
                clearTimeout(uiScrollTimeout);
                uiScrollTimeout = setTimeout(() => { isSyncingRight = false; }, 50);
            }
        });

        this.previewPanel.addEventListener('scroll', () => {
            if (!isScrollSync || isSyncingRight) return;
            const editorScrollable = this.editor.scrollHeight - this.editor.clientHeight;
            const previewScrollable = this.previewPanel.scrollHeight - this.previewPanel.clientHeight;
            if (editorScrollable > 0 && previewScrollable > 0) {
                isSyncingLeft = true;
                const percentage = this.previewPanel.scrollTop / previewScrollable;
                this.editor.scrollTop = percentage * editorScrollable;
                clearTimeout(uiScrollTimeout);
                uiScrollTimeout = setTimeout(() => { isSyncingLeft = false; }, 50);
            }
        });
    },

    debounceTimeout: null,
    dynamicDebounce(rawText) {
        clearTimeout(this.debounceTimeout);
        const waitTime = rawText.length > 50000 ? 800 : 300;

        this.debounceTimeout = setTimeout(async () => {
            const activeNote = NoteCRUD.getActiveNote();
            if (activeNote) {
                activeNote.content = rawText;
                activeNote.lastUpdated = Date.now();
                await NoteCRUD.saveLocalState(window.appMode);
            }
            this.renderMarkdownCore(rawText);
        }, waitTime);
    },

    updateLiveStats(text) {
        if (typeof text !== 'string') return;
        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;

        document.getElementById('stat-words').textContent = `${words} Words`;
        document.getElementById('stat-chars').textContent = `${chars} Characters`;
        document.getElementById('stat-reading-time').textContent = `${Math.max(1, Math.ceil(words / 200))} min read`;
    },

    customMarkdownParser(rawText) {
        let processedText = rawText.replace(/\r\n/g, '\n');

        processedText = processedText.replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g, (match, alt, url, options) => {
            let style = 'max-width: 100%; border-radius: 8px; transition: all 0.3s ease; ';
            let isCenter = false;
            if (options) {
                const parts = options.split(',').map(p => p.trim().toLowerCase());
                parts.forEach(part => {
                    if (part === 'center') isCenter = true;
                    else if (part === 'left') style += 'float: left; margin-right: 16px; margin-bottom: 16px; ';
                    else if (part === 'right') style += 'float: right; margin-left: 16px; margin-bottom: 16px; ';
                    else if (part.match(/^(\d+(?:px|rem|em|%)?)(?:x(\d+(?:px|rem|em|%)?|auto))?$/)) {
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
            return isCenter ? `<div style="text-align: center; width: 100%; clear: both; margin: 16px 0;">${imgTag}</div>` : imgTag;
        });

        processedText = processedText.replace(/^={3,}\s*$/gm, '\n\n<hr class="custom-divider" />\n\n');
        processedText = processedText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, (match, text, color) => `<span style="color: ${color};">${text}</span>`);
        processedText = processedText.replace(/\[\[(.*?)\]\]/g, (match, noteTitle) => `<a href="#" class="internal-note-link" data-note="${noteTitle.trim()}"><i data-lucide="file-symlink"></i>${noteTitle}</a>`);

        const htmlContent = marked.parse(processedText, { breaks: true, gfm: true });
        return DOMPurify.sanitize(htmlContent, {
            ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'g', 'defs', 'clipPath', 'use'],
            ADD_ATTR: ['style', 'class', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'width', 'height', 'x', 'y', 'xmlns', 'transform', 'fill-rule', 'clip-rule', 'data-note']
        });
    },

    async renderMarkdownCore(rawText) {
        this.updateLiveStats(rawText);
        await new Promise(res => setTimeout(res, 0));
        this.preview.innerHTML = this.customMarkdownParser(rawText);

        if (typeof renderMathInElement === 'function') {
            renderMathInElement(this.preview, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
        }

        if (typeof hljs !== 'undefined') {
            this.preview.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
        }

        if (window.lucide) lucide.createIcons();
        this.attachInternalLinkListeners();
    },

    attachInternalLinkListeners() {
        this.preview.querySelectorAll('.internal-note-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTitle = link.getAttribute('data-note');
                // Implement note navigation
            });
        });
    }
};

export default EditorUI;
