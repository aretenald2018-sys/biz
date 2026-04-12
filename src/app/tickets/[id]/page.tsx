'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTicketStore } from '@/stores/ticket-store';
import { useEmailStore } from '@/stores/email-store';
import { useEmailFlowStore } from '@/stores/email-flow-store';
import { useNoteStore } from '@/stores/note-store';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { EmailList } from '@/components/email/email-list';
import { FileKanbanBoard } from '@/components/ticket-file-kanban/file-kanban-board';
// NoteEditor is now integrated into EmailList
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
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
import type { KanbanCategory } from '@/types/kanban';
import type { TicketStatus } from '@/types/ticket';

const statuses: TicketStatus[] = ['신규', '진행중', '검토중', '종결', '보류'];

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { selectedTicket, fetchTicket, updateTicket, updateTicketCategory, deleteTicket, clearSelectedTicket } = useTicketStore();
  const uploadEmail = useEmailStore((state) => state.uploadEmail);
  const clearFlowSteps = useEmailFlowStore((state) => state.clearFlowSteps);
  const createNote = useNoteStore((state) => state.createNote);
  const [categories, setCategories] = useState<KanbanCategory[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pageFileDragging, setPageFileDragging] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [pendingExpandNoteId, setPendingExpandNoteId] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  // notesPinned removed — notes now in unified stack

  const isFileDrag = (e: React.DragEvent | DragEvent) => {
    const types = Array.from((e.dataTransfer?.types || []) as unknown as string[]);
    return types.includes('Files');
  };

  const handlePageDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setPageFileDragging(true);
  }, []);

  const handlePageDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setPageFileDragging(true);
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setPageFileDragging(false);
    }
  }, []);

  const handlePageDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setPageFileDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.toLowerCase().endsWith('.msg') || file.name.toLowerCase().endsWith('.eml')
    );

    if (files.length === 0) return;

    try {
      for (const file of files) {
        await uploadEmail(id, file);
      }
    } catch (error) {
      console.error('Failed to upload dropped email files:', error);
    }
  }, [id, uploadEmail]);

  useEffect(() => {
    fetchTicket(id);
  }, [id, fetchTicket]);

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      const res = await fetch('/api/kanban/categories');
      if (!res.ok || cancelled) return;
      const nextCategories = await res.json();
      if (!cancelled) {
        setCategories(nextCategories);
      }
    };

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (!pageFileDragging) return;
    const timeoutId = window.setTimeout(() => {
      dragDepthRef.current = 0;
      setPageFileDragging(false);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [pageFileDragging]);

  if (!selectedTicket) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-neon-cyan neon-pulse text-sm tracking-widest">
          LOADING TICKET DATA...
        </div>
      </div>
    );
  }

  const currentCategory = categories.find((category) => category.id === selectedTicket.category_id);

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

  const handleFabCreateNote = async () => {
    const note = await createNote(id, 'New Note');
    if (note?.id) {
      setPendingExpandNoteId(note.id);
    }
    setFabOpen(false);
  };

  return (
    <div
      className="space-y-6 relative"
      onDragEnter={handlePageDragEnter}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {pageFileDragging && (
        <div
          className="fixed inset-0 z-50 pointer-events-auto"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handlePageDrop}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
          <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-neon-cyan/70 bg-neon-cyan/10 flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm font-semibold text-neon-cyan tracking-widest">DROP EMAIL FILES HERE</div>
              <div className="mt-2 text-xs text-muted-foreground">.msg / .eml 파일을 놓으면 바로 업로드됩니다</div>
            </div>
          </div>
        </div>
      )}
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
      <div className="glass rounded-lg p-4 border border-border">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-3">
            {editing ? (
              <div className="space-y-2.5">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white/5 border-border text-base font-semibold"
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
              <div className="space-y-2">
                <h1
                  className="text-base font-semibold text-foreground cursor-pointer hover:text-neon-cyan transition-colors"
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

            <div className="flex flex-wrap items-center gap-2 pt-1">
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

              <Select value={selectedTicket.category_id || ''} onValueChange={(value) => { if (typeof value === 'string' && value) updateTicketCategory(id, value); }}>
                <SelectTrigger className="w-40 bg-white/5 border-border text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="glass border-border">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-xs">
                      {category.name}
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

            <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground tracking-wider">
              <span>CATEGORY: {currentCategory?.name || 'UNKNOWN'}</span>
              <span>CREATED: {selectedTicket.created_at}</span>
              <span>UPDATED: {selectedTicket.updated_at}</span>
              <TicketStatusBadge status={selectedTicket.status} />
            </div>
          </div>
          <div className="h-full max-h-[340px] overflow-hidden rounded-lg border border-border/70 bg-background/30">
            <FileKanbanBoard ticketId={id} embedded />
          </div>
        </div>
      </div>

      {/* Emails + Notes unified stack */}
      <div className="space-y-4">
        <EmailList
          ticketId={id}
          pendingExpandNoteId={pendingExpandNoteId}
          onExpandedPendingNote={() => setPendingExpandNoteId(null)}
        />
      </div>

      <div className="fixed bottom-6 right-6 z-30">
        {fabOpen && (
          <div className="mb-3 min-w-[180px] rounded-xl border border-white/30 bg-white/10 p-2 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={handleFabCreateNote}
              className="w-full rounded-md px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-white/20"
            >
              노트 생성
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setFabOpen((prev) => !prev)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#002C5F] text-white shadow-lg transition-transform hover:scale-[1.03]"
          aria-label="Open quick actions"
        >
          <Plus className={`h-5 w-5 transition-transform ${fabOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>
    </div>
  );
}
