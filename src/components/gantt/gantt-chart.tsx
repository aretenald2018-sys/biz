'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useScheduleStore } from '@/stores/schedule-store';
import { useTicketStore } from '@/stores/ticket-store';
import { GanttHeader, getWeekColumns } from './gantt-header';
import { GanttBar, getBarPosition, ROW_HEIGHT } from './gantt-bar';
import { GanttDragLayer } from './gantt-drag-layer';
import { GanttLinkModal } from './gantt-link-modal';
import { ScheduleFormDialog } from './schedule-form-dialog';
import type { Schedule } from '@/types/schedule';
import type { Ticket } from '@/types/ticket';

const PANEL_WIDTH = 180;
const HEADER_HEIGHT = 52;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT = 112;

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

interface TooltipState {
  schedule: Schedule;
  x: number;
  y: number;
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

function buildTooltipLines(schedule: Schedule) {
  const lines = [
    schedule.title,
    `${schedule.start_date} ~ ${schedule.end_date}`,
  ];

  if (schedule.ticket_title) {
    lines.push(`Ticket: ${schedule.ticket_title}`);
  }

  if (schedule.url) {
    lines.push(schedule.url);
  }

  return lines;
}

function getTooltipPosition(tooltip: TooltipState | null) {
  if (!tooltip || typeof window === 'undefined') return null;

  return {
    left: Math.max(12, Math.min(tooltip.x + 14, window.innerWidth - TOOLTIP_WIDTH - 12)),
    top: Math.max(12, Math.min(tooltip.y + 14, window.innerHeight - TOOLTIP_HEIGHT - 12)),
  };
}

export function GanttChart() {
  const router = useRouter();
  const {
    schedules,
    loading,
    viewStartDate,
    viewWeeks,
    fetchSchedules,
    navigateWeeks,
    goToToday,
    openEditForm,
    openCreateForm,
    setDragPreview,
    updateSchedule,
  } = useScheduleStore();

  const { tickets, fetchTickets } = useTicketStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [createDragStartX, setCreateDragStartX] = useState<number | null>(null);
  const [createDragCurrentX, setCreateDragCurrentX] = useState<number | null>(null);
  const createDragRowRef = useRef<number>(-1);

  const dragOpRef = useRef<DragOp>(null);
  const barOverridesRef = useRef<Record<string, { start_date: string; end_date: string }>>({});
  const [barOverrides, setBarOverrides] = useState<Record<string, { start_date: string; end_date: string }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [linkingSchedule, setLinkingSchedule] = useState<Schedule | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const [weekColWidth, setWeekColWidth] = useState(30);

  const viewStartDateRef = useRef(viewStartDate);
  viewStartDateRef.current = viewStartDate;
  const weekColWidthRef = useRef(weekColWidth);
  weekColWidthRef.current = weekColWidth;

  useEffect(() => {
    fetchSchedules();
    fetchTickets();
  }, [fetchSchedules, fetchTickets]);

  const ticketRows: TicketRow[] = useMemo(() => {
    const grouped = new Map<string, Schedule[]>();
    const unassigned: Schedule[] = [];

    for (const schedule of schedules) {
      if (schedule.ticket_id) {
        const list = grouped.get(schedule.ticket_id) || [];
        list.push(schedule);
        grouped.set(schedule.ticket_id, list);
      } else {
        unassigned.push(schedule);
      }
    }

    const rows: TicketRow[] = tickets.map((ticket) => ({
      ticket,
      schedules: grouped.get(ticket.id) || [],
    }));

    if (unassigned.length > 0) {
      rows.push({ ticket: null, schedules: unassigned });
    }

    if (rows.length < 3) {
      while (rows.length < 3) {
        rows.push({ ticket: null, schedules: [] });
      }
    }

    return rows;
  }, [schedules, tickets]);

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
    return e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
  }, []);

  const getRowFromY = useCallback((e: React.MouseEvent) => {
    if (!bodyRef.current) return 0;
    const rect = bodyRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return Math.floor(y / ROW_HEIGHT);
  }, []);

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
      const schedule = schedules.find((s) => s.id === op.id);
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

  const moveRef = useRef(handleDocMouseMove);
  const upRef = useRef(handleDocMouseUp);
  moveRef.current = handleDocMouseMove;
  upRef.current = handleDocMouseUp;

  useEffect(() => {
    const onMove = (e: MouseEvent) => moveRef.current(e);
    const onUp = (e: MouseEvent) => upRef.current(e);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, schedule: Schedule) => {
    if (e.button !== 0) return;
    const x = getX(e);
    const duration = dateDiffDays(schedule.start_date, schedule.end_date);
    dragOpRef.current = {
      type: 'move',
      id: schedule.id,
      origStart: schedule.start_date,
      origEnd: schedule.end_date,
      startX: x,
      durationDays: duration,
    };
    setDraggingId(schedule.id);
  }, [getX]);

  const handleLeftHandleMouseDown = useCallback((e: React.MouseEvent, schedule: Schedule) => {
    if (e.button !== 0) return;
    dragOpRef.current = {
      type: 'resize-left',
      id: schedule.id,
      origStart: schedule.start_date,
      origEnd: schedule.end_date,
      startX: getX(e),
    };
    setDraggingId(schedule.id);
  }, [getX]);

  const handleRightHandleMouseDown = useCallback((e: React.MouseEvent, schedule: Schedule) => {
    if (e.button !== 0) return;
    dragOpRef.current = {
      type: 'resize-right',
      id: schedule.id,
      origStart: schedule.start_date,
      origEnd: schedule.end_date,
      startX: getX(e),
    };
    setDraggingId(schedule.id);
  }, [getX]);

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

  const tooltipStyle = getTooltipPosition(tooltip);

  return (
    <div className="glass rounded-lg border border-border overflow-hidden">
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

      <div className="flex">
        <div
          className="shrink-0 border-r border-border/30 z-10 bg-background"
          style={{ width: PANEL_WIDTH }}
        >
          <div
            className="flex items-end justify-center border-b border-border/20 text-[10px] text-muted-foreground tracking-widest font-bold"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="pb-1.5">TICKET</span>
          </div>
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

        <div ref={scrollRef} className="overflow-x-auto flex-1">
          <div style={{ width: totalWidth, position: 'relative' }}>
            <GanttHeader columns={columns} weekColWidth={weekColWidth} />

            <div
              ref={bodyRef}
              style={{ position: 'relative', height: bodyHeight, cursor: 'crosshair' }}
              onMouseDown={handleBodyMouseDown}
              onMouseMove={handleBodyMouseMove}
              onMouseUp={handleBodyMouseUp}
              onMouseLeave={handleBodyMouseUp}
            >
              {ticketRows.map((_, rowIdx) => (
                <div
                  key={rowIdx}
                  className="absolute left-0 right-0 border-b border-border/10"
                  style={{ top: rowIdx * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}

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
                      onMoreClick={setLinkingSchedule}
                      onTooltipEnter={(e, nextSchedule) => {
                        setTooltip({
                          schedule: nextSchedule,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onTooltipMove={(e, nextSchedule) => {
                        setTooltip({
                          schedule: nextSchedule,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onTooltipLeave={() => setTooltip(null)}
                      positionOverride={posOverride}
                      isDragging={draggingId === schedule.id}
                    />
                  );
                })
              )}

              <GanttDragLayer
                viewStartDate={viewStartDate}
                dragStartX={createDragStartX}
                dragCurrentX={createDragCurrentX}
                dragRowIndex={createDragRowRef.current}
              />
            </div>

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

      {tooltip && tooltipStyle && typeof window !== 'undefined'
        ? createPortal(
          <div
            className="pointer-events-none fixed z-[9999] rounded-lg border border-border/70 bg-background/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md"
            style={{
              left: tooltipStyle.left,
              top: tooltipStyle.top,
              width: TOOLTIP_WIDTH,
              maxWidth: TOOLTIP_WIDTH,
            }}
          >
            <div className="space-y-1">
              {buildTooltipLines(tooltip.schedule).map((line, index) => (
                <div
                  key={`${tooltip.schedule.id}-${index}`}
                  className={index === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground break-all'}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )
        : null}

      <ScheduleFormDialog />
      <GanttLinkModal
        schedule={linkingSchedule}
        open={Boolean(linkingSchedule)}
        onOpenChange={(open) => {
          if (!open) setLinkingSchedule(null);
        }}
      />
    </div>
  );
}
