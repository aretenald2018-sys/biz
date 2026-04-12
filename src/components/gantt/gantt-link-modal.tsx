'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useScheduleStore } from '@/stores/schedule-store';
import { useTicketStore } from '@/stores/ticket-store';
import type { Schedule } from '@/types/schedule';

interface GanttLinkModalProps {
  schedule: Schedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GanttLinkModal({ schedule, open, onOpenChange }: GanttLinkModalProps) {
  const { tickets, fetchTickets } = useTicketStore();
  const { updateSchedule } = useScheduleStore();
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTickets();
      setQuery('');
    }
  }, [open, fetchTickets]);

  const filteredTickets = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return tickets;
    return tickets.filter((ticket) =>
      ticket.title.toLowerCase().includes(trimmed) ||
      (ticket.description || '').toLowerCase().includes(trimmed) ||
      ticket.status.toLowerCase().includes(trimmed)
    );
  }, [query, tickets]);

  const handleLink = async (ticketId: string) => {
    if (!schedule) return;
    setSaving(true);
    try {
      await updateSchedule(schedule.id, { ticket_id: ticketId });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle>Move Schedule Ticket</DialogTitle>
          <DialogDescription>
            {schedule ? `Choose the ticket that should own "${schedule.title}".` : 'Select a schedule first.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tickets"
            className="border-border bg-background"
          />

          {schedule?.ticket_title && (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
              Current ticket: <span className="font-medium">{schedule.ticket_title}</span>
            </div>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                className="w-full rounded-lg border border-border bg-card px-3 py-3 text-left transition hover:bg-muted/20"
                onClick={() => handleLink(ticket.id)}
                disabled={saving || ticket.id === schedule?.ticket_id}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{ticket.title}</span>
                  <span className="rounded-full bg-[#EDF2FF] px-2 py-0.5 text-[11px] text-[#002C5F]">
                    {ticket.status}
                  </span>
                </div>
                {ticket.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p>
                )}
              </button>
            ))}
            {filteredTickets.length === 0 && (
              <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                No matching tickets.
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
