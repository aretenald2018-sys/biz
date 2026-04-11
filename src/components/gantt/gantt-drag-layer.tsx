'use client';

import { ROW_HEIGHT } from './gantt-bar';

interface GanttDragLayerProps {
  viewStartDate: string;
  dragStartX: number | null;
  dragCurrentX: number | null;
  dragRowIndex: number;
}

export function GanttDragLayer({ dragStartX, dragCurrentX, dragRowIndex }: GanttDragLayerProps) {
  if (dragStartX === null || dragCurrentX === null) return null;

  const minX = Math.min(dragStartX, dragCurrentX);
  const width = Math.abs(dragCurrentX - dragStartX);

  if (width <= 10) return null;

  return (
    <div
      className="absolute rounded-md neon-pulse"
      style={{
        left: minX,
        top: Math.max(0, dragRowIndex) * ROW_HEIGHT + 6,
        width,
        height: 28,
        zIndex: 5,
        background: 'rgba(94, 196, 212, 0.12)',
        border: '1px dashed rgba(94, 196, 212, 0.5)',
        pointerEvents: 'none',
      }}
    />
  );
}
