'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { TicketFileKanbanCategory } from '@/types/ticket-file-kanban';

interface FileKanbanCategoryFormProps {
  open: boolean;
  category?: TicketFileKanbanCategory | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { name: string; color: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function FileKanbanCategoryForm({
  open,
  category,
  onOpenChange,
  onSubmit,
  onDelete,
}: FileKanbanCategoryFormProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#00AAD2');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name || '');
    setColor(category?.color || '#00AAD2');
  }, [open, category]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), color });
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
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle>{category ? '카테고리 수정' : '카테고리 추가'}</DialogTitle>
          <DialogDescription>파일 칸반의 컬럼 이름과 색상을 설정합니다.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">이름</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="bg-background border-border" autoFocus />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">색상</label>
            <Input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 bg-background border-border" />
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
