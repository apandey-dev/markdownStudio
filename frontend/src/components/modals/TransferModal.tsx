import { useUIStore } from '../../store/useUIStore';

export default function TransferModal() {
  const { activeModal, setActiveModal } = useUIStore();

  if (activeModal !== 'transfer') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-black">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Transfer Notes</h2>
          <button onClick={() => setActiveModal(null)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <button className="w-full py-3 rounded-lg border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]">
            Export All (.zip)
          </button>
          <button className="w-full py-3 rounded-lg border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]">
            Import (.zip)
          </button>
        </div>
      </div>
    </div>
  );
}
