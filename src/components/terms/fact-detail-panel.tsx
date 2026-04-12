'use client';

import type { ReactNode } from 'react';
import { SlidePanel } from '@/components/ui/slide-panel';
import { TermsDiffView } from '@/components/terms/terms-diff-view';
import { StatusChip } from '@/components/terms/status-chip';
import type { TermsBoardCardDetail } from '@/types/terms';
import { getTransferStatusTone } from '@/lib/terms-labels';

interface FactDetailPanelProps {
  detail: TermsBoardCardDetail | null;
  open: boolean;
  onClose: () => void;
  actions?: ReactNode;
}

export function FactDetailPanel({ detail, open, onClose, actions }: FactDetailPanelProps) {
  return (
    <SlidePanel open={open} onClose={onClose} width="min(780px, 88vw)">
      {!detail ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          세부 정보를 선택하세요.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3 rounded-2xl border bg-white px-5 py-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-medium text-foreground">{detail.display_label}</h3>
                  {detail.manual_entry && (
                    <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                      수동 입력
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.market_entity}
                  {detail.controller_entity ? ` / ${detail.controller_entity}` : ''}
                </p>
              </div>
              {detail.transfer_status && (
                <StatusChip className={getTransferStatusTone(detail.transfer_status)}>
                  {detail.transfer_status}
                </StatusChip>
              )}
            </div>

            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>

          <section className="rounded-2xl border bg-white px-5 py-5 shadow-sm">
            <div className="mb-3 text-xs tracking-[0.2em] text-muted-foreground">EVIDENCE</div>
            <div className="space-y-3">
              {detail.evidence.map((item) => (
                <article key={item.clause_id} className="rounded-xl border bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-900">
                      Clause #{item.order_index}
                      {item.heading ? ` / ${item.heading}` : ''}
                    </div>
                    {item.path && <div className="text-[11px] text-slate-500">{item.path}</div>}
                  </div>
                  {item.excerpt && <p className="mt-2 text-sm text-slate-700">{item.excerpt}</p>}
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white px-3 py-3 text-[12px] leading-6 text-slate-600">
                    {item.body}
                  </pre>
                </article>
              ))}
              {detail.evidence.length === 0 && (
                <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {detail.manual_entry ? '수동으로 입력된 항목입니다. 원문 근거는 없습니다.' : '연결된 evidence가 없습니다.'}
                </div>
              )}
            </div>
          </section>

          {!detail.manual_entry && (
            <section className="rounded-2xl border bg-white px-5 py-5 shadow-sm">
              <div className="mb-3 text-xs tracking-[0.2em] text-muted-foreground">VERSION DIFF</div>
              <TermsDiffView diff={detail.diff} />
            </section>
          )}
        </div>
      )}
    </SlidePanel>
  );
}

