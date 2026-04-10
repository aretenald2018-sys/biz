'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useScheduleStore } from '@/stores/schedule-store';
import { GanttHeader, getWeekColumns, WEEK_COL_WIDTH } from './gantt-header';
import { GanttBar, ROW_HEIGHT, ROW_GAP } from './gantt-bar';
import { GanttDragLayer } from './gantt-drag-layer';
import { ScheduleFormDialog } from './schedule-form-dialog';

function xToDate(x: number, viewStartDate: string): string {
  const weekIndex = Math.floor(x / WEEK_COL_WIDTH);
  const dayInWeek = Math.floor(((x % WEEK_COL_WIDTH) / WEEK_COL_WIDTH) * 7);
  const start = new Date(viewStartDate);
  start.setDate(start.getDate() + weekIndex * 7 + dayInWeek);
  return start.toISOString().split('T')[0];
}

export function GanttChart() {
  const {
    schedules, loading, viewStartDate, viewWeeks,
    fetchSchedules, navigateWeeks, goToToday, openEditForm,
    openCreateForm, setDragPreview,
  } = useScheduleStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const getX = useCallback((e: React.MouseEvent) => {
    if (!bodyRef.current) return 0;
    const rect = bodyRef.current.getBoundingClientRect();
    return e.clientX - rect.left;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // gantt-block 클릭은 바의 onClick에서 처리 (stopPropagation)
    const x = getX(e);
    setDragStartX(x);
    setDragCurrentX(x);
  }, [getX]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragStartX === null) return;
    const x = getX(e);
    setDragCurrentX(x);

    const startDate = xToDate(Math.min(dragStartX, x), viewStartDate);
    const endDate = xToDate(Math.max(dragStartX, x), viewStartDate);
    setDragPreview({ startDate, endDate });
  }, [dragStartX, getX, viewStartDate, setDragPreview]);

  const handleMouseUp = useCallback(() => {
    if (dragStartX === null || dragCurrentX === null) return;
    const minX = Math.min(dragStartX, dragCurrentX);
    const maxX = Math.max(dragStartX, dragCurrentX);

    setDragStartX(null);
    setDragCurrentX(null);

    if (maxX - minX > 10) {
      const startDate = xToDate(minX, viewStartDate);
      const endDate = xToDate(maxX, viewStartDate);
      openCreateForm(startDate, endDate);
      // dragPreview는 closeForm()에서 정리됨 — 여기서 null로 지우면 폼에 날짜가 안 들어감
    } else {
      setDragPreview(null);
    }
  }, [dragStartX, dragCurrentX, viewStartDate, openCreateForm, setDragPreview]);

  const columns = getWeekColumns(viewStartDate, viewWeeks);
  const totalWidth = viewWeeks * WEEK_COL_WIDTH;
  const rowCount = Math.max(schedules.length, 3);
  const bodyHeight = rowCount * (ROW_HEIGHT + ROW_GAP) + ROW_GAP;

  const viewEndDate = columns.length > 0 ? columns[columns.length - 1].endDate : viewStartDate;

  return (
    <div className="glass rounded-lg border border-border overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold tracking-widest text-neon-cyan text-glow-cyan">
            GANTT CHART
          </h2>
          <span className="text-xs text-muted-foreground">
            ({schedules.length} SCHEDULES)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tracking-wider mr-2">
            {viewStartDate} ~ {viewEndDate}
          </span>
          <button
            onClick={() => navigateWeeks(-4)}
            className="px-2 py-1 text-[10px] tracking-wider text-muted-foreground border border-border rounded hover:text-foreground hover:border-neon-cyan/20 transition-all glass-light"
          >
            ◀ PREV
          </button>
          <button
            onClick={goToToday}
            className="px-2 py-1 text-[10px] tracking-wider text-neon-cyan border border-neon-cyan/30 rounded hover:bg-neon-cyan/10 transition-all"
          >
            TODAY
          </button>
          <button
            onClick={() => navigateWeeks(4)}
            className="px-2 py-1 text-[10px] tracking-wider text-muted-foreground border border-border rounded hover:text-foreground hover:border-neon-cyan/20 transition-all glass-light"
          >
            NEXT ▶
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div ref={scrollRef} className="overflow-x-auto">
        <div style={{ width: totalWidth, position: 'relative' }}>
          <GanttHeader columns={columns} />

          {/* Body */}
          <div
            ref={bodyRef}
            style={{ position: 'relative', height: bodyHeight, cursor: 'crosshair' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Vertical grid lines */}
            {columns.map((col) => (
              <div
                key={col.index}
                className="absolute top-0 bottom-0"
                style={{
                  left: col.index * WEEK_COL_WIDTH,
                  width: WEEK_COL_WIDTH,
                  borderRight: '1px solid rgba(80,110,140,0.08)',
                  background: col.isCurrent ? 'rgba(94,196,212,0.03)' : 'transparent',
                }}
              />
            ))}

            {/* Schedule bars */}
            {schedules.map((schedule, i) => (
              <GanttBar
                key={schedule.id}
                schedule={schedule}
                viewStartDate={viewStartDate}
                rowIndex={i}
                onClick={() => openEditForm(schedule.id)}
              />
            ))}

            {/* Drag preview */}
            <GanttDragLayer
              viewStartDate={viewStartDate}
              dragStartX={dragStartX}
              dragCurrentX={dragCurrentX}
            />
          </div>

          {/* Empty state hint */}
          {!loading && schedules.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: 52 }}>
              <span className="text-[10px] text-muted-foreground/50 tracking-wider">
                DRAG TO CREATE A SCHEDULE
              </span>
            </div>
          )}
        </div>
      </div>

      <ScheduleFormDialog />
    </div>
  );
}
