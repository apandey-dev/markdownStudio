import { useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { Bold, Italic, List, Link, Heading1, Code, Quote, ListOrdered, CheckSquare, Image, Table, Minus } from 'lucide-react';

export default function EditorPanel() {
  const { content, setContent, setCursorPosition, setSelection, wrapSelection, insertTextAtCursor } = useEditorStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    updateCursor(e.target);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    updateCursor(e.currentTarget);
  };

  const updateCursor = (el: HTMLTextAreaElement) => {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setSelection(start, end);

    const lines = el.value.substring(0, start).split('\n');
    setCursorPosition(lines.length, lines[lines.length - 1].length + 1);
  };

  // Keep textarea selection synced with store when programmatic edits happen
  useEffect(() => {
    if (textareaRef.current) {
      const state = useEditorStore.getState();
      if (textareaRef.current.value !== state.content) {
        textareaRef.current.value = state.content;
      }
      textareaRef.current.setSelectionRange(state.selection.start, state.selection.end);
    }
  }, [content]);

  // Handle Tab key logic
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertTextAtCursor('  ', 2);
    }
  };

  const executeCommand = (command: string) => {
    if (!textareaRef.current) return;
    textareaRef.current.focus();

    switch (command) {
      case 'bold': wrapSelection('**', '**'); break;
      case 'italic': wrapSelection('*', '*'); break;
      case 'h1': insertTextAtCursor('# ', 2); break;
      case 'quote': insertTextAtCursor('> ', 2); break;
      case 'code': wrapSelection('`', '`'); break;
      case 'codeblock': wrapSelection('```\n', '\n```'); break;
      case 'link': wrapSelection('[', '](url)'); break;
      case 'ul': insertTextAtCursor('- ', 2); break;
      case 'ol': insertTextAtCursor('1. ', 3); break;
      case 'task': insertTextAtCursor('- [ ] ', 6); break;
      case 'img': wrapSelection('![alt](', ')'); break;
      case 'hr': insertTextAtCursor('\n---\n', 5); break;
      case 'table':
        insertTextAtCursor('\n| Column 1 | Column 2 |\n| -------- | -------- |\n| Text     | Text     |\n', 0);
        break;
    }
  };

  const ToolButton = ({ icon: Icon, cmd, title }: { icon: any, cmd: string, title: string }) => (
    <button
      onClick={() => executeCommand(cmd)}
      title={title}
      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-400 focus:outline-none transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#000000] w-full border-r border-gray-200 dark:border-gray-800 relative z-10">
      <div className="editor-toolbar h-10 border-b border-gray-200 dark:border-[#262626] flex items-center px-2 gap-1 bg-[#f9fafb] dark:bg-[#0a0a0a] overflow-x-auto whitespace-nowrap scrollbar-hide">
        <ToolButton icon={Bold} cmd="bold" title="Bold" />
        <ToolButton icon={Italic} cmd="italic" title="Italic" />
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1 flex-shrink-0"></div>
        <ToolButton icon={Heading1} cmd="h1" title="Heading 1" />
        <ToolButton icon={Quote} cmd="quote" title="Blockquote" />
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1 flex-shrink-0"></div>
        <ToolButton icon={Code} cmd="code" title="Inline Code" />
        <ToolButton icon={Link} cmd="link" title="Insert Link" />
        <ToolButton icon={Image} cmd="img" title="Insert Image" />
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1 flex-shrink-0"></div>
        <ToolButton icon={List} cmd="ul" title="Unordered List" />
        <ToolButton icon={ListOrdered} cmd="ol" title="Ordered List" />
        <ToolButton icon={CheckSquare} cmd="task" title="Task List" />
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1 flex-shrink-0"></div>
        <ToolButton icon={Table} cmd="table" title="Table" />
        <ToolButton icon={Minus} cmd="hr" title="Horizontal Rule" />
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyUp={handleSelect}
        onKeyDown={handleKeyDown}
        className="flex-1 w-full p-4 bg-transparent text-[#1f2937] dark:text-[#a1a1aa] font-mono text-sm resize-none focus:outline-none leading-relaxed"
        placeholder="Type some markdown here..."
        spellCheck="false"
      />
    </div>
  );
}
