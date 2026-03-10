import { useNotesStore } from '../../store/useNotesStore';
import { useUIStore } from '../../store/useUIStore';
import { Plus, FileText } from 'lucide-react';

export default function Sidebar() {
  const { notes, currentNoteId, setCurrentNoteId } = useNotesStore();
  const { sidebarOpen } = useUIStore();

  if (!sidebarOpen) return null;

  return (
    <aside className="sidebar w-64 h-full border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/95 flex flex-col transition-all duration-300 z-40">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">My Notes</h2>
        <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded">
          <Plus className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {notes.map(note => (
          <div
            key={note.id}
            onClick={() => setCurrentNoteId(note.id)}
            className={`p-2 rounded-md cursor-pointer flex items-center gap-2 text-sm mb-1 ${currentNoteId === note.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <FileText className="w-4 h-4" />
            <span className="truncate flex-1">{note.title}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
