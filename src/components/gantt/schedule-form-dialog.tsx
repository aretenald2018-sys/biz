'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useScheduleStore } from '@/stores/schedule-store';
import { useTicketStore } from '@/stores/ticket-store';

const COLORS = [
  { name: 'Cyan', hex: '#5ec4d4' },
  { name: 'Magenta', hex: '#d47ecf' },
  { name: 'Green', hex: '#5ec490' },
  { name: 'Amber', hex: '#d4a04e' },
  { name: 'Blue', hex: '#6498d4' },
  { name: 'Red', hex: '#d4606a' },
];

export function ScheduleFormDialog() {
  const {
    isFormOpen, formMode, selectedScheduleId, dragPreview, schedules,
    closeForm, createSchedule, updateSchedule, deleteSchedule,
  } = useScheduleStore();

  const { tickets, fetchTickets } = useTicketStore();

  const editingSchedule = selectedScheduleId
    ? schedules.find((schedule) => schedule.id === selectedScheduleId)
    : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#5ec4d4');

  useEffect(() => {
    if (!isFormOpen) return;
    fetchTickets();
  }, [isFormOpen, fetchTickets]);

  useEffect(() => {
    if (!isFormOpen) return;

    if (formMode === 'edit' && editingSchedule) {
      setTitle(editingSchedule.title);
      setDescription(editingSchedule.description || '');
      setStartDate(editingSchedule.start_date);
      setEndDate(editingSchedule.end_date);
      setTicketId(editingSchedule.ticket_id);
      setUrl(editingSchedule.url || '');
      setColor(editingSchedule.color);
      return;
    }

    setTitle('');
    setDescription('');
    setStartDate(dragPreview?.startDate || '');
    setEndDate(dragPreview?.endDate || '');
    setTicketId(dragPreview?.ticketId || tickets[0]?.id || '');
    setUrl('');
    setColor('#5ec4d4');
  }, [isFormOpen, formMode, editingSchedule, dragPreview, tickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate || !ticketId) return;

    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      ticket_id: ticketId,
      url: url.trim() || undefined,
      color,
    };

    if (formMode === 'edit' && selectedScheduleId) {
      await updateSchedule(selectedScheduleId, input);
    } else {
      await createSchedule(input);
    }
    closeForm();
  };

  const handleDelete = async () => {
    if (selectedScheduleId) {
      await deleteSchedule(selectedScheduleId);
      closeForm();
    }
  };

  return (
    <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
      <DialogContent className="glass border-neon-cyan/20 glow-cyan">
        <DialogHeader>
          <DialogTitle className="text-sm tracking-wider text-neon-cyan text-glow-cyan">
            {formMode === 'edit' ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] tracking-wider text-muted-foreground">TITLE</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Schedule title..."
              className="border-border bg-white/5 text-sm focus:border-neon-cyan/50"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] tracking-wider text-muted-foreground">DESCRIPTION</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="resize-none border-border bg-white/5 text-sm focus:border-neon-cyan/50"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] tracking-wider text-muted-foreground">START DATE</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-border bg-white/5 text-sm focus:border-neon-cyan/50"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] tracking-wider text-muted-foreground">END DATE</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-border bg-white/5 text-sm focus:border-neon-cyan/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] tracking-wider text-muted-foreground">TICKET</label>
            <select
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="w-full rounded border border-border bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-neon-cyan/50"
              required
            >
              <option value="" disabled>Select a ticket</option>
              {tickets.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  [{ticket.status}] {ticket.title}
                </option>
              ))}
            </select>
            {tickets.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Create a ticket before adding a schedule.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[10px] tracking-wider text-muted-foreground">URL</label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="border-border bg-white/5 text-sm focus:border-neon-cyan/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] tracking-wider text-muted-foreground">COLOR</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    background: c.hex,
                    borderColor: color === c.hex ? '#fff' : 'transparent',
                    boxShadow: color === c.hex ? `0 0 10px ${c.hex}` : 'none',
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <div>
              {formMode === 'edit' && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  className="border border-red-500/30 bg-red-500/10 text-xs tracking-wider text-red-400 hover:bg-red-500/20"
                >
                  DELETE
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeForm}
                className="text-xs text-muted-foreground"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                disabled={!ticketId || tickets.length === 0}
                className="border border-neon-cyan/30 bg-neon-cyan/20 text-xs tracking-wider text-neon-cyan hover:bg-neon-cyan/30"
              >
                {formMode === 'edit' ? 'UPDATE' : 'CREATE'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
