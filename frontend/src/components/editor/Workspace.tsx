import { useRef } from 'react';
import EditorPanel from './EditorPanel';
import PreviewPanel from './PreviewPanel';
import SplitDivider from './SplitDivider';
import { useUIStore } from '../../store/useUIStore';

export default function Workspace() {
  const { splitPaneWidth, setSplitPaneWidth } = useUIStore();
  const workspaceRef = useRef<HTMLDivElement>(null);

  const handleDrag = (e: MouseEvent) => {
    if (!workspaceRef.current) return;
    const { left, width } = workspaceRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - left) / width) * 100;
    setSplitPaneWidth(Math.max(10, Math.min(90, newWidth)));
  };

  return (
    <div ref={workspaceRef} className="flex-1 flex w-full relative h-full bg-white dark:bg-black overflow-hidden">
      <div className="h-full relative overflow-hidden" style={{ width: `${splitPaneWidth}%` }}>
        <EditorPanel />
      </div>

      <SplitDivider onDrag={handleDrag} />

      <div className="h-full relative overflow-hidden" style={{ width: `${100 - splitPaneWidth}%` }}>
        <PreviewPanel />
      </div>
    </div>
  );
}
