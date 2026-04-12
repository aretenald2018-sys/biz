'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, FileDiff, LibraryBig, LoaderCircle } from 'lucide-react';
import {
  CompanyValuesPanel,
  type CompanyValuePlaceholder,
} from '@/components/documents/company-values-panel';
import { ConvertActions } from '@/components/documents/convert-actions';
import { DocxDiffUpload } from '@/components/documents/docx-diff-upload';
import { DocxDiffViewer } from '@/components/documents/docx-diff-viewer';
import { DocxDropzone } from '@/components/documents/docx-dropzone';
import { DocxPreview } from '@/components/documents/docx-preview';
import { DocxTemplateList } from '@/components/documents/docx-template-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDocumentStore } from '@/stores/document-store';
import type { DocxAnchorInsert, DocxAnchorStatus, DocxPlaceholderEntry } from '@/types/document';
import { cn } from '@/lib/utils';
import { runLocalPdfOcr, type LocalOcrProgress } from '@/lib/local-pdf-ocr';

type CompanySide = 'left' | 'right';
type DiffSide = 'left' | 'right';
type ConvertMode = 'left' | 'right' | 'both';

export default function DocumentsPage() {
  const {
    templates,
    activeTemplate,
    diffUploads,
    diffResult,
    error,
    listLoading,
    detailLoading,
    uploadLoading,
    saveLoading,
    convertLoading,
    diffLoading,
    fetchTemplates,
    loadTemplate,
    uploadTemplate,
    saveTemplate,
    deleteTemplate,
    convertTemplate,
    uploadDiffFile,
    deleteDiffUpload,
    runDiff,
    setDiffOverride,
    clearError,
  } = useDocumentStore();

  const [activeTab, setActiveTab] = useState('template');
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [draftAnchorInserts, setDraftAnchorInserts] = useState<DocxAnchorInsert[]>([]);
  const [liveAnchorStatuses, setLiveAnchorStatuses] = useState<DocxAnchorStatus[]>([]);
  const [lastConversionStatuses, setLastConversionStatuses] = useState<DocxAnchorStatus[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<CompanySide, string>>({
    left: 'A사',
    right: 'B사',
  });
  const [companyValues, setCompanyValues] = useState<Record<CompanySide, Record<string, string>>>({
    left: {},
    right: {},
  });
  const [localOcrProgress, setLocalOcrProgress] = useState<Record<DiffSide, LocalOcrProgress | null>>({
    left: null,
    right: null,
  });

  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const lastSavedPayloadRef = useRef('');

  const originalPlaceholders = useMemo(
    () => activeTemplate?.placeholders.filter((item) => item.source === 'original') || [],
    [activeTemplate?.id, activeTemplate?.placeholders],
  );

  const originalPlaceholderCounts = useMemo(
    () => toPlaceholderCountMap(originalPlaceholders),
    [originalPlaceholders],
  );

  useEffect(() => {
    void fetchTemplates().catch(() => null);
  }, [fetchTemplates]);

  useEffect(() => {
    if (!activeTemplate && templates[0]?.id && !detailLoading) {
      void loadTemplate(templates[0].id).catch(() => null);
    }
  }, [activeTemplate, detailLoading, loadTemplate, templates]);

  useEffect(() => {
    if (!activeTemplate) {
      setDraftDisplayName('');
      setDraftHtml('');
      setDraftAnchorInserts([]);
      setLiveAnchorStatuses([]);
      setLastConversionStatuses([]);
      lastSavedPayloadRef.current = '';
      return;
    }

    const nextHtml = activeTemplate.tiptap_html || activeTemplate.preview_html || '';
    const nextPayload = serializeDraftPayload({
      display_name: activeTemplate.display_name || '',
      tiptap_html: nextHtml,
      anchor_inserts: activeTemplate.anchor_inserts,
    });

    setDraftDisplayName(activeTemplate.display_name || '');
    setDraftHtml(nextHtml);
    setDraftAnchorInserts(activeTemplate.anchor_inserts);
    setLiveAnchorStatuses([]);
    setLastConversionStatuses([]);
    lastSavedPayloadRef.current = nextPayload;
  }, [activeTemplate?.id]);

  const placeholderItems = useMemo(
    () => buildPlaceholderItems(originalPlaceholders, draftAnchorInserts, liveAnchorStatuses, lastConversionStatuses),
    [draftAnchorInserts, liveAnchorStatuses, lastConversionStatuses, originalPlaceholders],
  );

  const placeholderKeys = useMemo(
    () => placeholderItems.map((item) => item.key),
    [placeholderItems],
  );

  useEffect(() => {
    setCompanyValues((prev) => ({
      left: reconcileValueMap(prev.left, placeholderKeys),
      right: reconcileValueMap(prev.right, placeholderKeys),
    }));
  }, [placeholderKeys]);

  useEffect(() => {
    if (!activeTemplate) {
      return;
    }

    const nextPayload = {
      display_name: draftDisplayName,
      tiptap_html: draftHtml,
      anchor_inserts: draftAnchorInserts,
    };
    const serialized = serializeDraftPayload(nextPayload);

    if (serialized === lastSavedPayloadRef.current) {
      return;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(() => {
      void persistDraft();
    }, 700);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [activeTemplate?.id, draftDisplayName, draftHtml, draftAnchorInserts]);

  async function persistDraft() {
    if (!activeTemplate || isSavingRef.current) {
      return activeTemplate;
    }

    const payload = {
      display_name: draftDisplayName,
      tiptap_html: draftHtml,
      anchor_inserts: draftAnchorInserts,
    };
    const serialized = serializeDraftPayload(payload);

    if (serialized === lastSavedPayloadRef.current) {
      return activeTemplate;
    }

    isSavingRef.current = true;

    try {
      const saved = await saveTemplate(activeTemplate.id, payload);
      lastSavedPayloadRef.current = serialized;
      return saved;
    } finally {
      isSavingRef.current = false;
    }
  }

  async function handleTemplateUpload(file: File) {
    await uploadTemplate(file);
    setActiveTab('template');
  }

  async function handleTemplateDelete(id: string) {
    if (!window.confirm('이 양식을 삭제할까요? 삭제하면 다시 되돌릴 수 없습니다.')) {
      return;
    }

    await deleteTemplate(id);
  }

  async function handleLocalOcr(side: DiffSide) {
    const upload = diffUploads[side];
    if (!upload) {
      return;
    }

    setLocalOcrProgress((prev) => ({ ...prev, [side]: { status: '원본 PDF 다운로드', progress: 0.01 } }));

    try {
      const rawResponse = await fetch(`/api/documents/diff/${upload.id}/raw`);
      if (!rawResponse.ok) {
        throw new Error('원본 PDF를 가져오지 못했습니다.');
      }
      const blob = await rawResponse.blob();
      const text = await runLocalPdfOcr(blob, (progress) => {
        setLocalOcrProgress((prev) => ({ ...prev, [side]: progress }));
      });
      if (!text.trim()) {
        throw new Error('OCR 결과가 비어있습니다. 스캔 품질을 확인해주세요.');
      }
      await setDiffOverride(side, text);
    } finally {
      setLocalOcrProgress((prev) => ({ ...prev, [side]: null }));
    }
  }

  async function handleConvert(mode: ConvertMode) {
    if (!activeTemplate) {
      return;
    }

    await persistDraft();

    const runSingle = async (side: CompanySide) => {
      const results = await convertTemplate(activeTemplate.id, {
        companyName: companyNames[side],
        values: companyValues[side],
      });
      setLastConversionStatuses(results);
    };

    if (mode === 'both') {
      await runSingle('left');
      await runSingle('right');
      return;
    }

    await runSingle(mode);
  }

  const hasTemplates = templates.length > 0;
  const hasActiveTemplate = Boolean(activeTemplate);
  const hasPlaceholders = placeholderItems.length > 0;
  const displayedStatuses = lastConversionStatuses.length > 0 ? lastConversionStatuses : liveAnchorStatuses;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white px-7 py-6 shadow-sm">
        <div className="text-xs font-medium tracking-[0.24em] text-primary">DOCUMENTS</div>
        <h1 className="mt-2 text-[26px] font-medium text-foreground">표준문서</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
          워드 양식을 한 번 올려두면, 회사 두 곳에 맞춰 자동으로 채워서 내려받을 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-[var(--color-error-bg)] px-4 py-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clearError}>
            닫기
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="w-full justify-start gap-1 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="template"
            className="max-w-fit gap-2 border-0 px-4 py-3 text-sm text-muted-foreground data-active:text-primary"
          >
            <LibraryBig className="h-4 w-4" />
            양식 자동 채우기
          </TabsTrigger>
          <TabsTrigger
            value="diff"
            className="max-w-fit gap-2 border-0 px-4 py-3 text-sm text-muted-foreground data-active:text-primary"
          >
            <FileDiff className="h-4 w-4" />
            두 문서 비교하기
          </TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-6 pt-6">
          <Step
            number={1}
            title="양식 선택"
            subtitle={hasTemplates ? '새 양식을 올리거나, 보관된 양식 중 하나를 선택하세요.' : '채울 워드 파일을 올려 시작하세요.'}
            active
          >
            <div className={cn('grid gap-4', hasTemplates ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : '')}>
              <DocxDropzone
                title="새 양식 올리기"
                description="채워 넣을 워드 파일(.docx)을 끌어다 놓거나 클릭해서 선택하세요."
                loading={uploadLoading}
                onFileSelect={(file) => {
                  void handleTemplateUpload(file).catch(() => null);
                }}
              />
              {hasTemplates && (
                <DocxTemplateList
                  templates={templates}
                  activeId={activeTemplate?.id || null}
                  loading={listLoading}
                  onSelect={(id) => {
                    void loadTemplate(id).catch(() => null);
                  }}
                  onDelete={(id) => {
                    void handleTemplateDelete(id).catch(() => null);
                  }}
                />
              )}
            </div>
          </Step>

          <Step
            number={2}
            title="문서 미리보기"
            subtitle={hasActiveTemplate
              ? '양식 내용을 확인하고, 바꿀 자리에 {{회사명}} 같은 표시를 넣어주세요.'
              : '먼저 양식을 선택하면 여기에서 내용을 확인할 수 있어요.'}
            active={hasActiveTemplate}
            disabled={!hasActiveTemplate}
          >
            {activeTemplate ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">양식 이름</label>
                    <Input
                      value={draftDisplayName}
                      onChange={(event) => setDraftDisplayName(event.target.value)}
                      placeholder="예: 표준 NDA, 데이터 이용 동의서"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-muted-foreground">원본 파일</label>
                      {(detailLoading || saveLoading || uploadLoading) && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                          저장 중
                        </span>
                      )}
                    </div>
                    <div className="truncate rounded-lg border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                      {activeTemplate.filename}
                    </div>
                  </div>
                </div>

                <DocxPreview
                  value={draftHtml}
                  originalPlaceholderCounts={originalPlaceholderCounts}
                  onChange={(html, anchorInserts, anchorStatuses) => {
                    setDraftHtml(html);
                    setDraftAnchorInserts(anchorInserts);
                    setLiveAnchorStatuses(anchorStatuses);
                  }}
                />

                {hasPlaceholders && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/30 px-4 py-3 text-xs">
                    <span className="font-medium text-muted-foreground">감지된 항목</span>
                    {placeholderItems.map((item) => (
                      <span
                        key={item.key}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono',
                          item.anchorStatus === 'failed' && 'border-rose-200 bg-rose-50 text-rose-700',
                          item.anchorStatus === 'conflict' && 'border-amber-200 bg-amber-50 text-amber-700',
                          (item.anchorStatus === 'ready' || item.anchorStatus === null) && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {`{{${item.key}}}`}
                        <span className="text-[10px] opacity-70">×{item.occurrences}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-card px-8 py-12 text-center text-sm text-muted-foreground">
                먼저 ① 단계에서 양식을 선택하세요.
              </div>
            )}
          </Step>

          <Step
            number={3}
            title="회사별 값 입력"
            subtitle="각 회사에 맞춰 들어갈 값을 입력하세요."
            active={hasActiveTemplate && hasPlaceholders}
            disabled={!hasActiveTemplate}
          >
            {hasActiveTemplate ? (
              <CompanyValuesPanel
                placeholders={placeholderItems}
                companyNames={companyNames}
                values={companyValues}
                onCompanyNameChange={(side, value) => {
                  setCompanyNames((prev) => ({ ...prev, [side]: value || (side === 'left' ? 'A사' : 'B사') }));
                }}
                onValueChange={(side, key, value) => {
                  setCompanyValues((prev) => ({
                    ...prev,
                    [side]: {
                      ...prev[side],
                      [key]: value,
                    },
                  }));
                }}
              />
            ) : (
              <div className="rounded-xl border border-dashed bg-card px-8 py-12 text-center text-sm text-muted-foreground">
                양식을 선택하면 여기에 입력 칸이 나타납니다.
              </div>
            )}
          </Step>

          <Step
            number={4}
            title="파일 생성"
            subtitle="입력한 값으로 워드 파일을 만들어 내려받습니다."
            active={hasActiveTemplate && hasPlaceholders}
            disabled={!hasActiveTemplate}
          >
            <div className="mx-auto max-w-xl">
              <ConvertActions
                disabled={!activeTemplate}
                loading={convertLoading}
                companyNames={companyNames}
                anchorStatuses={displayedStatuses}
                onConvert={(mode) => {
                  void handleConvert(mode).catch(() => null);
                }}
              />
            </div>
          </Step>
        </TabsContent>

        <TabsContent value="diff" className="space-y-6 pt-6">
          <DocxDiffUpload
            uploads={diffUploads}
            loading={diffLoading}
            onUpload={(side, file) => {
              void uploadDiffFile(side, file).catch(() => null);
            }}
            onClear={(side) => {
              void deleteDiffUpload(side).catch(() => null);
            }}
            onRun={() => {
              void runDiff().catch(() => null);
            }}
            onLocalOcr={async (side) => {
              await handleLocalOcr(side).catch(() => null);
            }}
            localOcrProgress={localOcrProgress}
          />
          <DocxDiffViewer result={diffResult} uploads={diffUploads} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  subtitle?: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function Step({ number, title, subtitle, active = false, disabled = false, children }: StepProps) {
  return (
    <section
      className={cn(
        'relative rounded-2xl border bg-card px-6 py-5 shadow-sm transition-colors',
        disabled && 'opacity-60',
        active && !disabled && 'border-primary/30',
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-6 h-8 w-1 rounded-r-full',
          active && !disabled ? 'bg-primary' : 'bg-transparent',
        )}
      />
      <header className="mb-4 flex items-start gap-3">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium',
            active && !disabled
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground',
          )}
        >
          {number}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-medium text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function toPlaceholderCountMap(placeholders: DocxPlaceholderEntry[]) {
  return placeholders.reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = item.occurrences;
    return acc;
  }, {});
}

function serializeDraftPayload(payload: {
  display_name: string;
  tiptap_html: string;
  anchor_inserts: DocxAnchorInsert[];
}) {
  return JSON.stringify({
    display_name: payload.display_name,
    tiptap_html: payload.tiptap_html,
    anchor_inserts: payload.anchor_inserts,
  });
}

function reconcileValueMap(current: Record<string, string>, keys: string[]) {
  const next: Record<string, string> = {};

  keys.forEach((key) => {
    next[key] = current[key] || '';
  });

  return next;
}

function buildPlaceholderItems(
  originalPlaceholders: DocxPlaceholderEntry[],
  anchorInserts: DocxAnchorInsert[],
  liveAnchorStatuses: DocxAnchorStatus[],
  lastConversionStatuses: DocxAnchorStatus[],
): CompanyValuePlaceholder[] {
  const items = new Map<string, CompanyValuePlaceholder>();
  const statusMap = new Map<string, { status: DocxAnchorStatus['status']; matches: number }>();

  originalPlaceholders.forEach((item) => {
    items.set(item.key, {
      key: item.key,
      occurrences: item.occurrences,
      hasOriginal: true,
      hasAnchor: false,
      anchorStatus: null,
      anchorMatches: 0,
    });
  });

  anchorInserts.forEach((item) => {
    const current = items.get(item.key);

    if (!current) {
      items.set(item.key, {
        key: item.key,
        occurrences: 1,
        hasOriginal: false,
        hasAnchor: true,
        anchorStatus: null,
        anchorMatches: 0,
      });
      return;
    }

    current.hasAnchor = true;
    current.occurrences += 1;
  });

  [...liveAnchorStatuses, ...lastConversionStatuses].forEach((status) => {
    const current = statusMap.get(status.key);

    if (!current || statusPriority(status.status) > statusPriority(current.status)) {
      statusMap.set(status.key, { status: status.status, matches: status.matches });
    }
  });

  statusMap.forEach((status, key) => {
    const item = items.get(key);

    if (!item) {
      return;
    }

    item.anchorStatus = status.status;
    item.anchorMatches = status.matches;
  });

  return Array.from(items.values());
}

function statusPriority(status: DocxAnchorStatus['status']) {
  if (status === 'failed') {
    return 3;
  }

  if (status === 'conflict') {
    return 2;
  }

  return 1;
}
