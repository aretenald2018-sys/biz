'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ManualInputPreview } from '@/components/terms/manual-input-preview';

interface ManualInputModalProps {
  open: boolean;
  marketEntity: string;
  onClose: () => void;
  onDone: () => void;
}

type InputMode = 'text' | 'file';

export function ManualInputModal({ open, marketEntity, onClose, onDone }: ManualInputModalProps) {
  const [mode, setMode] = useState<InputMode>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ versionId: number; assetId: number } | null>(null);

  const reset = () => {
    setText('');
    setFile(null);
    setTitle('');
    setError(null);
    setMode('text');
    setPreview(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submitIngest = async (): Promise<{ versionId: number; assetId: number } | null> => {
    setError(null);
    setLoading(true);

    const formData = new FormData();
    if (title) formData.append('title', title);
    if (mode === 'text') {
      if (!text.trim()) {
        setError('텍스트를 입력해주세요.');
        setLoading(false);
        return null;
      }
      formData.append('text', text);
    } else {
      if (!file) {
        setError('파일을 선택해주세요.');
        setLoading(false);
        return null;
      }
      formData.append('file', file);
    }

    try {
      const res = await fetch(`/api/terms/documents/manual-input/${encodeURIComponent(marketEntity)}`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || '업로드 실패');
      }
      const data = (await res.json()) as { asset_id: number; version: { id: number } };
      return { versionId: data.version.id, assetId: data.asset_id };
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const ingested = await submitIngest();
    if (!ingested) return;
    onDone();
    handleClose();
  };

  const handleAutoProcess = async () => {
    const ingested = await submitIngest();
    if (!ingested) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/terms/facts/extract/${ingested.versionId}`, { method: 'POST' });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || '분석 실패');
      }
      setPreview({ versionId: ingested.versionId, assetId: ingested.assetId });
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 실패');
    } finally {
      setLoading(false);
    }
  };

  if (preview) {
    return (
      <ManualInputPreview
        open={open}
        versionId={preview.versionId}
        onCancel={handleClose}
        onCommitted={() => {
          onDone();
          handleClose();
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>직접 약관 입력 · {marketEntity}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('text')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs',
                mode === 'text'
                  ? 'border-primary bg-[#F5F7F9] font-medium text-primary'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40',
              )}
            >
              텍스트 붙여넣기
            </button>
            <button
              type="button"
              onClick={() => setMode('file')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs',
                mode === 'file'
                  ? 'border-primary bg-[#F5F7F9] font-medium text-primary'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40',
              )}
            >
              파일 업로드 (PDF/DOCX/HTML)
            </button>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문서 제목 (선택)"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />

          {mode === 'text' ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="약관 본문을 여기에 붙여넣어주세요."
              rows={12}
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
            />
          ) : (
            <div>
              <input
                type="file"
                accept=".pdf,.docx,.html,.htm,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-600"
              />
              {file && (
                <div className="mt-2 text-xs text-slate-500">
                  선택됨: {file.name} ({Math.round(file.size / 1024)}KB)
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              취소
            </Button>
            <Button variant="outline" onClick={() => void handleSave()} disabled={loading}>
              저장
            </Button>
            <Button onClick={() => void handleAutoProcess()} disabled={loading}>
              {loading ? '처리 중…' : '바로 자동정리'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
