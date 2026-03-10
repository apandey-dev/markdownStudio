import { create } from 'zustand';

export interface Note {
  id: string;
  title: string;
  content: string;
  lastUpdated: number;
  folderId?: string | null;
  _mode?: 'local' | 'github';
}

export interface Folder {
  id: string;
  name: string;
  order: number;
  isOpen: boolean;
}

interface NotesState {
  notes: Note[];
  folders: Folder[];
  currentNoteId: string | null;
  setNotes: (notes: Note[]) => void;
  setFolders: (folders: Folder[]) => void;
  setCurrentNoteId: (id: string | null) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addFolder: (folder: Folder) => void;
  toggleFolder: (id: string) => void;
  deleteFolder: (id: string) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  folders: [],
  currentNoteId: null,
  setNotes: (notes) => set({ notes }),
  setFolders: (folders) => set({ folders }),
  setCurrentNoteId: (id) => set({ currentNoteId: id }),
  addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
  updateNote: (id, updates) => set((state) => ({
    notes: state.notes.map(n => n.id === id ? { ...n, ...updates } : n)
  })),
  deleteNote: (id) => set((state) => ({
    notes: state.notes.filter(n => n.id !== id),
    currentNoteId: state.currentNoteId === id ? null : state.currentNoteId
  })),
  addFolder: (folder) => set((state) => ({ folders: [...state.folders, folder] })),
  toggleFolder: (id) => set((state) => ({
    folders: state.folders.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f)
  })),
  deleteFolder: (id) => set((state) => ({
    folders: state.folders.filter(f => f.id !== id),
    notes: state.notes.map(n => n.folderId === id ? { ...n, folderId: null } : n)
  })),
}));
