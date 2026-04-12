'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGenerationStore } from '@/stores/generation-store';

interface WeeklyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  onGenerated: (markdown: string) => Promise<void>;
}

export function WeeklyReportDialog({ open, onOpenChange, ticketId, onGenerated }: WeeklyReportDialogProps) {
  const { templates, generating, fetchAll, generateWeeklyReport } = useGenerationStore();
  const templateList = templates.weekly_report;
  const [templateId, setTemplateId] = useState('');
  const [rangeDays, setRangeDays] = useState('7');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetchAll('weekly_report');
  }, [open, fetchAll]);

  useEffect(() => {
    if (!open) return;
    if (templateList.length > 0 && !templateId) {
      setTemplateId(templateList[0].id);
    }
  }, [open, templateList, templateId]);

  const rangeValue = useMemo(() => {
    const parsed = Number(rangeDays);
    if (Number.isNaN(parsed)) return 7;
    return Math.max(1, Math.min(90, parsed));
  }, [rangeDays]);

  const handleGenerate = async () => {
    setError(null);
    try {
      const markdown = await generateWeeklyReport(ticketId, templateId || undefined, rangeValue);
      await onGenerated(markdown);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '주간보고 생성 실패');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>주간보고 생성</DialogTitle>
          <DialogDescription>템플릿과 기간을 선택해 AI 주간보고를 생성합니다.</DialogDescription>
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
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">조회 기간(일)</label>
            <Input value={rangeDays} onChange={(e) => setRangeDays(e.target.value)} className="bg-background border-border" />
          </div>
          {error && <div className="text-xs text-accent-red">{error}</div>}
          <div className="flex justify-end gap-2">
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

