'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { KanbanCategory } from '@/types/kanban';
import type { Ticket } from '@/types/ticket';

interface KanbanCardFormProps {
  open: boolean;
  categories: KanbanCategory[];
  initialCategoryId: string;
  ticket?: Ticket | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { category_id: string; title: string; description?: string | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function KanbanCardForm({
  open,
  categories,
  initialCategoryId,
  ticket,
  onOpenChange,
  onSubmit,
  onDelete,
}: KanbanCardFormProps) {
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setCategoryId(ticket?.category_id || initialCategoryId || categories[0]?.id || '');
    setTitle(ticket?.title || '');
    setDescription(ticket?.description || '');
  }, [open, ticket, initialCategoryId, categories]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !categoryId) return;

    setSaving(true);
    try {
      await onSubmit({
        category_id: categoryId,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle>{ticket ? 'Edit Ticket Card' : 'New Ticket Card'}</DialogTitle>
          <DialogDescription>Cards now write directly to tickets. Choose a category and save once.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Category</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="" disabled>Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Title</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} className="border-border bg-background" autoFocus />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="resize-none border-border bg-background"
            />
          </div>
          <div className="flex justify-between">
            <div>
              {onDelete && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !categoryId}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
