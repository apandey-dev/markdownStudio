import { useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import StatusBar from '../components/layout/StatusBar';
import Workspace from '../components/editor/Workspace';
import Sidebar from '../components/layout/Sidebar';
import SettingsModal from '../components/modals/SettingsModal';
import NotesModal from '../components/modals/NotesModal';
import TransferModal from '../components/modals/TransferModal';
import ShareModal from '../components/modals/ShareModal';
import { useUIStore } from '../store/useUIStore';

export default function EditorPage() {
  const { theme, sidebarOpen } = useUIStore();

  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
  }, [theme]);

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col relative transition-all duration-300">
          <Workspace />
        </main>
      </div>
      <StatusBar />

      {/* Modals */}
      <NotesModal />
      <SettingsModal />
      <TransferModal />
      <ShareModal />
    </div>
  );
}
