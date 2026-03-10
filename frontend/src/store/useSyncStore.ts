import { create } from 'zustand';

export interface SyncState {
  isSyncing: boolean;
  lastSyncCommit: string | null;
  mode: 'local' | 'github';
  useIDB: boolean;
  githubConfig: {
    token: string;
    repo: string;
    branch: string;
  } | null;

  setSyncState: (isSyncing: boolean) => void;
  setLastSyncCommit: (commit: string | null) => void;
  setMode: (mode: 'local' | 'github') => void;
  setUseIDB: (useIDB: boolean) => void;
  setGithubConfig: (config: SyncState['githubConfig']) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  lastSyncCommit: null,
  mode: (localStorage.getItem('md_mode') as 'local' | 'github') || 'local',
  useIDB: localStorage.getItem('md_storage_preference') === 'indexedDB',
  githubConfig: (() => {
    const p = localStorage.getItem('gh_pat');
    const r = localStorage.getItem('gh_repo');
    const b = localStorage.getItem('gh_branch');
    if (p && r && b) return { token: p, repo: r, branch: b };
    return null;
  })(),

  setSyncState: (isSyncing) => set({ isSyncing }),
  setLastSyncCommit: (lastSyncCommit) => set({ lastSyncCommit }),
  setMode: (mode) => {
    localStorage.setItem('md_mode', mode);
    set({ mode });
  },
  setUseIDB: (useIDB) => {
    localStorage.setItem('md_storage_preference', useIDB ? 'indexedDB' : 'localstorage');
    set({ useIDB });
  },
  setGithubConfig: (githubConfig) => {
    if (githubConfig) {
      localStorage.setItem('gh_pat', githubConfig.token);
      localStorage.setItem('gh_repo', githubConfig.repo);
      localStorage.setItem('gh_branch', githubConfig.branch);
    } else {
      localStorage.removeItem('gh_pat');
      localStorage.removeItem('gh_repo');
      localStorage.removeItem('gh_branch');
    }
    set({ githubConfig });
  }
}));
