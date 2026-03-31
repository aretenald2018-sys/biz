'use client';

import Link from 'next/link';
import type { Ticket } from '@/types/ticket';
import { TicketStatusBadge } from './ticket-status-badge';

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const date = new Date(ticket.created_at);
  const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <Link href={`/tickets/${ticket.id}`}>
      <div className="glass rounded-lg p-4 hover:bg-white/5 transition-all cursor-pointer border border-border hover:border-neon-cyan/30 hover:glow-cyan group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-neon-cyan transition-colors truncate">
              {ticket.title}
            </h3>
            {ticket.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {ticket.description}
              </p>
            )}
          </div>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground tracking-wider">
          <span>ID: {ticket.id.substring(0, 8).toUpperCase()}</span>
          <span>{timeStr}</span>
          {(ticket.email_count ?? 0) > 0 && (
            <span className="text-neon-magenta">{ticket.email_count} EMAILS</span>
          )}
          {ticket.ai_summary && (
            <span className="text-neon-cyan">AI ANALYZED</span>
          )}
        </div>
      </div>
    </Link>
  );
}
