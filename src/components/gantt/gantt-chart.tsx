'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useScheduleStore } from '@/stores/schedule-store';
import { useTicketStore } from '@/stores/ticket-store';
import { GanttHeader, getWeekColumns } from './gantt-header';
import { GanttBar, getBarPosition, ROW_HEIGHT } from './gantt-bar';
import { GanttDragLayer } from './gantt-drag-layer';
import { ScheduleFormDialog } from './schedule-form-dialog';
import type { Schedule } from '@/types/schedule';
import type { Ticket } from '@/types/ticket';

const PANEL_WIDTH = 180;
const HEADER_HEIGHT = 52; // 24 (month) + 28 (week)

type DragOp =
  | { type: 'create'; startX: number; rowIdx: number }
  | { type: 'resize-left'; id: string; origStart: string; origEnd: string; startX: number }
  | { type: 'resize-right'; id: string; origStart: string; origEnd: string; startX: number }
  | { type: 'move'; id: string; origStart: string; origEnd: string; startX: number; durationDays: number }
  | null;

interface TicketRow {
  ticket: Ticket | null;
  schedules: Schedule[];
}

function xToDate(x: number, viewStartDate: string, weekColWidth: number): string {
  const weekIndex = Math.floor(x / weekColWidth);
  const dayInWeek = Math.floor(((x % weekColWidth) / weekColWidth) * 7);
  const start = new Date(viewStartDate);
  start.setDate(start.getDate() + weekIndex * 7 + dayInWeek);
  return start.toISOString().split('T')[0];
}

function dateDiffDays(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const STATUS_COLORS: Record<string, string> = {
  '신규': 'text-blue-400',
  '진행중': 'text-neon-cyan',
  '검토중': 'text-amber-400',
  '종결': 'text-muted-foreground',
  '보류': 'text-red-400',
};

export function GanttChart() {
  const router = useRouter();
  const {
    schedules, loading, viewStartDate, viewWeeks,
    fetchSchedules, navigateWeeks, goToToday, openEditForm,
    openCreateForm, setDragPreview, updateSchedule,
  } = useScheduleStore();

  const { tickets, fetchTickets } = useTicketStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Create-drag state
  const [createDragStartX, setCreateDragStartX] = useState<number | null>(null);
  const [createDragCurrentX, setCreateDragCurrentX] = useState<number | null>(null);
  const createDragRowRef = useRef<number>(-1);

  // Bar drag state
  const dragOpRef = useRef<DragOp>(null);
  const barOverridesRef = useRef<Record<string, { start_date: string; end_date: string }>>({});
  const [barOverrides, setBarOverrides] = useState<Record<string, { start_date: string; end_date: string }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Dynamic column width
  const [weekColWidth, setWeekColWidth] = useState(30);

  // Refs for latest values
  const viewStartDateRef = useRef(viewStartDate);
  viewStartDateRef.current = viewStartDate;
  const weekColWidthRef = useRef(weekColWidth);
  weekColWidthRef.current = weekColWidth;

  useEffect(() => {
    fetchSchedules();
    fetchTickets();
  }, [fetchSchedules, fetchTickets]);

  // 티켓별 스케줄 그룹핑
  const ticketRows: TicketRow[] = useMemo(() => {
    const grouped = new Map<string, Schedule[]>();
    const unassigned: Schedule[] = [];

    for (const s of schedules) {
      if (s.ticket_id) {
        const list = grouped.get(s.ticket_id) || [];
        list.push(s);
        grouped.set(s.ticket_id, list);
      } else {
        unassigned.push(s);
      }
    }

    const rows: TicketRow[] = tickets.map(ticket => ({
      ticket,
      schedules: grouped.get(ticket.id) || [],
    }));

    if (unassigned.length > 0) {
      rows.push({ ticket: null, schedules: unassigned });
    }

    // 스케줄 없는 티켓도 최소 3행 확보
    if (rows.length < 3) {
      while (rows.length < 3) {
        rows.push({ ticket: null, schedules: [] });
      }
    }

    return rows;
  }, [schedules, tickets]);

  // Container width → column width
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setWeekColWidth(Math.max(25, Math.floor(w / viewWeeks)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewWeeks]);

  const scrollToToday = useCallback(() => {
    goToToday();
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const diffMs = now.getTime() - yearStart.getTime();
      const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      const scrollTarget = Math.max(0, (weekIndex - 2) * weekColWidth);
      scrollRef.current.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    });
  }, [goToToday, weekColWidth]);

  const getX = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!bodyRef.current) return 0;
    const rect = bodyRef.current.getBoundingClientRect();
    return e.clientX - rect.left;
  }, []);

  const getRowFromY = useCallback((e: React.MouseEvent) => {
    if (!bodyRef.current) return 0;
    const rect = bodyRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return Math.floor(y / ROW_HEIGHT);
  }, []);

  // === 바 드래그/리사이즈 (document-level) ===

  const handleDocMouseMove = useCallback((e: MouseEvent) => {
    const op = dragOpRef.current;
    if (!op || op.type === 'create') return;

    const x = getX(e);
    const vsd = viewStartDateRef.current;
    const wcw = weekColWidthRef.current;
    const currentDate = xToDate(x, vsd, wcw);

    let override: { start_date: string; end_date: string };

    if (op.type === 'resize-left') {
      const newStart = currentDate <= op.origEnd ? currentDate : op.origEnd;
      override = { start_date: newStart, end_date: op.origEnd };
    } else if (op.type === 'resize-right') {
      const newEnd = currentDate >= op.origStart ? currentDate : op.origStart;
      override = { start_date: op.origStart, end_date: newEnd };
    } else {
      const dayDelta = dateDiffDays(xToDate(op.startX, vsd, wcw), currentDate);
      const newStart = addDaysToDate(op.origStart, dayDelta);
      const newEnd = addDaysToDate(newStart, op.durationDays);
      override = { start_date: newStart, end_date: newEnd };
    }

    barOverridesRef.current = { [op.id]: override };
    setBarOverrides({ [op.id]: override });
  }, [getX]);

  const handleDocMouseUp = useCallback((e: MouseEvent) => {
    const op = dragOpRef.current;
    if (!op || op.type === 'create') return;

    const x = getX(e);
    const moved = Math.abs(x - op.startX);

    if (op.type === 'move' && moved < 5) {
      // 클릭 — ticket_id가 있으면 페이지 이동, 없으면 편집 폼
      const schedule = schedules.find(s => s.id === op.id);
      if (schedule?.ticket_id) {
        router.push(`/tickets/${schedule.ticket_id}`);
      } else {
        openEditForm(op.id);
      }
    } else if (moved >= 5) {
      const override = barOverridesRef.current[op.id];
      if (override) {
        updateSchedule(op.id, { start_date: override.start_date, end_date: override.end_date });
      }
    }

    dragOpRef.current = null;
    barOverridesRef.current = {};
    setBarOverrides({});
    setDraggingId(null);
  }, [getX, schedules, router, openEditForm, updateSchedule]);

  useEffect(() => {
    document.addEventListener('mousemove', handleDocMouseMove);
    document.addEventListener('mouseup', handleDocMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleDocMouseMove);
      document.removeEventListener('mouseup', handleDocMouseUp);
    };
  }, [handleDocMouseMove, handleDocMouseUp]);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, schedule: Schedule) => {
    if (e.button !== 0) return;
    const x = getX(e);
    const duration = dateDiffDays(schedule.start_date, schedule.end_date);
    dragOpRef.current = {
      type: 'move', id: schedule.id,
      origStart: schedule.start_date, origEnd: schedule.end_date,
      startX: x, durationDays: duration,
    };
    setDraggingId(schedule.id);
  }, [getX]);

  const handleLeftHandleMouseDown = useCallback((e: React.MouseEvent, schedule: Schedule) => {
    if (e.button !== 0) return;
    dragOpRef.current = {
      type: 'resize-left', id: schedule.id,
      origStart: schedule.start_date, origEnd: schedule.end_date,
      startX: getX(e),
    };
    setDraggingId(schedule.id);
  }, [getX]);

  const handleRightHandleMouseDown = useCallback((e: React.MouseEvent, schedule: Schedule) => {
    if (e.button !== 0) return;
    dragOpRef.current = {
      type: 'resize-right', id: schedule.id,
      origStart: schedule.start_date, origEnd: schedule.end_date,
      startX: getX(e),
    };
    setDraggingId(schedule.id);
  }, [getX]);

  // === 빈 영역 드래그 (새 스케줄 생성) ===

  const handleBodyMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const x = getX(e);
    const rowIdx = getRowFromY(e);
    setCreateDragStartX(x);
    setCreateDragCurrentX(x);
    createDragRowRef.current = rowIdx;
  }, [getX, getRowFromY]);

  const handleBodyMouseMove = useCallback((e: React.MouseEvent) => {
    if (createDragStartX === null) return;
    const x = getX(e);
    setCreateDragCurrentX(x);

    const startDate = xToDate(Math.min(createDragStartX, x), viewStartDate, weekColWidth);
    const endDate = xToDate(Math.max(createDragStartX, x), viewStartDate, weekColWidth);
    setDragPreview({ startDate, endDate });
  }, [createDragStartX, getX, viewStartDate, weekColWidth, setDragPreview]);

  const handleBodyMouseUp = useCallback(() => {
    if (createDragStartX === null || createDragCurrentX === null) return;
    const minX = Math.min(createDragStartX, createDragCurrentX);
    const maxX = Math.max(createDragStartX, createDragCurrentX);

    setCreateDragStartX(null);
    setCreateDragCurrentX(null);

    if (maxX - minX > 10) {
      const startDate = xToDate(minX, viewStartDate, weekColWidth);
      const endDate = xToDate(maxX, viewStartDate, weekColWidth);
      // Y 좌표에서 어떤 티켓 행인지 판별
      const rowIdx = createDragRowRef.current;
      const row = ticketRows[rowIdx];
      const ticketId = row?.ticket?.id;
      openCreateForm(startDate, endDate, ticketId);
    } else {
      setDragPreview(null);
    }
  }, [createDragStartX, createDragCurrentX, viewStartDate, weekColWidth, ticketRows, openCreateForm, setDragPreview]);

  const columns = getWeekColumns(viewStartDate, viewWeeks);
  const totalWidth = viewWeeks * weekColWidth;
  const bodyHeight = ticketRows.length * ROW_HEIGHT;

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
            onClick={() => navigateWeeks(-12)}
            className="px-2 py-1 text-[10px] tracking-wider text-muted-foreground border border-border rounded hover:text-foreground hover:border-neon-cyan/20 transition-all glass-light"
          >
            ◀ PREV
          </button>
          <button
            onClick={scrollToToday}
            className="px-2 py-1 text-[10px] tracking-wider text-neon-cyan border border-neon-cyan/30 rounded hover:bg-neon-cyan/10 transition-all"
          >
            TODAY
          </button>
          <button
            onClick={() => navigateWeeks(12)}
            className="px-2 py-1 text-[10px] tracking-wider text-muted-foreground border border-border rounded hover:text-foreground hover:border-neon-cyan/20 transition-all glass-light"
          >
            NEXT ▶
          </button>
        </div>
      </div>

      {/* WBS Layout: 좌측 패널 + 우측 차트 */}
      <div className="flex">
        {/* 좌측 고정 패널 */}
        <div
          className="shrink-0 border-r border-border/30 z-10 bg-background"
          style={{ width: PANEL_WIDTH }}
        >
          {/* 헤더 높이 맞춤 */}
          <div
            className="flex items-end justify-center border-b border-border/20 text-[10px] text-muted-foreground tracking-widest font-bold"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="pb-1.5">TICKET</span>
          </div>
          {/* 티켓 행 */}
          {ticketRows.map((row, i) => (
            <div
              key={row.ticket?.id ?? `unassigned-${i}`}
              className="flex flex-col justify-center px-3 border-b border-border/10 hover:bg-white/[0.02] transition-colors cursor-pointer"
              style={{ height: ROW_HEIGHT }}
              onClick={() => {
                if (row.ticket) router.push(`/tickets/${row.ticket.id}`);
              }}
            >
              {row.ticket ? (
                <>
                  <span className="text-[11px] font-medium text-foreground/90 truncate leading-tight">
                    {row.ticket.title}
                  </span>
                  <span className={`text-[9px] tracking-wider ${STATUS_COLORS[row.ticket.status] || 'text-muted-foreground'}`}>
                    {row.ticket.status}
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground/50 italic">
                  (미지정)
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 우측 차트 영역 */}
        <div ref={scrollRef} className="overflow-x-auto flex-1">
          <div style={{ width: totalWidth, position: 'relative' }}>
            <GanttHeader columns={columns} weekColWidth={weekColWidth} />

            {/* Body */}
            <div
              ref={bodyRef}
              style={{ position: 'relative', height: bodyHeight, cursor: 'crosshair' }}
              onMouseDown={handleBodyMouseDown}
              onMouseMove={handleBodyMouseMove}
              onMouseUp={handleBodyMouseUp}
              onMouseLeave={handleBodyMouseUp}
            >
              {/* 행 구분선 + 그리드 */}
              {ticketRows.map((_, rowIdx) => (
                <div
                  key={rowIdx}
                  className="absolute left-0 right-0 border-b border-border/10"
                  style={{ top: rowIdx * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}

              {/* Vertical grid lines */}
              {columns.map((col) => (
                <div
                  key={col.index}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: col.index * weekColWidth,
                    width: weekColWidth,
                    borderRight: '1px solid rgba(80,110,140,0.08)',
                    background: col.isCurrent ? 'rgba(94,196,212,0.03)' : 'transparent',
                  }}
                />
              ))}

              {/* Schedule bars — 티켓 행별 렌더링 */}
              {ticketRows.map((row, rowIdx) =>
                row.schedules.map((schedule) => {
                  const override = barOverrides[schedule.id];
                  const posOverride = override
                    ? getBarPosition({ ...schedule, ...override }, viewStartDate, weekColWidth)
                    : undefined;

                  return (
                    <GanttBar
                      key={schedule.id}
                      schedule={schedule}
                      viewStartDate={viewStartDate}
                      rowIndex={rowIdx}
                      weekColWidth={weekColWidth}
                      onBarMouseDown={handleBarMouseDown}
                      onLeftHandleMouseDown={handleLeftHandleMouseDown}
                      onRightHandleMouseDown={handleRightHandleMouseDown}
                      positionOverride={posOverride}
                      isDragging={draggingId === schedule.id}
                    />
                  );
                })
              )}

              {/* Drag preview (create) */}
              <GanttDragLayer
                viewStartDate={viewStartDate}
                dragStartX={createDragStartX}
                dragCurrentX={createDragCurrentX}
              />
            </div>

            {/* Empty state */}
            {!loading && schedules.length === 0 && tickets.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: HEADER_HEIGHT }}>
                <span className="text-[10px] text-muted-foreground/50 tracking-wider">
                  DRAG TO CREATE A SCHEDULE
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ScheduleFormDialog />
    </div>
  );
}
