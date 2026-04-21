'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { KDP_SOURCE_URLS, type KdpBrand } from '@/types/kdp';

interface Props {
  open: boolean;
  onClose: () => void;
  brand: KdpBrand;
  onDone: () => void;
}

export function ImportDialog({ open, onClose, brand, onDone }: Props) {
  const [html, setHtml] = useState('');
  const [url, setUrl] = useState(KDP_SOURCE_URLS[brand]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const onFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setHtml(text);
  };

  const onSubmit = async () => {
    if (!html.trim()) {
      setError('HTML 본문이 비어있습니다.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kdp/policies/${brand}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? `HTTP ${res.status}`);
        return;
      }
      onDone();
      setHtml('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(18,20,22,0.38)' }}
      onClick={onClose}
    >
      <div
        className="w-[min(780px,92vw)] max-h-[92vh] overflow-y-auto rounded-lg border bg-white p-5 shadow-xl"
        style={{ borderColor: '#EFEFF0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontFamily: 'HyundaiSansHeadKR, HyundaiSansTextKR, sans-serif',
            color: '#002C5F',
            fontSize: 17,
            fontWeight: 500,
          }}
        >
          HTML 수동 업로드 — {brand === 'hyundai' ? '현대' : '기아'}
        </div>
        <p className="mt-1 text-xs" style={{ color: '#929296' }}>
          자동 크롤링이 본문을 읽지 못했을 때 사용합니다. 브라우저에서 원문 페이지를 완전히 로딩한 뒤
          <code className="mx-1 rounded bg-[#FAFAFB] px-1 py-0.5">Ctrl+S → 웹페이지(HTML만)</code>
          으로 저장한 파일을 업로드하세요.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs" style={{ color: '#535356' }}>원본 URL(선택)</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#EFEFF0', fontFamily: 'HyundaiSansTextKR, sans-serif' }}
            />
          </div>
          <div>
            <label className="block text-xs" style={{ color: '#535356' }}>HTML 파일</label>
            <input
              type="file"
              accept=".html,.htm,text/html"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="mt-1 block text-sm"
            />
          </div>
          <div>
            <label className="block text-xs" style={{ color: '#535356' }}>또는 HTML 텍스트 붙여넣기</label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={12}
              className="mt-1 w-full resize-y rounded-md border px-3 py-2 text-[12px] font-mono outline-none"
              style={{ borderColor: '#EFEFF0', background: '#FAFAFB' }}
              placeholder="<!DOCTYPE html>..."
            />
          </div>
          {error && (
            <div
              className="rounded-md border px-3 py-2 text-xs"
              style={{ borderColor: '#E81F2C', color: '#E81F2C', background: '#FFF5F5' }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={onSubmit} disabled={busy}>
            {busy ? '처리 중…' : '업로드 및 반영'}
          </Button>
        </div>
      </div>
    </div>
  );
}
