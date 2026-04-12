'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGenerationStore } from '@/stores/generation-store';

interface DoorayReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  onGenerated: (markdown: string) => Promise<void>;
}

export function DoorayReportDialog({ open, onOpenChange, ticketId, onGenerated }: DoorayReportDialogProps) {
  const { templates, generating, fetchAll, generateDoorayReport } = useGenerationStore();
  const templateList = templates.dooray;
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!open) return;
    void fetchAll('dooray');
  }, [open, fetchAll]);

  useEffect(() => {
    if (!open) return;
    if (templateList.length > 0 && !templateId) {
      setTemplateId(templateList[0].id);
    }
  }, [open, templateList, templateId]);

  const handleGenerate = async () => {
    setError(null);
    try {
      const markdown = await generateDoorayReport(ticketId, templateId || undefined, 14);
      setPreview(markdown);
      await onGenerated(markdown);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '두레이 생성 실패');
    }
  };

  const handleCopy = async () => {
    if (!preview.trim()) return;
    try {
      await navigator.clipboard.writeText(preview);
    } catch {
      // Ignore clipboard errors.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>두레이 생성</DialogTitle>
          <DialogDescription>임원 보고용 마크다운 보고서를 생성합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">템플릿</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {templateList.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>
          {error && <div className="text-xs text-accent-red">{error}</div>}
          {preview && (
            <div className="max-h-48 overflow-auto rounded-md border border-border bg-background p-2 text-xs whitespace-pre-wrap">
              {preview}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleCopy} disabled={!preview.trim()}>
              복사
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="button" onClick={handleGenerate} disabled={generating}>
              {generating ? '생성 중...' : '생성'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

