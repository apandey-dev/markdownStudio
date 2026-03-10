import { create } from 'zustand';

export interface UIState {
  theme: 'light' | 'dark';
  focusMode: boolean;
  sidebarOpen: boolean;
  splitPaneWidth: number; // Percentage
  activeModal: 'settings' | 'notes' | 'transfer' | 'share' | 'github' | 'pdf' | null;
  visibilitySettings: Record<string, boolean>; // Replicating the granular toggles

  setTheme: (theme: 'light' | 'dark') => void;
  toggleFocusMode: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSplitPaneWidth: (width: number) => void;
  setActiveModal: (modal: UIState['activeModal']) => void;
  setVisibilitySetting: (key: string, value: boolean) => void;
  initVisibilitySettings: (settings: Record<string, boolean>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') ||
         (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  focusMode: false,
  sidebarOpen: window.innerWidth > 768,
  splitPaneWidth: 50,
  activeModal: null,
  visibilitySettings: {},

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.body.classList.toggle('dark-mode', theme === 'dark');
    set({ theme });
  },
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  setSplitPaneWidth: (width) => set({ splitPaneWidth: Math.max(0, Math.min(100, width)) }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setVisibilitySetting: (key, value) => set((state) => {
    const newSettings = { ...state.visibilitySettings, [key]: value };
    localStorage.setItem('md_visibility_settings', JSON.stringify(newSettings));
    return { visibilitySettings: newSettings };
  }),
  initVisibilitySettings: (settings) => set({ visibilitySettings: settings })
}));
