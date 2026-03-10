import DOMPurify from 'dompurify';
import { marked } from 'marked';
import katex from 'katex';
import hljs from 'highlight.js';

export const MarkdownService = {
  render: async (content: string): Promise<string> => {
    // Math preprocessing (KaTeX inline and block)
    content = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) => {
      try {
        return katex.renderToString(formula, { displayMode: true, throwOnError: false });
      } catch (err) {
        return `<span style="color:red">Math Error: ${err}</span>`;
      }
    });

    content = content.replace(/\$([^$\n]+?)\$/g, (_, formula) => {
      try {
        return katex.renderToString(formula, { displayMode: false, throwOnError: false });
      } catch (err) {
        return `<span style="color:red">Math Error: ${err}</span>`;
      }
    });

    // Configure marked for Highlighting
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    // Marked highlight setup logic for TS/marked 10.x+ typically uses marked-highlight,
    // but here we just manually render inside marked or disable highlight config type issues.
    // For simplicity with vanilla behavior:
    marked.use({
      renderer: {
        code(token: any): string {
          const code = token.text;
          const language = token.lang;
          const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext';
          const highlightedCode = hljs.highlight(validLanguage, code).value;
          return `<pre><code class="hljs ${validLanguage}">${highlightedCode}</code></pre>`;
        }
      }
    });

    const html = await marked.parse(content);
    return DOMPurify.sanitize(html);
  }
};
