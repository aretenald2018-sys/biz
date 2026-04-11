'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTicketStore } from '@/stores/ticket-store';
import { useEmailFlowStore } from '@/stores/email-flow-store';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { EmailDropzone } from '@/components/email/email-dropzone';
import { EmailList } from '@/components/email/email-list';
// NoteEditor is now integrated into EmailList
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { TicketStatus } from '@/types/ticket';

const statuses: TicketStatus[] = ['신규', '진행중', '검토중', '종결', '보류'];

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { selectedTicket, fetchTicket, updateTicket, deleteTicket, clearSelectedTicket } = useTicketStore();
  const clearFlowSteps = useEmailFlowStore((state) => state.clearFlowSteps);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  // notesPinned removed — notes now in unified stack

  useEffect(() => {
    fetchTicket(id);
  }, [id, fetchTicket]);

  useEffect(() => () => {
    clearFlowSteps();
    clearSelectedTicket();
  }, [clearFlowSteps, clearSelectedTicket]);

  useEffect(() => {
    if (selectedTicket) {
      setTitle(selectedTicket.title);
      setDescription(selectedTicket.description || '');
    }
  }, [selectedTicket]);

  if (!selectedTicket) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-neon-cyan neon-pulse text-sm tracking-widest">
          LOADING TICKET DATA...
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    await updateTicket(id, { title, description: description || undefined });
    setEditing(false);
  };

  const handleStatusChange = async (status: string | null) => {
    if (status) {
      await updateTicket(id, { status: status as TicketStatus });
    }
  };

  const handleDelete = async () => {
    await deleteTicket(id);
    router.push('/');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <button onClick={() => router.push('/')} className="hover:text-neon-cyan transition-colors">
          DASHBOARD
        </button>
        <span>/</span>
        <span className="text-neon-cyan">
          TICKET-{selectedTicket.id.substring(0, 8).toUpperCase()}
        </span>
      </div>

      {/* Ticket Info */}
      <div className="glass rounded-lg p-6 border border-border">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {editing ? (
              <div className="space-y-3">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white/5 border-border text-lg font-bold"
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-white/5 border-border text-sm resize-none"
                  rows={3}
                  placeholder="Description..."
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 text-xs"
                  >
                    SAVE
                  </Button>
                  <Button
                    onClick={() => setEditing(false)}
                    variant="ghost"
                    className="text-xs text-muted-foreground"
                  >
                    CANCEL
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h1
                  className="text-lg font-bold text-foreground cursor-pointer hover:text-neon-cyan transition-colors"
                  onClick={() => setEditing(true)}
                >
                  {selectedTicket.title}
                </h1>
                {selectedTicket.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedTicket.description}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Select value={selectedTicket.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-32 bg-white/5 border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass border-border">
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger
                  render={<Button variant="ghost" className="text-neon-red/70 hover:text-neon-red text-xs" />}
                >
                  DELETE
                </DialogTrigger>
                <DialogContent className="glass border-neon-red/20">
                  <DialogHeader>
                    <DialogTitle className="text-neon-red text-sm">CONFIRM DELETE</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete this ticket? This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setDeleteOpen(false)}
                      className="text-xs"
                    >
                      CANCEL
                    </Button>
                    <Button
                      onClick={handleDelete}
                      className="bg-neon-red/20 text-neon-red border border-neon-red/30 text-xs"
                    >
                      DELETE
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground tracking-wider">
              <span>CREATED: {selectedTicket.created_at}</span>
              <span>UPDATED: {selectedTicket.updated_at}</span>
              <TicketStatusBadge status={selectedTicket.status} />
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.3em] text-muted-foreground">ACTIONS</p>
                <h2 className="mt-1 text-sm font-medium text-foreground">EMAIL UPLOAD / NEW NOTE</h2>
              </div>
            </div>
            <EmailDropzone ticketId={id} />
          </div>
        </div>
      </div>

      {/* Emails + Notes unified stack */}
      <div className="space-y-4">
        <EmailList ticketId={id} />
      </div>
    </div>
  );
}
