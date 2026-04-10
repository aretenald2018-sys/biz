'use client';

export interface WeekColumn {
  index: number;
  startDate: string;
  endDate: string;
  label: string;
  month: number;
  year: number;
  isCurrent: boolean;
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const WEEK_COL_WIDTH = 120;

export function getWeekColumns(viewStartDate: string, viewWeeks: number): WeekColumn[] {
  const columns: WeekColumn[] = [];
  const start = new Date(viewStartDate);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  for (let i = 0; i < viewWeeks; i++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    columns.push({
      index: i,
      startDate: startStr,
      endDate: endStr,
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      month: weekStart.getMonth(),
      year: weekStart.getFullYear(),
      isCurrent: todayStr >= startStr && todayStr <= endStr,
    });
  }
  return columns;
}

interface MonthSpan {
  label: string;
  colSpan: number;
}

function getMonthSpans(columns: WeekColumn[]): MonthSpan[] {
  const spans: MonthSpan[] = [];
  for (const col of columns) {
    const label = `${MONTH_NAMES[col.month]} ${col.year}`;
    if (spans.length > 0 && spans[spans.length - 1].label === label) {
      spans[spans.length - 1].colSpan++;
    } else {
      spans.push({ label, colSpan: 1 });
    }
  }
  return spans;
}

export function GanttHeader({ columns }: { columns: WeekColumn[] }) {
  const monthSpans = getMonthSpans(columns);

  return (
    <div className="sticky top-0 z-20">
      {/* Month row */}
      <div className="flex" style={{ height: 24 }}>
        {monthSpans.map((span, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[10px] text-neon-magenta/70 tracking-widest font-bold border-b border-border/30"
            style={{ width: span.colSpan * WEEK_COL_WIDTH }}
          >
            {span.label}
          </div>
        ))}
      </div>
      {/* Week row */}
      <div className="flex" style={{ height: 28 }}>
        {columns.map((col) => (
          <div
            key={col.index}
            className={`flex items-center justify-center text-[10px] tracking-wider border-b border-r border-border/20 ${
              col.isCurrent
                ? 'text-neon-cyan font-bold bg-neon-cyan/5'
                : 'text-muted-foreground'
            }`}
            style={{ width: WEEK_COL_WIDTH }}
          >
            {col.label}
          </div>
        ))}
      </div>
    </div>
  );
}
