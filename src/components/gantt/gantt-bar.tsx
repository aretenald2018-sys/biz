'use client';

import type { Schedule } from '@/types/schedule';
import type { WeekColumn } from './gantt-header';
import { WEEK_COL_WIDTH } from './gantt-header';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getBarPosition(schedule: Schedule, viewStartDate: string) {
  const viewStart = new Date(viewStartDate).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const barStart = new Date(schedule.start_date).getTime();
  const barEnd = new Date(schedule.end_date).getTime();

  const left = ((barStart - viewStart) / msPerDay / 7) * WEEK_COL_WIDTH;
  const width = ((barEnd - barStart + msPerDay) / msPerDay / 7) * WEEK_COL_WIDTH;

  return { left, width: Math.max(width, WEEK_COL_WIDTH * 0.3) };
}

interface GanttBarProps {
  schedule: Schedule;
  viewStartDate: string;
  rowIndex: number;
  onClick: (schedule: Schedule) => void;
}

const ROW_HEIGHT = 36;
const BAR_HEIGHT = 28;
const ROW_GAP = 4;

export { ROW_HEIGHT, BAR_HEIGHT, ROW_GAP };

export function GanttBar({ schedule, viewStartDate, rowIndex, onClick }: GanttBarProps) {
  const { left, width } = getBarPosition(schedule, viewStartDate);
  const top = rowIndex * (ROW_HEIGHT + ROW_GAP) + ROW_GAP;
  const color = schedule.color || '#5ec4d4';

  return (
    <div
      className="gantt-block absolute flex items-center px-2 gap-1 overflow-hidden cursor-pointer"
      style={{
        left,
        top,
        width,
        height: BAR_HEIGHT,
        zIndex: 10,
        background: hexToRgba(color, 0.18),
        border: `1px solid ${hexToRgba(color, 0.4)}`,
        boxShadow: `0 0 8px ${hexToRgba(color, 0.15)}`,
      }}
      onClick={(e) => { e.stopPropagation(); onClick(schedule); }}
      title={`${schedule.title}\n${schedule.start_date} ~ ${schedule.end_date}${schedule.ticket_title ? `\n🎫 ${schedule.ticket_title}` : ''}${schedule.url ? `\n🔗 ${schedule.url}` : ''}`}
    >
      {/* Left resize handle */}
      <div
        className="gantt-block-handle gantt-block-handle-left"
        style={{ background: hexToRgba(color, 0.6) }}
      />

      {/* Ticket dot indicator */}
      {schedule.ticket_id && (
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: color }}
        />
      )}

      {/* Title */}
      <span className="text-[10px] font-medium truncate text-foreground/90">
        {schedule.title}
      </span>

      {/* URL indicator */}
      {schedule.url && (
        <span className="text-[8px] text-muted-foreground shrink-0">🔗</span>
      )}

      {/* Right resize handle */}
      <div
        className="gantt-block-handle gantt-block-handle-right"
        style={{ background: hexToRgba(color, 0.6) }}
      />
    </div>
  );
}
