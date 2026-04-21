'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { KdpChunk, KdpCitation } from '@/types/kdp';

interface Props {
  question: string;
  onQuestionChange: (v: string) => void;
  onAsk: (q: string) => void;
  asking: boolean;
  answer: string;
  citations: KdpCitation[];
  allChunks: KdpChunk[];
  error: string | null;
  onCitationClick: (chunkId: number) => void;
  onCopyShare: () => void;
  currentLogId: number | null;
  currentStarred: boolean;
  onToggleStar: (next: boolean) => void;
}

export function QaBar({
  question,
  onQuestionChange,
  onAsk,
  asking,
  answer,
  citations,
  allChunks,
  error,
  onCitationClick,
  onCopyShare,
  currentLogId,
  currentStarred,
  onToggleStar,
}: Props) {
  const chunkById = useMemo(() => {
    const map = new Map<number, KdpChunk>();
    allChunks.forEach((c) => map.set(c.id, c));
    return map;
  }, [allChunks]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onAsk(question);
    }
  };

  const renderedAnswer = useMemo(() => {
    if (!answer) return null;
    const parts = answer.split(/(\[#\d+\])/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[#(\d+)\]$/);
      if (m) {
        const id = Number(m[1]);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onCitationClick(id)}
            className="mx-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] align-middle transition-colors"
            style={{
              borderColor: '#0672ED',
              color: '#0672ED',
              background: '#F5F9FF',
              fontFamily: 'HyundaiSansTextKR, sans-serif',
            }}
            title={chunkById.get(id)?.heading_path ?? ''}
          >
            #{id}
          </button>
        );
      }
      return (
        <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
          {part}
        </span>
      );
    });
  }, [answer, chunkById, onCitationClick]);

  return (
    <div className="grid grid-cols-[minmax(260px,360px)_1fr] gap-4">
      <div className="flex flex-col gap-2">
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={'예) 개인정보 보유기간은 어떻게 되나요?\n(Ctrl/⌘ + Enter 로 전송)'}
          rows={4}
          className="w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
          style={{
            borderColor: '#EFEFF0',
            background: '#FFFFFF',
            color: '#121416',
            fontFamily: 'HyundaiSansTextKR, sans-serif',
          }}
        />
        <div className="flex items-center gap-2">
          <Button onClick={() => onAsk(question)} disabled={asking || !question.trim()}>
            {asking ? '응답 중…' : '질문'}
          </Button>
          <Button variant="outline" size="sm" onClick={onCopyShare}>
            🔗 공유
          </Button>
        </div>
      </div>

      <div
        className="rounded-md border px-4 py-3 text-sm"
        style={{
          borderColor: '#EFEFF0',
          background: '#FAFAFB',
          minHeight: 130,
          fontFamily: 'HyundaiSansTextKR, sans-serif',
          color: '#121416',
        }}
      >
        {error ? (
          <div style={{ color: '#E81F2C' }}>오류: {error}</div>
        ) : answer ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div style={{ lineHeight: 1.7 }}>{renderedAnswer}</div>
              {currentLogId && (
                <button
                  type="button"
                  onClick={() => onToggleStar(!currentStarred)}
                  className="shrink-0 rounded-md border px-2 py-1 text-xs transition-colors"
                  style={{
                    borderColor: currentStarred ? '#EC8E01' : '#EFEFF0',
                    color: currentStarred ? '#EC8E01' : '#929296',
                    background: currentStarred ? '#FFF7E8' : '#FFFFFF',
                  }}
                  title="즐겨찾기"
                >
                  {currentStarred ? '⭐ 즐겨찾기' : '☆ 즐겨찾기'}
                </button>
              )}
            </div>
            {citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {citations.map((cit) => {
                  const c = chunkById.get(cit.chunk_id);
                  const label = c?.heading_path ?? `#${cit.chunk_id}`;
                  return (
                    <button
                      key={cit.chunk_id}
                      type="button"
                      onClick={() => onCitationClick(cit.chunk_id)}
                      className="max-w-[360px] truncate rounded-md border px-2 py-1 text-xs text-left transition-colors"
                      style={{
                        borderColor: '#0672ED',
                        color: '#0672ED',
                        background: '#FFFFFF',
                        fontFamily: 'HyundaiSansTextKR, sans-serif',
                      }}
                      title={cit.excerpt}
                    >
                      <span className="font-medium">#{cit.chunk_id}</span>
                      <span className="mx-1" style={{ color: '#929296' }}>·</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#929296' }}>
            질문을 입력하고 전송하면 현대/기아 개인정보처리방침에서 근거를 찾아 답변합니다.
          </div>
        )}
      </div>
    </div>
  );
}
