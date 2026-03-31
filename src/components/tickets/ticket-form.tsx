'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTicketStore } from '@/stores/ticket-store';

export function TicketForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const createTicket = useTicketStore((s) => s.createTicket);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createTicket({ title: title.trim(), description: description.trim() || undefined });
    setTitle('');
    setDescription('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 hover:glow-cyan text-xs tracking-wider" />}
      >
        + NEW TICKET
      </DialogTrigger>
      <DialogContent className="glass border-neon-cyan/20 glow-cyan">
        <DialogHeader>
          <DialogTitle className="text-neon-cyan text-glow-cyan tracking-wider text-sm">
            CREATE NEW TICKET
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">
              TITLE
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter ticket title..."
              className="bg-white/5 border-border focus:border-neon-cyan/50 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider mb-1 block">
              DESCRIPTION
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              rows={3}
              className="bg-white/5 border-border focus:border-neon-cyan/50 text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground"
            >
              CANCEL
            </Button>
            <Button
              type="submit"
              className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 text-xs tracking-wider"
            >
              CREATE
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
