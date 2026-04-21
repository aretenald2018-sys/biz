'use client';

import type { KdpQaLog } from '@/types/kdp';
import { KDP_CATEGORY_LABELS } from '@/types/kdp';

interface Props {
  open: boolean;
  onClose: () => void;
  logs: KdpQaLog[];
  onReplay: (log: KdpQaLog) => void;
  onStar: (id: number, starred: boolean) => void;
  onDelete: (id: number) => void;
}

export function QaHistoryDrawer({ open, onClose, logs, onReplay, onStar, onDelete }: Props) {
  if (!open) return null;

  const starred = logs.filter((l) => l.starred === 1);
  const recent = logs.filter((l) => l.starred !== 1);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: 'rgba(18,20,22,0.32)' }}
      onClick={onClose}
    >
      <div className="flex-1" />
      <div
        className="h-full w-[420px] max-w-[92vw] overflow-y-auto border-l bg-white shadow-xl"
        style={{ borderColor: '#EFEFF0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3" style={{ borderColor: '#EFEFF0' }}>
          <div
            style={{
              fontFamily: 'HyundaiSansHeadKR, HyundaiSansTextKR, sans-serif',
              color: '#002C5F',
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            질문 이력
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm"
            style={{ color: '#535356' }}
          >
            닫기
          </button>
        </div>

        <div className="px-4 py-3">
          {starred.length > 0 && (
            <div className="mb-4">
              <SectionTitle>⭐ 즐겨찾기</SectionTitle>
              <LogList logs={starred} onReplay={onReplay} onStar={onStar} onDelete={onDelete} />
            </div>
          )}
          <SectionTitle>🕘 최근</SectionTitle>
          {recent.length === 0 ? (
            <div className="py-6 text-center text-xs" style={{ color: '#929296' }}>
              아직 질문 이력이 없습니다.
            </div>
          ) : (
            <LogList logs={recent} onReplay={onReplay} onStar={onStar} onDelete={onDelete} />
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2 text-[11px] tracking-[0.16em]"
      style={{ color: '#929296', fontFamily: 'HyundaiSansTextKR, sans-serif' }}
    >
      {children}
    </div>
  );
}

function LogList({
  logs,
  onReplay,
  onStar,
  onDelete,
}: {
  logs: KdpQaLog[];
  onReplay: (log: KdpQaLog) => void;
  onStar: (id: number, starred: boolean) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li
          key={log.id}
          className="rounded-md border p-3"
          style={{ borderColor: '#EFEFF0', background: '#FAFAFB' }}
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="flex-1 text-left"
              onClick={() => onReplay(log)}
              style={{ fontFamily: 'HyundaiSansTextKR, sans-serif' }}
            >
              <div className="text-sm font-medium" style={{ color: '#121416' }}>
                {log.question}
              </div>
              <div className="mt-1 line-clamp-2 text-xs" style={{ color: '#535356', lineHeight: 1.55 }}>
                {log.answer.replace(/\[#\d+\]/g, '')}
              </div>
              <div className="mt-1 flex gap-1 text-[11px]" style={{ color: '#929296' }}>
                <span>{log.created_at}</span>
                {log.category && <span>· {KDP_CATEGORY_LABELS[log.category]}</span>}
                <span>· 근거 {log.citations.length}</span>
              </div>
            </button>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => onStar(log.id, log.starred !== 1)}
                className="rounded-md border px-1.5 py-0.5 text-xs"
                style={{
                  borderColor: log.starred === 1 ? '#EC8E01' : '#EFEFF0',
                  color: log.starred === 1 ? '#EC8E01' : '#929296',
                  background: log.starred === 1 ? '#FFF7E8' : '#FFFFFF',
                }}
                title="즐겨찾기"
              >
                {log.starred === 1 ? '⭐' : '☆'}
              </button>
              <button
                type="button"
                onClick={() => onDelete(log.id)}
                className="rounded-md border px-1.5 py-0.5 text-xs"
                style={{ borderColor: '#EFEFF0', color: '#E81F2C', background: '#FFFFFF' }}
                title="삭제"
              >
                ✕
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
