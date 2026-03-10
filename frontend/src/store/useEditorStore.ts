import { create } from 'zustand';

interface EditorState {
  content: string;
  cursorPosition: { line: number; col: number };
  selection: { start: number; end: number };
  setContent: (content: string) => void;
  setCursorPosition: (line: number, col: number) => void;
  setSelection: (start: number, end: number) => void;
  insertTextAtCursor: (text: string, newCursorOffset?: number) => void;
  wrapSelection: (prefix: string, suffix: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  content: '',
  cursorPosition: { line: 1, col: 1 },
  selection: { start: 0, end: 0 },
  setContent: (content) => set({ content }),
  setCursorPosition: (line, col) => set({ cursorPosition: { line, col } }),
  setSelection: (start, end) => set({ selection: { start, end } }),
  insertTextAtCursor: (text, newCursorOffset = text.length) => {
    const { content, selection } = get();
    const newContent = content.substring(0, selection.start) + text + content.substring(selection.end);
    const newPos = selection.start + newCursorOffset;
    set({
      content: newContent,
      selection: { start: newPos, end: newPos }
    });
  },
  wrapSelection: (prefix, suffix) => {
    const { content, selection } = get();
    const selectedText = content.substring(selection.start, selection.end);
    const textToInsert = prefix + selectedText + suffix;
    const newContent = content.substring(0, selection.start) + textToInsert + content.substring(selection.end);
    const newPos = selection.start + prefix.length + selectedText.length;

    set({
      content: newContent,
      selection: { start: newPos, end: newPos }
    });
  }
}));
