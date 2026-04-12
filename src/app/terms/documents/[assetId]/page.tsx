'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TermsDiffView } from '@/components/terms/terms-diff-view';
import { StatusChip } from '@/components/terms/status-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getVerificationStatusTone } from '@/lib/terms-labels';
import { useTermsAssetStore } from '@/stores/terms-asset-store';
import { useTermsFactStore } from '@/stores/terms-fact-store';

export default function TermsDocumentsPage() {
  const params = useParams();
  const assetId = Number.parseInt(params.assetId || '', 10);
  const {
    activeAsset,
    activeVersions,
    versionDiffs,
    error,
    detailLoading,
    actionLoading,
    fetchVersions,
    fetchVersionDiff,
    captureAsset,
    uploadVersion,
    clearError,
  } = useTermsAssetStore();
  const { extractFacts } = useTermsFactStore();
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [uploadedBy, setUploadedBy] = useState('');

  useEffect(() => {
    if (!Number.isFinite(assetId)) {
      return;
    }
    void fetchVersions(assetId).catch(() => null);
  }, [assetId, fetchVersions]);

  useEffect(() => {
    if (!activeVersions[0]) {
      setSelectedVersionId(null);
      return;
    }

    setSelectedVersionId((current) => current ?? activeVersions[0].id);
  }, [activeVersions]);

  useEffect(() => {
    if (!selectedVersionId) {
      return;
    }
    if (selectedVersionId in versionDiffs) {
      return;
    }
    void fetchVersionDiff(selectedVersionId).catch(() => null);
  }, [fetchVersionDiff, selectedVersionId, versionDiffs]);

  const selectedVersion = useMemo(
    () => activeVersions.find((item) => item.id === selectedVersionId) ?? null,
    [activeVersions, selectedVersionId],
  );

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>닫기</Button>
        </div>
      )}

      <section className="rounded-2xl border bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/terms/assets" className="text-xs text-primary hover:underline">/terms/assets</Link>
            <h2 className="mt-2 text-xl font-medium text-foreground">
              {activeAsset ? `${activeAsset.market_entity} 문서 타임라인` : '문서 타임라인'}
            </h2>
            {activeAsset && (
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusChip className={getVerificationStatusTone(activeAsset.verification_status)}>
                  {activeAsset.verification_status}
                </StatusChip>
                <StatusChip className="border-slate-200 bg-slate-100 text-slate-700">{activeAsset.channel}</StatusChip>
                <StatusChip className="border-slate-200 bg-slate-100 text-slate-700">{activeAsset.monitoring_tier}</StatusChip>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Input
              className="w-[180px]"
              placeholder="uploaded_by"
              value={uploadedBy}
              onChange={(event) => setUploadedBy(event.target.value)}
            />
            <label className="inline-flex cursor-pointer items-center rounded-lg border px-3 text-sm">
              파일 업로드
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file || !activeAsset) {
                    return;
                  }
                  void uploadVersion(activeAsset.id, file, uploadedBy).catch(() => null);
                  event.target.value = '';
                }}
              />
            </label>
            <Button variant="outline" onClick={() => activeAsset && void captureAsset(activeAsset.id).catch(() => null)} disabled={actionLoading || !activeAsset}>
              Capture
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs tracking-[0.2em] text-primary">VERSIONS</div>
              <div className="mt-2 text-lg font-medium text-foreground">{activeVersions.length} versions</div>
            </div>
            <Button variant="outline" onClick={() => Number.isFinite(assetId) && void fetchVersions(assetId).catch(() => null)} disabled={detailLoading}>
              새로고침
            </Button>
          </div>

          <div className="space-y-3">
            {activeVersions.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => setSelectedVersionId(version.id)}
                className={`w-full rounded-xl border px-4 py-4 text-left transition-colors ${selectedVersionId === version.id ? 'border-primary/30 bg-[#F7FAFC]' : 'bg-slate-50 hover:border-primary/20'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900">Version #{version.id}</div>
                  <StatusChip className="border-slate-200 bg-white text-slate-700">{version.change_kind || 'none'}</StatusChip>
                </div>
                <div className="mt-2 text-xs text-slate-500">{version.captured_at}</div>
                <div className="mt-2 text-xs text-slate-600">
                  {version.capture_source}
                  {version.http_status != null ? ` / HTTP ${version.http_status}` : ''}
                </div>
              </button>
            ))}

            {activeVersions.length === 0 && (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {detailLoading ? '로딩 중...' : '버전이 없습니다.'}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs tracking-[0.2em] text-primary">SELECTED VERSION</div>
                <div className="mt-2 text-lg font-medium text-foreground">
                  {selectedVersion ? `Version #${selectedVersion.id}` : '버전을 선택하세요'}
                </div>
              </div>
              {selectedVersion && (
                <Button onClick={() => void extractFacts(selectedVersion.id).catch(() => null)} disabled={actionLoading}>
                  Extract Facts
                </Button>
              )}
            </div>

            {selectedVersion && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <MetaRow label="Captured At" value={selectedVersion.captured_at} />
                <MetaRow label="Change Kind" value={selectedVersion.change_kind || 'none'} />
                <MetaRow label="HTTP" value={selectedVersion.http_status == null ? '-' : String(selectedVersion.http_status)} />
                <MetaRow label="Source" value={selectedVersion.capture_source} />
                <MetaRow label="ETag" value={selectedVersion.etag || '-'} />
                <MetaRow label="Uploader" value={selectedVersion.uploaded_by || '-'} />
              </div>
            )}
          </div>

          <TermsDiffView diff={selectedVersionId ? versionDiffs[selectedVersionId] : null} />
        </section>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-3 py-3">
      <div className="text-[11px] tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  );
}
