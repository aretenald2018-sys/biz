'use client';

import type { TermsDocumentDiff } from '@/types/terms';
import { cn } from '@/lib/utils';

interface TermsDiffViewProps {
  diff: TermsDocumentDiff | null | undefined;
  className?: string;
}

export function TermsDiffView({ diff, className }: TermsDiffViewProps) {
  if (!diff || diff.segments.length === 0) {
    return (
      <div className={cn('rounded-xl border bg-card px-4 py-4 text-sm text-muted-foreground', className)}>
        비교 가능한 이전 버전이 없습니다.
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>DIFF</span>
        <span>{diff.prev_id ? `PREV #${diff.prev_id} -> NOW #${diff.version_id}` : `#${diff.version_id}`}</span>
      </div>
      <div className="max-h-[360px] overflow-y-auto rounded-lg bg-slate-50 px-3 py-3 font-mono text-[12px] leading-6 text-slate-700">
        {diff.segments.map((segment, index) => (
          <span
            key={`${segment.kind}-${index}`}
            className={cn(
              'whitespace-pre-wrap',
              segment.kind === 'insert' && 'bg-emerald-100 text-emerald-900',
              segment.kind === 'delete' && 'bg-rose-100 text-rose-900 line-through',
            )}
          >
            {segment.text}
          </span>
        ))}
      </div>
    </div>
  );
}
