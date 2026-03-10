import { useEffect, useState, useRef } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { MarkdownService } from '../../services/markdownService';

export default function PreviewPanel() {
  const { content } = useEditorStore();
  const [html, setHtml] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    MarkdownService.render(content).then(setHtml);
  }, [content]);

  return (
    <div className="h-full bg-white dark:bg-black w-full flex flex-col">
      <div className="preview-toolbar h-10 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 bg-gray-50 dark:bg-[#0a0a0a]">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Live Preview</span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-8 markdown-body text-gray-900 dark:text-gray-100 bg-white dark:bg-black font-sans"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
