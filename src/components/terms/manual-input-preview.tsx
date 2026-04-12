'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ManualInputPreviewProps {
  open: boolean;
  versionId: number;
  onCancel: () => void;
  onCommitted: () => void;
}

interface ProcessingFactRow {
  id: number;
  category: 'collectible_data' | 'collection_purpose' | 'transfer_purpose';
  display_label?: string | null;
  taxonomy_code: string;
  service_family: string;
  confidence: number | null;
  condition?: string | null;
}

interface TransferFactRow {
  id: number;
  status: 'allowed' | 'conditional' | 'unclear' | 'not_allowed';
  destination_country: string;
  service_family: string;
  display_label?: string | null;
  recipient_entity?: string | null;
  purpose_taxonomy_code?: string | null;
  data_taxonomy_code?: string | null;
  confidence: number | null;
  condition?: string | null;
}

interface SelectionState {
  checked: boolean;
  display_label: string;
  status?: TransferFactRow['status'];
}

const COLUMNS: Array<{ key: 'collectible_data' | 'collection_purpose' | 'transfer_purpose' | 'korea_transfer'; label: string }> = [
  { key: 'collectible_data', label: '수집 가능 데이터' },
  { key: 'collection_purpose', label: '수집 목적' },
  { key: 'transfer_purpose', label: '제3자 이전 목적' },
  { key: 'korea_transfer', label: '한국 이전' },
];

function labelFor(fact: ProcessingFactRow | TransferFactRow, kind: 'processing' | 'transfer') {
  if (kind === 'processing') {
    const f = fact as ProcessingFactRow;
    return f.display_label || f.taxonomy_code;
  }
  const f = fact as TransferFactRow;
  if (f.display_label) return f.display_label;
  const parts = [f.destination_country, f.recipient_entity, f.purpose_taxonomy_code].filter(Boolean);
  return parts.join(' / ') || 'transfer';
}

export function ManualInputPreview({ open, versionId, onCancel, onCommitted }: ManualInputPreviewProps) {
  const [processing, setProcessing] = useState<ProcessingFactRow[]>([]);
  const [transfer, setTransfer] = useState<TransferFactRow[]>([]);
  const [proSel, setProSel] = useState<Record<number, SelectionState>>({});
  const [tfSel, setTfSel] = useState<Record<number, SelectionState>>({});
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/terms/facts/by-version/${versionId}`);
        if (!res.ok) throw new Error('미리보기 데이터를 불러오지 못했습니다.');
        const data = (await res.json()) as { processing: ProcessingFactRow[]; transfer: TransferFactRow[] };
        setProcessing(data.processing);
        setTransfer(data.transfer);

        const p: Record<number, SelectionState> = {};
        for (const f of data.processing) {
          p[f.id] = { checked: true, display_label: labelFor(f, 'processing') };
        }
        setProSel(p);
        const t: Record<number, SelectionState> = {};
        for (const f of data.transfer) {
          t[f.id] = { checked: true, display_label: labelFor(f, 'transfer'), status: f.status };
        }
        setTfSel(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류');
      } finally {
        setLoading(false);
      }
    })();
  }, [versionId]);

  const handleCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      const approvals: Array<{ kind: 'processing' | 'transfer'; id: number; display_label?: string; status?: string }> = [];
      for (const f of processing) {
        const s = proSel[f.id];
        if (s?.checked) approvals.push({ kind: 'processing', id: f.id, display_label: s.display_label });
      }
      for (const f of transfer) {
        const s = tfSel[f.id];
        if (s?.checked) approvals.push({ kind: 'transfer', id: f.id, display_label: s.display_label, status: s.status });
      }
      const res = await fetch('/api/terms/facts/commit-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId, approvals }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || '저장 실패');
      }
      onCommitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setCommitting(false);
    }
  };

  const byColumn = {
    collectible_data: processing.filter((f) => f.category === 'collectible_data'),
    collection_purpose: processing.filter((f) => f.category === 'collection_purpose'),
    transfer_purpose: processing.filter((f) => f.category === 'transfer_purpose'),
    korea_transfer: transfer.filter((f) => f.destination_country === 'KR'),
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>분석 결과 미리보기</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              체크를 해제하면 저장 시 제외되고, 라벨은 직접 수정할 수 있습니다. 확인을 누르면 선택된 항목만 보드에 반영됩니다.
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {COLUMNS.map((col) => {
                const items = byColumn[col.key];
                const isKorea = col.key === 'korea_transfer';
                return (
                  <div key={col.key} className="rounded-xl border bg-white p-3">
                    <div className="mb-2 flex items-baseline justify-between">
                      <div className="text-sm font-medium text-foreground">{col.label}</div>
                      <div className="text-xs text-muted-foreground">{items.length}</div>
                    </div>
                    <div className="space-y-2">
                      {items.map((fact) => {
                        const kind: 'processing' | 'transfer' = isKorea ? 'transfer' : 'processing';
                        const sel = isKorea ? tfSel[fact.id] : proSel[fact.id];
                        if (!sel) return null;
                        const toggle = () => {
                          if (isKorea) setTfSel({ ...tfSel, [fact.id]: { ...sel, checked: !sel.checked } });
                          else setProSel({ ...proSel, [fact.id]: { ...sel, checked: !sel.checked } });
                        };
                        const setLabel = (v: string) => {
                          if (isKorea) setTfSel({ ...tfSel, [fact.id]: { ...sel, display_label: v } });
                          else setProSel({ ...proSel, [fact.id]: { ...sel, display_label: v } });
                        };
                        void kind;
                        return (
                          <div
                            key={fact.id}
                            className={cn(
                              'rounded-lg border px-3 py-2',
                              sel.checked ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white opacity-50',
                            )}
                          >
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={sel.checked}
                                onChange={toggle}
                                className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                              />
                              <input
                                type="text"
                                value={sel.display_label}
                                onChange={(e) => setLabel(e.target.value)}
                                disabled={!sel.checked}
                                className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs focus:border-primary focus:bg-white focus:outline-none disabled:cursor-not-allowed"
                              />
                            </label>
                            <div className="mt-1 pl-6 text-[10px] text-slate-500">
                              {fact.service_family}
                              {isKorea ? ` · ${(fact as TransferFactRow).status}` : ''}
                              {fact.confidence != null && ` · ${Math.round(fact.confidence * 100)}%`}
                            </div>
                          </div>
                        );
                      })}
                      {items.length === 0 && (
                        <div className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground">
                          추출된 항목 없음
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onCancel} disabled={committing}>
                취소
              </Button>
              <Button onClick={() => void handleCommit()} disabled={committing}>
                {committing ? '저장 중…' : '확인'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
