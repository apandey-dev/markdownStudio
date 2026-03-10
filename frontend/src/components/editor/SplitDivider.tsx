import { useState, useEffect } from 'react';
import { GripVertical } from 'lucide-react';

interface SplitDividerProps {
  onDrag: (e: MouseEvent) => void;
}

export default function SplitDivider({ onDrag }: SplitDividerProps) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onDrag);
      const handleMouseUp = () => setIsDragging(false);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      };
    }
  }, [isDragging, onDrag]);

  return (
    <div
      onMouseDown={() => setIsDragging(true)}
      className="split-divider w-1.5 hover:w-2 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 transition-colors cursor-col-resize flex items-center justify-center relative group z-10"
    >
      <div className="absolute inset-y-0 -left-2 -right-2 z-20"></div>
      <div className="w-4 h-8 bg-gray-300 dark:bg-gray-700 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3 h-3 text-gray-500 dark:text-gray-400" />
      </div>
    </div>
  );
}
