import { useUIStore } from '../../store/useUIStore';

export default function SettingsModal() {
  const { activeModal, setActiveModal, theme, setTheme } = useUIStore();

  if (activeModal !== 'settings') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-black">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={() => setActiveModal(null)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 py-3 px-4 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${theme === 'light' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-[#262626]'}`}
              >
                Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 py-3 px-4 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'border-blue-500 bg-blue-900/20 text-blue-400 dark:bg-[#0a0a0a]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-[#262626]'}`}
              >
                Dark (Monochrome)
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-black">
          <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-200">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
