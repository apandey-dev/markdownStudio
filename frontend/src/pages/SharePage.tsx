import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MarkdownService } from '../services/markdownService';

export default function SharePage() {
  const [html, setHtml] = useState<string>('');
  const location = useLocation();

  useEffect(() => {
    const processHash = async () => {
      const hash = location.hash.substring(1);
      if (!hash) {
        setHtml('<div class="error">No shared content found in URL.</div>');
        return;
      }

      try {
        const decoded = decodeURIComponent(atob(hash));
        const rendered = await MarkdownService.render(decoded);
        setHtml(rendered);
      } catch (err) {
        console.error(err);
        setHtml('<div class="error">Failed to parse shared content. The link might be broken or corrupted.</div>');
      }
    };

    processHash();
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-white dark:bg-[#0a0a0a] rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-8">
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold brand text-gray-900 dark:text-white">Markdown Studio</h1>
            <p className="text-sm text-gray-500">Shared Document Viewer</p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Export PDF
          </button>
        </div>
        <div
          className="markdown-body font-sans"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
