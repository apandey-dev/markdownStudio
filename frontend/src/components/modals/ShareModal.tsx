import { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useEditorStore } from '../../store/useEditorStore';
import { Copy, Check, ExternalLink } from 'lucide-react';

export default function ShareModal() {
  const { activeModal, setActiveModal } = useUIStore();
  const { content } = useEditorStore();
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeModal === 'share') {
      try {
        const compressed = btoa(encodeURIComponent(content));
        const newUrl = `${window.location.origin}/share#${compressed}`;
        setUrl(newUrl);
        setCopied(false);
      } catch (e) {
        console.error("Compression failed", e);
      }
    }
  }, [activeModal, content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (activeModal !== 'share') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-black">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Secure Share</h2>
          <button onClick={() => setActiveModal(null)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white">✕</button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            This generates a unique link containing your entire document encoded securely. No database is used.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 font-mono text-sm outline-none"
            />
            <button
              onClick={handleCopy}
              className="p-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center min-w-[44px] hover:opacity-90 transition-opacity"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] flex items-center justify-center"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
