'use client';

import { useEffect } from 'react';
import { useTicketStore } from '@/stores/ticket-store';
import { TicketCard } from './ticket-card';
import { TicketForm } from './ticket-form';
import type { Ticket, TicketStatus } from '@/types/ticket';

const statusFilters: (TicketStatus | null)[] = [null, '신규', '진행중', '검토중', '종결', '보류'];
const statusLabels: Record<string, string> = {
  'null': 'ALL',
  '신규': '신규',
  '진행중': '진행중',
  '검토중': '검토중',
  '종결': '종결',
  '보류': '보류',
};

function groupByDate(tickets: Ticket[]): Map<string, Ticket[]> {
  const groups = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    const date = ticket.created_at.split(' ')[0]; // YYYY-MM-DD
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(ticket);
  }
  return groups;
}

export function TicketTimeline() {
  const { tickets, loading, filter, fetchTickets, setFilter } = useTicketStore();

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const grouped = groupByDate(tickets);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold tracking-widest text-neon-cyan text-glow-cyan">
            TICKET TIMELINE
          </h2>
          <span className="text-xs text-muted-foreground">
            ({tickets.length} RECORDS)
          </span>
        </div>
        <TicketForm />
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={String(s)}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded text-[10px] tracking-wider font-bold transition-all border ${
              filter === s
                ? 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30 glow-cyan'
                : 'text-muted-foreground border-border hover:border-neon-cyan/20 hover:text-foreground glass-light'
            }`}
          >
            {statusLabels[String(s)]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-neon-cyan neon-pulse text-sm tracking-widest">
            LOADING...
          </div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 glass rounded-lg border border-dashed border-border">
          <div className="text-3xl mb-3 opacity-30">▣</div>
          <p className="text-muted-foreground text-xs tracking-wider">
            NO TICKETS FOUND
          </p>
          <p className="text-muted-foreground text-[10px] mt-1">
            Create a new ticket to get started
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([date, dateTickets]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-neon-cyan/50" />
                <h3 className="text-[11px] text-neon-cyan/70 tracking-widest font-bold">
                  {date}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground">
                  {dateTickets.length} TICKETS
                </span>
              </div>
              <div className="space-y-2 ml-5 border-l border-border pl-4">
                {dateTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
