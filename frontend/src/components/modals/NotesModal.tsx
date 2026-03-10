import { useUIStore } from '../../store/useUIStore';

export default function NotesModal() {
  const { activeModal, setActiveModal } = useUIStore();

  if (activeModal !== 'notes') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-black">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">All Notes Dashboard</h2>
          <button onClick={() => setActiveModal(null)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-[#050505]">
          <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
            Notes will appear here...
          </div>
        </div>
      </div>
    </div>
  );
}
