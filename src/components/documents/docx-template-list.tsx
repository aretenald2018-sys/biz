'use client';

import { CheckCircle2, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocxTemplateSummary } from '@/types/document';
import { cn } from '@/lib/utils';

interface DocxTemplateListProps {
  templates: DocxTemplateSummary[];
  activeId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DocxTemplateList({
  templates,
  activeId,
  loading = false,
  onSelect,
  onDelete,
}: DocxTemplateListProps) {
  if (loading && templates.length === 0) {
    return (
      <div className="rounded-xl border bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">
        보관된 양식을 불러오는 중입니다…
      </div>
    );
  }

  if (!loading && templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        아직 보관된 양식이 없어요. 왼쪽에 워드 파일을 올려서 시작하세요.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => {
        const isActive = template.id === activeId;

        return (
          <button
            key={template.id}
            type="button"
            className={cn(
              'group relative flex h-full flex-col rounded-xl border px-4 py-3 text-left transition-colors',
              isActive
                ? 'border-primary/40 bg-secondary/80 shadow-sm'
                : 'bg-white hover:border-primary/20 hover:bg-secondary/50',
            )}
            onClick={() => onSelect(template.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <FileText className={cn('mt-0.5 h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {template.display_name || template.filename}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{template.filename}</div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isActive && <CheckCircle2 className="h-4 w-4 text-primary" />}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(template.id);
                  }}
                  aria-label="양식 삭제"
                  title="이 양식 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-muted-foreground">최근 수정 · {template.updated_at}</div>
          </button>
        );
      })}
    </div>
  );
}
