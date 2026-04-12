'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  TicketFileKanbanCard,
  TicketFileKanbanCategory,
} from '@/types/ticket-file-kanban';

interface FileKanbanCardFormProps {
  open: boolean;
  categories: TicketFileKanbanCategory[];
  categoryId: string;
  card?: TicketFileKanbanCard | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { category_id: string; file_name: string; description?: string | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function FileKanbanCardForm({
  open,
  categories,
  categoryId,
  card,
  onOpenChange,
  onSubmit,
  onDelete,
}: FileKanbanCardFormProps) {
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFileName(card?.file_name || '');
    setDescription(card?.description || '');
    setSelectedCategoryId(card?.category_id || categoryId || categories[0]?.id || '');
  }, [open, card, categoryId, categories]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fileName.trim() || !selectedCategoryId) return;

    setSaving(true);
    try {
      await onSubmit({
        category_id: selectedCategoryId,
        file_name: fileName.trim(),
        description: description.trim() || null,
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
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>{card ? '파일 카드 수정' : '파일 카드 추가'}</DialogTitle>
          <DialogDescription>파일명, 설명, 배치할 컬럼을 설정합니다.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">컬럼</label>
            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="">컬럼 선택</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">파일명</label>
            <Input
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              className="bg-background border-border"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">설명</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="bg-background border-border resize-none"
            />
          </div>
          <div className="flex justify-between">
            <div>
              {onDelete && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
                  삭제
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                저장
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
