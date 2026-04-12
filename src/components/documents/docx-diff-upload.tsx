'use client';

import { useState } from 'react';
import { FileText, ScanEye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocxDropzone } from '@/components/documents/docx-dropzone';
import type { DocxDiffUpload } from '@/types/document';
import { cn } from '@/lib/utils';

type DiffSide = 'left' | 'right';

interface DocxDiffUploadProps {
  uploads: Record<DiffSide, DocxDiffUpload | null>;
  loading?: boolean;
  onUpload: (side: DiffSide, file: File) => void;
  onClear: (side: DiffSide) => void;
  onRun: () => void;
  onLocalOcr: (side: DiffSide) => Promise<void>;
  localOcrProgress: Record<DiffSide, { status: string; progress: number } | null>;
}

export function DocxDiffUpload({
  uploads,
  loading = false,
  onUpload,
  onClear,
  onRun,
  onLocalOcr,
  localOcrProgress,
}: DocxDiffUploadProps) {
  const canRun = Boolean(uploads.left?.id && uploads.right?.id);

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <div className="text-sm font-medium text-foreground">두 문서 비교하기</div>
        <p className="mt-1 text-sm text-muted-foreground">
          이전 버전과 새 버전 문서를 올리면 변경 부분을 한눈에 볼 수 있어요. <b>워드(.docx)</b>와 <b>PDF</b> 모두 지원하고, 텍스트층이 없는 PDF는 자동으로 OCR 됩니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DiffUploadSlot
          side="left"
          title="① 이전 버전"
          description="기존 문서를 끌어다 놓거나 클릭해서 선택하세요."
          upload={uploads.left}
          loading={loading}
          onUpload={onUpload}
          onClear={onClear}
          onLocalOcr={onLocalOcr}
          progress={localOcrProgress.left}
        />
        <DiffUploadSlot
          side="right"
          title="② 새 버전"
          description="비교할 새 문서를 끌어다 놓거나 클릭해서 선택하세요."
          upload={uploads.right}
          loading={loading}
          onUpload={onUpload}
          onClear={onClear}
          onLocalOcr={onLocalOcr}
          progress={localOcrProgress.right}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          {canRun
            ? '준비됐습니다. 비교하기 버튼을 눌러주세요.'
            : '두 파일을 모두 올리면 비교를 시작할 수 있어요.'}
        </p>
        <Button type="button" disabled={!canRun || loading} onClick={onRun}>
          {loading ? '비교 중…' : '비교하기'}
        </Button>
      </div>
    </div>
  );
}

function DiffUploadSlot({
  side,
  title,
  description,
  upload,
  loading,
  onUpload,
  onClear,
  onLocalOcr,
  progress,
}: {
  side: DiffSide;
  title: string;
  description: string;
  upload: DocxDiffUpload | null;
  loading: boolean;
  onUpload: (side: DiffSide, file: File) => void;
  onClear: (side: DiffSide) => void;
  onLocalOcr: (side: DiffSide) => Promise<void>;
  progress: { status: string; progress: number } | null;
}) {
  const [ocrBusy, setOcrBusy] = useState(false);
  const isPdf = upload?.file_type === 'application/pdf' || upload?.filename.toLowerCase().endsWith('.pdf');
  const kindLabel = !upload
    ? null
    : isPdf
      ? (upload.has_override ? 'PDF · 로컬 OCR 결과 적용됨' : 'PDF')
      : 'DOCX';

  return (
    <div className="space-y-2">
      <DocxDropzone
        title={title}
        description={description}
        accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
        hint="DOCX 또는 PDF · 최대 20MB"
        fileName={upload?.filename || null}
        loading={loading}
        onFileSelect={(file) => onUpload(side, file)}
      />
      {upload && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {kindLabel && (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
              isPdf
                ? (upload.has_override ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')
                : 'border-primary/20 bg-secondary/60 text-primary',
            )}>
              <FileText className="h-3 w-3" />
              {kindLabel}
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => onClear(side)} disabled={loading}>
            파일 빼기
          </Button>
          {isPdf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={ocrBusy || loading}
              onClick={async () => {
                setOcrBusy(true);
                try {
                  await onLocalOcr(side);
                } finally {
                  setOcrBusy(false);
                }
              }}
              title="Tesseract.js로 브라우저에서 로컬 OCR을 실행해 텍스트를 추출합니다."
            >
              <ScanEye className="h-3.5 w-3.5" />
              {ocrBusy ? '실행 중…' : '로컬 OCR 실행'}
            </Button>
          )}
        </div>
      )}
      {progress && (
        <div className="px-1 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>{progress.status}</span>
            <span>{Math.round(progress.progress * 100)}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.max(2, Math.round(progress.progress * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
