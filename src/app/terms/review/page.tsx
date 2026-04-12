'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FactDetailPanel } from '@/components/terms/fact-detail-panel';
import { StatusChip } from '@/components/terms/status-chip';
import { Button } from '@/components/ui/button';
import type { TermsBoardCardDetail, TermsReviewProcessingItem, TermsReviewTransferItem } from '@/types/terms';
import { getReviewStatusTone, getTermsServiceLabel, getTransferStatusTone } from '@/lib/terms-labels';
import { useTermsFactStore } from '@/stores/terms-fact-store';

type ReviewItem = TermsReviewProcessingItem | TermsReviewTransferItem;

export default function TermsReviewPage() {
  const { review, error, loading, actionLoading, fetchReview, approveFact, rejectFact, clearError } = useTermsFactStore();
  const [activeItem, setActiveItem] = useState<ReviewItem | null>(null);
  const [activeKind, setActiveKind] = useState<'processing' | 'transfer' | null>(null);
  const location = useLocation();
  const marketEntity = new URLSearchParams(location.search).get('market_entity');

  useEffect(() => {
    void fetchReview(marketEntity ?? null).catch(() => null);
  }, [fetchReview, marketEntity]);

  const detail = useMemo<TermsBoardCardDetail | null>(() => {
    if (!activeItem || !activeKind) {
      return null;
    }

    if (activeKind === 'processing') {
      const item = activeItem as TermsReviewProcessingItem;
      return {
        id: item.id,
        kind: 'processing',
        taxonomy_code: item.taxonomy_code,
        display_label: item.display_label ?? item.taxonomy_code,
        condition: item.condition ?? null,
        transfer_status: null,
        review_status: item.review_status,
        evidence_count: item.evidence.length,
        service_family: item.service_family,
        latest_version_id: item.latest_version_id ?? null,
        market_entity: item.market_entity,
        controller_entity: item.controller_entity ?? null,
        destination_country: null,
        recipient_entity: null,
        transfer_mechanism: null,
        legal_basis: null,
        confidence: item.confidence ?? null,
        reviewer: item.reviewer ?? null,
        reviewed_at: item.reviewed_at ?? null,
        evidence: item.evidence,
        diff: item.diff ?? null,
      };
    }

    const item = activeItem as TermsReviewTransferItem;
    return {
      id: item.id,
      kind: 'transfer',
      taxonomy_code: item.data_taxonomy_code ?? item.purpose_taxonomy_code ?? item.destination_country,
      display_label: [item.destination_country, item.recipient_entity, item.purpose_taxonomy_code].filter(Boolean).join(' / '),
      condition: item.condition ?? null,
      transfer_status: item.status,
      review_status: item.review_status,
      evidence_count: item.evidence.length,
      service_family: item.service_family,
      latest_version_id: item.latest_version_id ?? null,
      market_entity: item.market_entity,
      controller_entity: item.controller_entity ?? null,
      destination_country: item.destination_country,
      recipient_entity: item.recipient_entity ?? null,
      transfer_mechanism: item.transfer_mechanism ?? null,
      legal_basis: item.legal_basis ?? null,
      confidence: item.confidence ?? null,
      reviewer: item.reviewer ?? null,
      reviewed_at: item.reviewed_at ?? null,
      evidence: item.evidence,
      diff: item.diff ?? null,
    };
  }, [activeItem, activeKind]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>닫기</Button>
        </div>
      )}

      <section className="rounded-2xl border bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.2em] text-primary">REVIEW</div>
            <h2 className="mt-2 text-xl font-medium text-foreground">
              승인 대기 facts{marketEntity ? ` · ${marketEntity}` : ''}
            </h2>
          </div>
          <Button variant="outline" onClick={() => void fetchReview(marketEntity ?? null).catch(() => null)} disabled={loading || actionLoading}>
            새로고침
          </Button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReviewColumn
          title="Processing Facts"
          kind="processing"
          items={review?.processing ?? []}
          loading={loading}
          actionLoading={actionLoading}
          onApprove={(id) => void approveFact('processing', id).catch(() => null)}
          onReject={(id) => void rejectFact('processing', id).catch(() => null)}
          onOpen={(item) => {
            setActiveKind('processing');
            setActiveItem(item);
          }}
        />
        <ReviewColumn
          title="Transfer Facts"
          kind="transfer"
          items={review?.transfer ?? []}
          loading={loading}
          actionLoading={actionLoading}
          onApprove={(id) => void approveFact('transfer', id).catch(() => null)}
          onReject={(id) => void rejectFact('transfer', id).catch(() => null)}
          onOpen={(item) => {
            setActiveKind('transfer');
            setActiveItem(item);
          }}
        />
      </div>

      <FactDetailPanel
        open={Boolean(activeItem)}
        detail={detail}
        onClose={() => {
          setActiveItem(null);
          setActiveKind(null);
        }}
        actions={detail ? (
          <>
            <Button onClick={() => void approveFact(detail.kind, detail.id).catch(() => null)} disabled={actionLoading}>
              승인
            </Button>
            <Button variant="outline" onClick={() => void rejectFact(detail.kind, detail.id).catch(() => null)} disabled={actionLoading}>
              반려
            </Button>
          </>
        ) : null}
      />
    </div>
  );
}

function ReviewColumn({
  title,
  kind,
  items,
  loading,
  actionLoading,
  onApprove,
  onReject,
  onOpen,
}: {
  title: string;
  kind: 'processing' | 'transfer';
  items: ReviewItem[];
  loading: boolean;
  actionLoading: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onOpen: (item: ReviewItem) => void;
}) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{items.length} items</div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const transferStatus = kind === 'transfer' ? (item as TermsReviewTransferItem).status : null;
          const label = kind === 'processing'
            ? (item as TermsReviewProcessingItem).display_label ?? (item as TermsReviewProcessingItem).taxonomy_code
            : [(item as TermsReviewTransferItem).destination_country, (item as TermsReviewTransferItem).recipient_entity].filter(Boolean).join(' / ');

          return (
            <div key={`${kind}-${item.id}`} className="rounded-xl border bg-slate-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" className="min-w-0 text-left" onClick={() => onOpen(item)}>
                  <div className="text-sm font-medium text-slate-900">{label}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.market_entity}
                    {item.controller_entity ? ` / ${item.controller_entity}` : ''}
                  </div>
                </button>
                <StatusChip className={getReviewStatusTone(item.review_status)}>{item.review_status}</StatusChip>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <StatusChip className="border-slate-200 bg-white text-slate-600">
                  {getTermsServiceLabel(item.service_family)}
                </StatusChip>
                {transferStatus && (
                  <StatusChip className={getTransferStatusTone(transferStatus)}>{transferStatus}</StatusChip>
                )}
                <StatusChip className="border-slate-200 bg-white text-slate-600">Evidence {item.evidence.length}</StatusChip>
                {item.manual_entry ? (
                  <StatusChip className="border-sky-200 bg-sky-50 text-sky-700">수동</StatusChip>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onApprove(item.id)} disabled={actionLoading}>승인</Button>
                <Button size="sm" variant="outline" onClick={() => onReject(item.id)} disabled={actionLoading}>반려</Button>
                <Button size="sm" variant="ghost" onClick={() => onOpen(item)}>상세</Button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {loading ? '로딩 중...' : '대기 항목이 없습니다.'}
          </div>
        )}
      </div>
    </section>
  );
}
