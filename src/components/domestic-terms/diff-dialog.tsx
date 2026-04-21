'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { KdpBrand, KdpDiffEntry } from '@/types/kdp';

interface Props {
  open: boolean;
  onClose: () => void;
  brand: KdpBrand;
}

export function DiffDialog({ open, onClose, brand }: Props) {
  const [list, setList] = useState<KdpDiffEntry[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [fullDiff, setFullDiff] = useState<string>('');

  const load = useCallback(async () => {
    if (!open) return;
    const res = await fetch(`/api/kdp/diffs/${brand}`);
    const data = (await res.json()) as KdpDiffEntry[];
    setList(Array.isArray(data) ? data : []);
    if (data?.[0]) setSelected(data[0].id);
  }, [brand, open]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selected == null) {
      setFullDiff('');
      return;
    }
    fetch(`/api/kdp/diffs/item/${selected}`)
      .then((r) => r.json())
      .then((d) => setFullDiff(d.full_diff ?? ''))
      .catch(() => setFullDiff(''));
  }, [selected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(18,20,22,0.38)' }}
      onClick={onClose}
    >
      <div
        className="w-[min(1000px,96vw)] max-h-[92vh] overflow-hidden rounded-lg border bg-white shadow-xl"
        style={{ borderColor: '#EFEFF0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: '#EFEFF0' }}>
          <div style={{ fontFamily: 'HyundaiSansHeadKR, HyundaiSansTextKR, sans-serif', color: '#002C5F', fontSize: 16, fontWeight: 500 }}>
            개정 이력 — {brand === 'hyundai' ? '현대' : '기아'}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
        </div>
        <div className="grid grid-cols-[260px_1fr]" style={{ maxHeight: 'calc(92vh - 64px)' }}>
          <div className="overflow-y-auto border-r p-3" style={{ borderColor: '#EFEFF0' }}>
            {list.length === 0 ? (
              <div className="py-10 text-center text-xs" style={{ color: '#929296' }}>
                아직 개정 이력이 없습니다.<br />새로 수집하면 이전 버전과 비교됩니다.
              </div>
            ) : (
              <ul className="space-y-1">
                {list.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(d.id)}
                      className="w-full rounded-md border px-2 py-2 text-left text-xs"
                      style={{
                        borderColor: selected === d.id ? '#002C5F' : '#EFEFF0',
                        background: selected === d.id ? '#F5F7F9' : '#FFFFFF',
                        fontFamily: 'HyundaiSansTextKR, sans-serif',
                      }}
                    >
                      <div style={{ color: '#121416', fontWeight: 500 }}>{d.created_at}</div>
                      <div className="mt-0.5" style={{ color: '#535356' }}>
                        <span style={{ color: '#00809E' }}>+{d.summary.added}</span>{' '}
                        <span style={{ color: '#E81F2C' }}>-{d.summary.removed}</span>{' '}
                        <span style={{ color: '#929296' }}>~{d.summary.changed}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="overflow-y-auto p-4" style={{ background: '#FAFAFB' }}>
            {selected == null ? (
              <div className="text-xs" style={{ color: '#929296' }}>좌측에서 버전을 선택하세요.</div>
            ) : (
              <pre
                className="whitespace-pre-wrap text-[12px] leading-[1.6]"
                style={{ fontFamily: 'Consolas, monospace', color: '#121416' }}
              >
                {fullDiff || '변경사항 없음'}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
