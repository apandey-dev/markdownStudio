document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('markdown-input');
    const preview = document.getElementById('preview-output');
    const shareBtn = document.getElementById('btn-share');
    const btnConfirm = document.getElementById('modal-confirm');
    const inputFilename = document.getElementById('pdf-filename');

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
        localStorage.setItem('md_studio_content', rawText); // Auto-save

        // 🎨 COLOR SHORTCUT MAGIC (Now supports spaces everywhere!)
        // Matches: [text]{color} OR [text] {color} OR [text] { color }
        const colorProcessedText = rawText.replace(/\[([^\]]+)\]\s*\{\s*([a-zA-Z0-9#]+)\s*\}/g, '<span style="color: $2;">$1</span>');

        // Parse to HTML
        const htmlContent = marked.parse(colorProcessedText);

        // Sanitize but explicitly allow 'style' attribute so colors work
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

    // --- App Initialization & URL Share Hash Loader ---
    if (window.location.hash && window.location.hash.length > 1) {
        try {
            const encodedData = window.location.hash.substring(1);
            const decodedText = decodeURIComponent(atob(encodedData));
            editor.value = decodedText;
            window.showToast("Shared document loaded! 🎉");
            history.replaceState(null, null, ' ');
        } catch (e) {
            console.error("Invalid share link", e);
            editor.value = "# Link Broken or Invalid \n\nPlease check the URL again.";
        }
    } else {
        const savedContent = localStorage.getItem('md_studio_content');
        if (savedContent) {
            editor.value = savedContent;
        } else {
            editor.value = "## Welcome To Markdown Studio \n\n ## [ Sample Heading ] {red}\n\nYou Can Now Use The Colorred heading too! 🎉";
        }
    }
    renderMarkdown();

    // --- PDF Export Logic (Strictly Margin 0, Padding 5px) ---
    inputFilename.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnConfirm.click();
    });

    btnConfirm.addEventListener('click', () => {
        let fileName = inputFilename.value.trim() || "Document";
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
            if (typeof window.showToast === "function") window.showToast("Export Successful! 🎉");
        }, 300);
    });

    // --- Share (ZERO-BACKEND URL MAGIC) ---
    shareBtn.addEventListener('click', async () => {
        const textToShare = editor.value;
        const encodedData = btoa(encodeURIComponent(textToShare));
        const shareableUrl = window.location.origin + window.location.pathname + "#" + encodedData;

        if (navigator.share) {
            try {
                await navigator.share({ title: 'Markdown Studio Document', url: shareableUrl });
            } catch (err) { console.log(err); }
        } else {
            navigator.clipboard.writeText(shareableUrl).then(() => {
                if (typeof window.showToast === "function") window.showToast("Shareable Link Copied! 🔗");
            });
        }
    });
});