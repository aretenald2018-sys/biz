'use client';

import { useEffect, useMemo, useState } from 'react';
import { FactDetailPanel } from '@/components/terms/fact-detail-panel';
import { useTermsFactStore } from '@/stores/terms-fact-store';
import { cn } from '@/lib/utils';
import type { TermsBoardCard } from '@/types/terms';

type ColumnKey = 'collectible_data' | 'collection_purpose' | 'transfer_purpose' | 'korea_transfer';

const columnMeta: { key: ColumnKey; label: string }[] = [
  { key: 'collectible_data', label: '수집 가능 데이터' },
  { key: 'collection_purpose', label: '수집 목적' },
  { key: 'transfer_purpose', label: '제3자 이전 목적' },
  { key: 'korea_transfer', label: '한국 이전' },
];

interface BoardViewProps {
  marketEntity: string | null;
  filterBy: 'service_family' | 'document_type' | 'asset_url';
  selectedKeys: string[];
}

function cardMatches(card: TermsBoardCard, mode: BoardViewProps['filterBy'], selected: string[]) {
  if (selected.length === 0) return true;
  if (mode === 'service_family') return selected.includes(card.service_family);
  if (mode === 'document_type') return !!card.source_document_type && selected.includes(card.source_document_type);
  return !!card.source_asset_url && selected.includes(card.source_asset_url);
}

export function BoardView({ marketEntity, filterBy, selectedKeys }: BoardViewProps) {
  const { board, loading, fetchBoard } = useTermsFactStore();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [addFormColumn, setAddFormColumn] = useState<ColumnKey | null>(null);
  const [editing, setEditing] = useState<{ kind: 'processing' | 'transfer'; id: number; display_label: string } | null>(null);

  useEffect(() => {
    void fetchBoard(marketEntity ?? null).catch(() => null);
  }, [fetchBoard, marketEntity]);

  const detail = activeKey && board ? board.details[activeKey] : null;

  const filteredColumns = useMemo(() => {
    const result: Record<string, TermsBoardCard[]> = {
      collectible_data: [],
      collection_purpose: [],
      transfer_purpose: [],
      korea_transfer: [],
    };
    if (!board) return result;
    for (const meta of columnMeta) {
      result[meta.key] = (board.columns[meta.key] ?? []).filter((c) => cardMatches(c, filterBy, selectedKeys));
    }
    return result;
  }, [board, filterBy, selectedKeys]);

  const refresh = () => fetchBoard(marketEntity ?? null).catch(() => null);

  const handleDelete = async (card: TermsBoardCard) => {
    if (!window.confirm('이 항목을 삭제할까요?')) return;
    await fetch(`/api/terms/facts/${card.kind}/${card.id}`, { method: 'DELETE' });
    void refresh();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    await fetch(`/api/terms/facts/${editing.kind}/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_label: editing.display_label }),
    });
    setEditing(null);
    void refresh();
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-4">
        {columnMeta.map((column) => {
          const cards = filteredColumns[column.key] ?? [];
          return (
            <div key={column.key} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div className="text-sm font-medium text-foreground">{column.label}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">{cards.length}</div>
                  {marketEntity && (
                    <button
                      type="button"
                      onClick={() => setAddFormColumn(column.key)}
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 hover:border-primary/40 hover:text-primary"
                      title="수동 추가"
                    >
                      + 추가
                    </button>
                  )}
                </div>
              </div>

              {addFormColumn === column.key && marketEntity && (
                <AddFactForm
                  column={column.key}
                  marketEntity={marketEntity}
                  onCancel={() => setAddFormColumn(null)}
                  onSaved={() => {
                    setAddFormColumn(null);
                    void refresh();
                  }}
                />
              )}

              <ul className="divide-y">
                {cards.map((card) => {
                  const detailKey = `${card.kind}:${card.id}`;
                  const lowConfidence = !card.manual_entry && card.confidence != null && card.confidence < 0.7;
                  const isManual = card.manual_entry;
                  return (
                    <li key={detailKey} className="group">
                      <div className="flex items-center gap-1 py-2">
                        <button
                          type="button"
                          onClick={() => setActiveKey(detailKey)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-slate-800 transition-colors hover:text-primary"
                        >
                          {lowConfidence && (
                            <span
                              title={`신뢰도 낮음 (${Math.round((card.confidence ?? 0) * 100)}%)`}
                              className="shrink-0 text-amber-500"
                            >
                              ⚠
                            </span>
                          )}
                          {isManual && (
                            <span
                              title="수동 입력"
                              className="shrink-0 rounded border border-sky-200 bg-sky-50 px-1 py-0 text-[9px] font-medium text-sky-700"
                            >
                              수동
                            </span>
                          )}
                          <span className="truncate">{card.display_label}</span>
                        </button>
                        {isManual && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditing({ kind: card.kind, id: card.id, display_label: card.display_label })}
                              className="rounded p-0.5 text-[11px] text-slate-400 opacity-0 hover:text-primary group-hover:opacity-100"
                              title="수정"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(card)}
                              className="rounded p-0.5 text-[11px] text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100"
                              title="삭제"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}

                {cards.length === 0 && addFormColumn !== column.key && (
                  <li className="py-8 text-center text-xs text-muted-foreground">
                    {loading ? '불러오는 중…' : marketEntity ? '표시할 항목이 없습니다.' : '법인을 먼저 선택하세요.'}
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </section>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4"
          onClick={() => setEditing(null)}
        >
          <div
            className={cn('w-full max-w-sm rounded-xl bg-white p-5 shadow-lg')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium text-foreground">항목 이름 수정</div>
            <input
              type="text"
              value={editing.display_label}
              onChange={(e) => setEditing({ ...editing, display_label: e.target.value })}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-primary/40"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <FactDetailPanel
        open={Boolean(activeKey)}
        detail={detail}
        onClose={() => setActiveKey(null)}
      />
    </div>
  );
}

function AddFactForm({
  column,
  marketEntity,
  onCancel,
  onSaved,
}: {
  column: ColumnKey;
  marketEntity: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<'allowed' | 'conditional' | 'unclear' | 'not_allowed'>('allowed');
  const [saving, setSaving] = useState(false);
  const isKorea = column === 'korea_transfer';

  const submit = async () => {
    if (!label.trim()) return;
    setSaving(true);
    await fetch('/api/terms/facts/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market_entity: marketEntity,
        column,
        display_label: label.trim(),
        status: isKorea ? status : undefined,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="mb-3 rounded-lg border border-primary/30 bg-[#F5F7F9] p-3">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={isKorea ? '이전 데이터/목적 이름' : '항목 이름'}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
        autoFocus
      />
      {isKorea && (
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
        >
          <option value="allowed">허용</option>
          <option value="conditional">조건부</option>
          <option value="unclear">불명확</option>
          <option value="not_allowed">불가</option>
        </select>
      )}
      <div className="mt-2 flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-primary/40"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || !label.trim()}
          className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}
