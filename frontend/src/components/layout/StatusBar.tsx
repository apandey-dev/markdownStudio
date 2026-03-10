import { useEditorStore } from '../../store/useEditorStore';

export default function StatusBar() {
  const { content, cursorPosition } = useEditorStore();

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const lines = content.split('\n').length;

  return (
    <footer className="status-bar h-8 border-t border-gray-200 dark:border-[#262626] bg-[#ffffff] dark:bg-[#0a0a0a] flex items-center justify-between px-4 text-xs text-gray-500 z-50">
      <div className="flex gap-4">
        <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
        <span>{lines} Lines</span>
        <span>{words} Words</span>
        <span>{chars} Chars</span>
      </div>
      <div className="flex gap-4">
        <span>Auto Save: <span className="text-green-500 font-medium">ON</span></span>
        <span>Markdown Studio v2.0</span>
      </div>
    </footer>
  );
}
