'use client';

import type { Schedule } from '@/types/schedule';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getBarPosition(schedule: Schedule, viewStartDate: string, weekColWidth: number) {
  const viewStart = new Date(viewStartDate).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const barStart = new Date(schedule.start_date).getTime();
  const barEnd = new Date(schedule.end_date).getTime();

  const left = ((barStart - viewStart) / msPerDay / 7) * weekColWidth;
  const width = ((barEnd - barStart + msPerDay) / msPerDay / 7) * weekColWidth;

  return { left, width: Math.max(width, weekColWidth * 0.3) };
}

interface GanttBarProps {
  schedule: Schedule;
  viewStartDate: string;
  rowIndex: number;
  weekColWidth: number;
  onBarMouseDown: (e: React.MouseEvent, schedule: Schedule) => void;
  onLeftHandleMouseDown: (e: React.MouseEvent, schedule: Schedule) => void;
  onRightHandleMouseDown: (e: React.MouseEvent, schedule: Schedule) => void;
  onMoreClick: (schedule: Schedule) => void;
  onTooltipEnter: (e: React.MouseEvent, schedule: Schedule) => void;
  onTooltipMove: (e: React.MouseEvent, schedule: Schedule) => void;
  onTooltipLeave: () => void;
  positionOverride?: { left: number; width: number };
  isDragging?: boolean;
}

const ROW_HEIGHT = 40;
const BAR_HEIGHT = 28;
const ROW_GAP = 0;

export { ROW_HEIGHT, BAR_HEIGHT, ROW_GAP };

export function GanttBar({
  schedule,
  viewStartDate,
  rowIndex,
  weekColWidth,
  onBarMouseDown,
  onLeftHandleMouseDown,
  onRightHandleMouseDown,
  onMoreClick,
  onTooltipEnter,
  onTooltipMove,
  onTooltipLeave,
  positionOverride,
  isDragging,
}: GanttBarProps) {
  const { left, width } = positionOverride ?? getBarPosition(schedule, viewStartDate, weekColWidth);
  const top = rowIndex * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
  const color = schedule.color || '#5ec4d4';

  return (
    <div
      className={`gantt-block group absolute flex items-center px-2 gap-1 overflow-hidden${isDragging ? ' dragging' : ''}`}
      style={{
        left,
        top,
        width,
        height: BAR_HEIGHT,
        zIndex: isDragging ? 50 : 10,
        background: hexToRgba(color, 0.18),
        border: `1px solid ${hexToRgba(color, 0.4)}`,
        boxShadow: `0 0 8px ${hexToRgba(color, 0.15)}`,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onBarMouseDown(e, schedule);
      }}
      onMouseEnter={(e) => onTooltipEnter(e, schedule)}
      onMouseMove={(e) => onTooltipMove(e, schedule)}
      onMouseLeave={onTooltipLeave}
    >
      <div
        className="gantt-block-handle gantt-block-handle-left"
        style={{ background: hexToRgba(color, 0.6) }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onLeftHandleMouseDown(e, schedule);
        }}
      />

      <span className="text-[10px] font-medium truncate text-foreground/90">
        {schedule.title}
      </span>

      {schedule.url && <span className="text-[8px] text-muted-foreground shrink-0">🔗</span>}

      <button
        type="button"
        className="ml-auto hidden shrink-0 rounded bg-white/70 px-1 text-[10px] text-[#002C5F] shadow-sm transition group-hover:block"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onMoreClick(schedule);
        }}
        title="More actions"
      >
        ...
      </button>

      <div
        className="gantt-block-handle gantt-block-handle-right"
        style={{ background: hexToRgba(color, 0.6) }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onRightHandleMouseDown(e, schedule);
        }}
      />
    </div>
  );
}
