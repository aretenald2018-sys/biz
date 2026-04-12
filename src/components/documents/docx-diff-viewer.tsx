'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DiffPreviewPane, type DiffPreviewPaneHandle } from '@/components/documents/diff-preview-pane';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  DocxDiffExtractionSource,
  DocxDiffLine,
  DocxDiffResult,
  DocxDiffSegment,
  DocxDiffUpload,
} from '@/types/document';
import { cn } from '@/lib/utils';

interface DocxDiffViewerProps {
  result: DocxDiffResult | null;
  uploads: Record<'left' | 'right', DocxDiffUpload | null>;
}

interface PreviewSyncRequest {
  leftText: string;
  rightText: string;
}

export function DocxDiffViewer({ result, uploads }: DocxDiffViewerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftPreviewRef = useRef<DiffPreviewPaneHandle | null>(null);
  const rightPreviewRef = useRef<DiffPreviewPaneHandle | null>(null);
  const changedLines = useMemo(() => result?.lines.filter((line) => line.diffIndex !== null) || [], [result]);
  const [cursor, setCursor] = useState(0);
  const [activeTab, setActiveTab] = useState<'text' | 'preview'>('text');
  const [syncRequest, setSyncRequest] = useState<PreviewSyncRequest | null>(null);

  useEffect(() => {
    setCursor(0);
    setActiveTab('text');
    setSyncRequest(null);
  }, [result?.leftFilename, result?.rightFilename]);

  useEffect(() => {
    if (!result || changedLines.length === 0 || activeTab !== 'text') {
      return;
    }

    const current = changedLines[cursor];
    const target = rootRef.current?.querySelector<HTMLElement>(`[data-diff-index="${current.diffIndex}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeTab, changedLines, cursor, result]);

  useEffect(() => {
    if (activeTab !== 'preview' || !syncRequest) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (syncRequest.leftText.trim()) {
        leftPreviewRef.current?.scrollToText(syncRequest.leftText);
      }

      if (syncRequest.rightText.trim()) {
        rightPreviewRef.current?.scrollToText(syncRequest.rightText);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, syncRequest]);

  useEffect(() => {
    if (!result || changedLines.length === 0) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      if (event.key === 'n') {
        event.preventDefault();
        setCursor((prev) => (prev + 1) % changedLines.length);
      }

      if (event.key === 'p') {
        event.preventDefault();
        setCursor((prev) => (prev - 1 + changedLines.length) % changedLines.length);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changedLines.length, result]);

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <div className="text-sm font-medium text-foreground">아직 비교한 문서가 없습니다</div>
        <p className="mt-2 text-sm text-muted-foreground">
          위에 두 개의 워드 파일을 올리고 ‘비교하기’ 버튼을 누르면 차이점이 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  const canPreview = Boolean(uploads.left?.id && uploads.right?.id);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <div className="text-sm font-medium text-foreground">바뀐 부분</div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              새로 추가 {result.stats.added}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              삭제됨 {result.stats.removed}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              내용 변경 {result.stats.modified}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={changedLines.length === 0}
            onClick={() => setCursor((prev) => (prev - 1 + changedLines.length) % changedLines.length)}
          >
            <ChevronLeft className="h-4 w-4" />
            이전 위치
          </Button>
          <div className="min-w-16 text-center text-sm text-muted-foreground">
            {changedLines.length === 0 ? '0 / 0' : `${cursor + 1} / ${changedLines.length}`}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={changedLines.length === 0}
            onClick={() => setCursor((prev) => (prev + 1) % changedLines.length)}
          >
            다음 위치
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <div className="border-b bg-amber-50/80 px-4 py-2 text-xs text-amber-800">
          {result.warnings.map((warning, index) => (
            <div key={index}>⚠ {warning}</div>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'text' | 'preview')}>
        <div className="border-b px-4 pt-3">
          <TabsList variant="line" className="h-auto gap-1 p-0">
            <TabsTrigger value="text" className="max-w-fit px-3 py-2 text-sm text-muted-foreground data-active:text-primary">
              텍스트 차이
            </TabsTrigger>
            <TabsTrigger value="preview" className="max-w-fit px-3 py-2 text-sm text-muted-foreground data-active:text-primary">
              원본 서식 비교
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="text" className="mt-0">
          <div className="grid grid-cols-2 border-b bg-secondary/40 text-xs font-medium text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2 border-r px-4 py-3">
              <span className="truncate">📄 이전 문서 · {result.leftFilename}</span>
              {result.sources && <SourceBadge source={result.sources.left} />}
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <span className="truncate">📄 새 문서 · {result.rightFilename}</span>
              {result.sources && <SourceBadge source={result.sources.right} />}
            </div>
          </div>

          <div ref={rootRef}>
            <ScrollArea className="h-[640px]">
              <div className="divide-y">
                {result.lines.map((line, index) => (
                  <DiffRow
                    key={`${line.diffIndex ?? 'eq'}-${index}`}
                    line={line}
                    onSelect={(selectedLine) => {
                      if (selectedLine.diffIndex === null) {
                        return;
                      }

                      const nextCursor = changedLines.findIndex((item) => item.diffIndex === selectedLine.diffIndex);

                      if (nextCursor >= 0) {
                        setCursor(nextCursor);
                      }

                      setSyncRequest({
                        leftText: selectedLine.left,
                        rightText: selectedLine.right,
                      });
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          {canPreview ? (
            <div className="space-y-3 p-4">
              <p className="text-xs text-muted-foreground">
                텍스트 차이 탭에서 변경 라인을 클릭한 뒤 이 탭으로 오면 해당 구절이나 페이지 근처로 스크롤됩니다.
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <DiffPreviewPane
                  ref={leftPreviewRef}
                  uploadId={uploads.left!.id}
                  fileType={uploads.left!.file_type}
                  filename={uploads.left!.filename}
                />
                <DiffPreviewPane
                  ref={rightPreviewRef}
                  uploadId={uploads.right!.id}
                  fileType={uploads.right!.file_type}
                  filename={uploads.right!.filename}
                />
              </div>
            </div>
          ) : (
            <div className="px-6 py-10 text-sm text-muted-foreground">
              비교에 사용한 두 파일이 모두 있어야 원본 서식 비교 탭을 열 수 있습니다.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SourceBadge({ source }: { source: DocxDiffExtractionSource }) {
  const map: Record<DocxDiffExtractionSource, { label: string; cls: string }> = {
    'docx': { label: 'DOCX', cls: 'border-primary/20 bg-secondary/60 text-primary' },
    'pdf-text': { label: 'PDF · 텍스트층', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    'pdf-ocr': { label: 'PDF · Claude OCR', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
    'pdf-override': { label: 'PDF · 로컬 OCR', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  };
  const meta = map[source];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-normal', meta.cls)}>
      {meta.label}
    </span>
  );
}

function DiffRow({ line, onSelect }: { line: DocxDiffLine; onSelect: (line: DocxDiffLine) => void }) {
  const showLeftSegments = line.type === 'modified' && line.leftSegments && line.leftSegments.length > 0;
  const showRightSegments = line.type === 'modified' && line.rightSegments && line.rightSegments.length > 0;
  const isClickable = line.diffIndex !== null;

  return (
    <div
      className={cn(
        'grid grid-cols-2 transition-colors',
        line.type === 'modified' && 'bg-amber-50/70',
        line.type === 'added' && 'bg-emerald-50/70',
        line.type === 'removed' && 'bg-rose-50/70',
        isClickable && 'cursor-pointer hover:bg-secondary/60',
      )}
      data-diff-index={line.diffIndex ?? undefined}
      onClick={() => {
        if (isClickable) {
          onSelect(line);
        }
      }}
    >
      <div
        className={cn(
          'border-r border-border px-4 py-2.5 text-sm whitespace-pre-wrap',
          line.type === 'added' && 'bg-rose-50/30 text-muted-foreground/70',
        )}
      >
        {showLeftSegments
          ? <InlineSegments segments={line.leftSegments!} side="left" />
          : (line.left || <span className="text-muted-foreground/60">·</span>)}
      </div>
      <div
        className={cn(
          'px-4 py-2.5 text-sm whitespace-pre-wrap',
          line.type === 'removed' && 'bg-emerald-50/30 text-muted-foreground/70',
        )}
      >
        {showRightSegments
          ? <InlineSegments segments={line.rightSegments!} side="right" />
          : (line.right || <span className="text-muted-foreground/60">·</span>)}
      </div>
    </div>
  );
}

function InlineSegments({ segments, side }: { segments: DocxDiffSegment[]; side: 'left' | 'right' }) {
  return (
    <>
      {segments.map((seg, index) => {
        if (seg.type === 'equal') {
          return <span key={index}>{seg.text}</span>;
        }
        if (seg.type === 'delete' && side === 'left') {
          return (
            <span key={index} className="rounded bg-rose-200/70 px-0.5 text-rose-900 line-through decoration-rose-700/70">
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'insert' && side === 'right') {
          return (
            <span key={index} className="rounded bg-emerald-200/70 px-0.5 font-medium text-emerald-900">
              {seg.text}
            </span>
          );
        }
        return null;
      })}
    </>
  );
}
