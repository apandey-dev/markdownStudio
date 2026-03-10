import { Moon, Sun, Settings, Share, FolderOpen, Menu } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';

export default function Navbar() {
  const { theme, setTheme, sidebarOpen, setSidebarOpen, setActiveModal } = useUIStore();

  return (
    <nav className="navbar h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 z-50">
      <div className="flex items-center gap-4">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
          <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <span className="font-bold text-lg text-gray-900 dark:text-white brand">Markdown Studio</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="action-pill-group flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-1">
          <button
            className={`p-2 rounded-full ${theme === 'light' ? 'bg-white shadow' : 'text-gray-400'}`}
            onClick={() => setTheme('light')}
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded-full ${theme === 'dark' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'}`}
            onClick={() => setTheme('dark')}
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>

        <button onClick={() => setActiveModal('notes')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="All Notes">
          <FolderOpen className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <button onClick={() => setActiveModal('share')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="Share">
          <Share className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <button onClick={() => setActiveModal('settings')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="Settings">
          <Settings className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </nav>
  );
}
