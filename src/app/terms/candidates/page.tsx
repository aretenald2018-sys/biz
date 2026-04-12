'use client';

import { useEffect, useState } from 'react';
import { StatusChip } from '@/components/terms/status-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTermsAssetStore } from '@/stores/terms-asset-store';

export default function TermsCandidatesPage() {
  const {
    candidates,
    error,
    loading,
    actionLoading,
    fetchCandidates,
    promoteCandidate,
    rejectCandidate,
    discoverCandidates,
    clearError,
  } = useTermsAssetStore();
  const [status, setStatus] = useState('pending');
  const [reviewer, setReviewer] = useState('');

  useEffect(() => {
    void fetchCandidates(status).catch(() => null);
  }, [fetchCandidates, status]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>닫기</Button>
        </div>
      )}

      <section className="rounded-2xl border bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs tracking-[0.2em] text-primary">CANDIDATES</div>
            <h2 className="mt-2 text-xl font-medium text-foreground">발견된 신규 링크</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-9 rounded-lg border bg-white px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {['pending', 'promoted', 'rejected', 'duplicate'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <Input
              className="w-[180px]"
              placeholder="reviewer"
              value={reviewer}
              onChange={(event) => setReviewer(event.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => {
                void discoverCandidates()
                  .then(() => fetchCandidates(status))
                  .catch(() => null);
              }}
              disabled={actionLoading}
            >
              전체 Discovery
            </Button>
            <Button variant="outline" onClick={() => void fetchCandidates(status).catch(() => null)} disabled={loading}>
              새로고침
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {candidates.map((candidate) => (
          <article key={candidate.id} className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-foreground">{candidate.anchor_text || 'Untitled candidate'}</div>
                  <StatusChip className="border-slate-200 bg-slate-100 text-slate-700">{candidate.status}</StatusChip>
                </div>
                <div className="mt-2 truncate text-sm text-slate-600">{candidate.candidate_url}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {candidate.hint_market_entity && <span>{candidate.hint_market_entity}</span>}
                  {candidate.hint_service_family && <span>{candidate.hint_service_family}</span>}
                  {candidate.hint_document_type && <span>{candidate.hint_document_type}</span>}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">{candidate.source_url}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    void promoteCandidate(candidate.id, { reviewer })
                      .then(() => fetchCandidates(status))
                      .catch(() => null);
                  }}
                  disabled={actionLoading || candidate.status !== 'pending'}
                >
                  Promote
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void rejectCandidate(candidate.id, 'manual_reject', reviewer)
                      .then(() => fetchCandidates(status))
                      .catch(() => null);
                  }}
                  disabled={actionLoading || candidate.status !== 'pending'}
                >
                  Reject
                </Button>
              </div>
            </div>
          </article>
        ))}

        {candidates.length === 0 && (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {loading ? '로딩 중...' : '조건에 맞는 candidate가 없습니다.'}
          </div>
        )}
      </section>
    </div>
  );
}
