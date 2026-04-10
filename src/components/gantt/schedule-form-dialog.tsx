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
    ? schedules.find((s) => s.id === selectedScheduleId)
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

    if (formMode === 'edit' && editingSchedule) {
      setTitle(editingSchedule.title);
      setDescription(editingSchedule.description || '');
      setStartDate(editingSchedule.start_date);
      setEndDate(editingSchedule.end_date);
      setTicketId(editingSchedule.ticket_id || '');
      setUrl(editingSchedule.url || '');
      setColor(editingSchedule.color);
    } else {
      setTitle('');
      setDescription('');
      setStartDate(dragPreview?.startDate || '');
      setEndDate(dragPreview?.endDate || '');
      setTicketId(dragPreview?.ticketId || '');
      setUrl('');
      setColor('#5ec4d4');
    }
  }, [isFormOpen, formMode, editingSchedule, dragPreview, fetchTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;

    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      ticket_id: ticketId || undefined,
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
          <DialogTitle className="text-neon-cyan text-glow-cyan tracking-wider text-sm">
            {formMode === 'edit' ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">TITLE</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Schedule title..."
              className="bg-white/5 border-border focus:border-neon-cyan/50 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">DESCRIPTION</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="bg-white/5 border-border focus:border-neon-cyan/50 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">START DATE</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/5 border-border focus:border-neon-cyan/50 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">END DATE</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white/5 border-border focus:border-neon-cyan/50 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">LINKED TICKET</label>
            <select
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="w-full px-3 py-2 rounded bg-white/5 border border-border text-sm text-foreground focus:border-neon-cyan/50 outline-none"
            >
              <option value="">None</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.status}] {t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">URL</label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="bg-white/5 border-border focus:border-neon-cyan/50 text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">COLOR</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
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
                  className="bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-xs tracking-wider"
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
                className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 text-xs tracking-wider"
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
