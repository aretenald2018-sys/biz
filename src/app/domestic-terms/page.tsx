'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  KDP_BRANDS,
  KDP_BRAND_LABELS,
  KDP_CATEGORIES,
  KDP_CATEGORY_LABELS,
  type KdpBrand,
  type KdpCategory,
  type KdpChunk,
  type KdpCitation,
  type KdpModal,
  type KdpPolicyDetail,
  type KdpQaLog,
  type KdpSection,
} from '@/types/kdp';
import { BrandTabs } from '@/components/domestic-terms/brand-tabs';
import { QaBar } from '@/components/domestic-terms/qa-bar';
import { CategoryChips } from '@/components/domestic-terms/category-chips';
import { PolicyViewer } from '@/components/domestic-terms/policy-viewer';
import { QaHistoryDrawer } from '@/components/domestic-terms/qa-history-drawer';
import { ImportDialog } from '@/components/domestic-terms/import-dialog';
import { ManualEditDialog } from '@/components/domestic-terms/manual-edit-dialog';
import { DiffDialog } from '@/components/domestic-terms/diff-dialog';

interface PolicyResponse {
  policy: KdpPolicyDetail['policy'] | null;
  sections: KdpSection[];
  modals: KdpModal[];
  chunks: KdpChunk[];
}

const EMPTY_POLICY: PolicyResponse = { policy: null, sections: [], modals: [], chunks: [] };

export default function DomesticTermsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBrand = (searchParams.get('brand') as KdpBrand) || 'hyundai';
  const [brand, setBrand] = useState<KdpBrand>(
    KDP_BRANDS.includes(initialBrand) ? initialBrand : 'hyundai',
  );
  const [category, setCategory] = useState<KdpCategory | null>(
    (searchParams.get('category') as KdpCategory | null) ?? null,
  );
  const [policyData, setPolicyData] = useState<PolicyResponse>(EMPTY_POLICY);
  const [loadingPolicy, setLoadingPolicy] = useState(false);

  const [question, setQuestion] = useState(searchParams.get('q') ?? '');
  const [answer, setAnswer] = useState<string>('');
  const [citations, setCitations] = useState<KdpCitation[]>([]);
  const [currentLogId, setCurrentLogId] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const [logs, setLogs] = useState<KdpQaLog[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const [focusChunkId, setFocusChunkId] = useState<number | null>(
    searchParams.get('focus') ? Number(searchParams.get('focus')) : null,
  );
  const [highlightTick, setHighlightTick] = useState(0);
  const [categoryJumpSeq, setCategoryJumpSeq] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);

  const handleCategoryChange = (next: KdpCategory | null) => {
    setCategory(next);
    setCategoryJumpSeq((n) => n + 1);
  };

  useEffect(() => {
    if (!category) return;
    if (policyData.chunks.length === 0) return;
    const firstMatching =
      policyData.chunks.find((c) => c.category === category) ??
      policyData.sections.find((s) => s.category === category);
    if (firstMatching) {
      const chunkId = 'id' in firstMatching ? firstMatching.id : 0;
      if ('text' in firstMatching && 'heading_level' in firstMatching) {
        // section fallback — try to find any chunk that belongs to this section
        const sectionChunk = policyData.chunks.find((c) => c.section_id === firstMatching.id);
        if (sectionChunk) {
          setFocusChunkId(sectionChunk.id);
          setHighlightTick((t) => t + 1);
          return;
        }
      }
      setFocusChunkId(chunkId);
      setHighlightTick((t) => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, categoryJumpSeq, policyData.chunks.length]);

  const fetchPolicy = useCallback(async () => {
    setLoadingPolicy(true);
    try {
      const res = await fetch(`/api/kdp/policies/${brand}`);
      const data = (await res.json()) as PolicyResponse;
      setPolicyData(data ?? EMPTY_POLICY);
    } catch (err) {
      console.error('[kdp] fetch policy failed', err);
      setPolicyData(EMPTY_POLICY);
    } finally {
      setLoadingPolicy(false);
    }
  }, [brand]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/kdp/qa-logs/${brand}`);
      const data = (await res.json()) as KdpQaLog[];
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    }
  }, [brand]);

  useEffect(() => {
    fetchPolicy();
    fetchLogs();
  }, [fetchPolicy, fetchLogs]);

  // reflect state back to URL for share
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('brand', brand);
    if (category) next.set('category', category);
    else next.delete('category');
    if (question) next.set('q', question);
    else next.delete('q');
    if (focusChunkId) next.set('focus', String(focusChunkId));
    else next.delete('focus');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, category, focusChunkId, question]);

  const handleRefresh = async () => {
    setRefreshMessage('수집 중…');
    try {
      const res = await fetch(`/api/kdp/policies/${brand}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRefreshMessage(`자동 크롤링 실패: ${data?.message ?? res.status}. [수동 업로드]를 사용하세요.`);
        setImportOpen(true);
        return;
      }
      if (data?.policy?.version_hash === policyData.policy?.version_hash) {
        setRefreshMessage('변경 없음(해시 동일).');
      } else {
        setRefreshMessage('업데이트 완료.');
      }
      await fetchPolicy();
    } catch (err) {
      setRefreshMessage(`오류: ${err instanceof Error ? err.message : String(err)}`);
      setImportOpen(true);
    }
  };

  const handleAsk = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setAsking(true);
    setAskError(null);
    setAnswer('');
    setCitations([]);
    setCurrentLogId(null);
    try {
      const res = await fetch('/api/kdp/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, question: trimmed, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAskError(data?.error ?? '답변 생성 실패');
        return;
      }
      setAnswer(data.answer ?? '');
      setCitations(data.citations ?? []);
      setCurrentLogId(data.log_id ?? null);
      fetchLogs();
      if ((data.citations ?? []).length > 0) {
        jumpToChunk((data.citations as KdpCitation[])[0].chunk_id);
      }
    } catch (err) {
      setAskError(err instanceof Error ? err.message : String(err));
    } finally {
      setAsking(false);
    }
  };

  const jumpToChunk = (chunkId: number) => {
    setFocusChunkId(chunkId);
    setHighlightTick((t) => t + 1);
  };

  const handleCitationClick = (chunkId: number) => jumpToChunk(chunkId);

  const handleStar = async (logId: number, starred: boolean) => {
    await fetch(`/api/kdp/qa-logs/${logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred }),
    });
    fetchLogs();
  };

  const handleDeleteLog = async (logId: number) => {
    await fetch(`/api/kdp/qa-logs/${logId}`, { method: 'DELETE' });
    if (currentLogId === logId) {
      setCurrentLogId(null);
    }
    fetchLogs();
  };

  const handleReplayLog = (log: KdpQaLog) => {
    setQuestion(log.question);
    setAnswer(log.answer);
    setCitations(log.citations);
    setCurrentLogId(log.id);
    setCategory(log.category);
    if (log.citations[0]) jumpToChunk(log.citations[0].chunk_id);
    setHistoryOpen(false);
  };

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams();
    params.set('brand', brand);
    if (question) params.set('q', question);
    if (focusChunkId) params.set('focus', String(focusChunkId));
    if (category) params.set('category', category);
    return `${window.location.origin}/domestic-terms?${params.toString()}`;
  }, [brand, question, focusChunkId, category]);

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setRefreshMessage('공유 URL 복사됨');
      setTimeout(() => setRefreshMessage(null), 2000);
    } catch {
      setRefreshMessage(`복사 실패. URL: ${shareUrl}`);
    }
  };

  const currentStarred = useMemo(() => {
    if (!currentLogId) return false;
    return logs.find((l) => l.id === currentLogId)?.starred === 1;
  }, [currentLogId, logs]);

  return (
    <div className="space-y-5">
      <section
        className="rounded-[28px] border bg-white px-7 py-6 shadow-sm"
        style={{ borderColor: '#EFEFF0' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.24em]" style={{ color: '#002C5F' }}>KOREAN PRIVACY POLICY</div>
            <h1
              className="mt-2 text-[26px] font-medium"
              style={{ fontFamily: 'HyundaiSansHeadKR, HyundaiSansTextKR, sans-serif', color: '#121416' }}
            >
              국내약관 — 현대/기아 개인정보처리방침
            </h1>
            <p className="mt-1 max-w-3xl text-sm" style={{ color: '#535356' }}>
              원문과 인라인 모달을 통째로 보관하고, 자연어로 질문하면 근거 조항과 함께 답변을 돌려드립니다.
              답변의 근거칩을 누르면 하단 원문 뷰어가 해당 위치로 이동합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              🕘 이력
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDiffOpen(true)}>
              Δ 개정이력
            </Button>
            <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
              ✎ 수동 편집
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              ⬆ 업로드
            </Button>
            <Button variant="default" size="sm" onClick={handleRefresh}>
              ↻ 새로고침
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <BrandTabs brand={brand} onBrandChange={setBrand} />
          <div className="text-xs" style={{ color: '#929296' }}>
            {policyData.policy ? (
              <>
                수집 {policyData.policy.fetched_at} · 섹션 {policyData.sections.length} · 모달 {policyData.modals.length} · 청크 {policyData.chunks.length} · hash{' '}
                {policyData.policy.version_hash.slice(0, 8)}
              </>
            ) : loadingPolicy ? (
              '불러오는 중…'
            ) : (
              '수집된 정책 없음 — [새로고침] 또는 [업로드]'
            )}
          </div>
        </div>

        {refreshMessage && (
          <div
            className="mt-3 rounded-md border px-3 py-2 text-xs"
            style={{ borderColor: '#EFEFF0', background: '#F5F7F9', color: '#535356' }}
          >
            {refreshMessage}
          </div>
        )}
      </section>

      <section
        className="rounded-[20px] border bg-white px-5 py-4 shadow-sm"
        style={{ borderColor: '#EFEFF0' }}
      >
        <CategoryChips value={category} onChange={handleCategoryChange} />
        <div className="mt-3">
          <QaBar
            question={question}
            onQuestionChange={setQuestion}
            onAsk={handleAsk}
            asking={asking}
            answer={answer}
            citations={citations}
            allChunks={policyData.chunks}
            error={askError}
            onCitationClick={handleCitationClick}
            onCopyShare={copyShareUrl}
            currentLogId={currentLogId}
            currentStarred={currentStarred}
            onToggleStar={(next) => currentLogId && handleStar(currentLogId, next)}
          />
        </div>
      </section>

      <section
        className="rounded-[20px] border bg-white px-6 py-5 shadow-sm"
        style={{ borderColor: '#EFEFF0', minHeight: 520 }}
        ref={viewerRef}
      >
        <PolicyViewer
          sections={policyData.sections}
          modals={policyData.modals}
          chunks={policyData.chunks}
          focusChunkId={focusChunkId}
          highlightTick={highlightTick}
          loading={loadingPolicy}
        />
      </section>

      <QaHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        logs={logs}
        onReplay={handleReplayLog}
        onStar={handleStar}
        onDelete={handleDeleteLog}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        brand={brand}
        onDone={() => {
          setImportOpen(false);
          fetchPolicy();
          setRefreshMessage('업로드 반영 완료.');
        }}
      />

      <ManualEditDialog
        open={manualOpen}
        onClose={() => {
          setManualOpen(false);
          fetchPolicy();
        }}
        brand={brand}
        policy={policyData.policy}
        sections={policyData.sections}
        modals={policyData.modals}
        onReload={fetchPolicy}
      />

      <DiffDialog open={diffOpen} onClose={() => setDiffOpen(false)} brand={brand} />
    </div>
  );
}
