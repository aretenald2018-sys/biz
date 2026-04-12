'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StatusChip } from '@/components/terms/status-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  getTermsBrandLabel,
  TERMS_DOCUMENT_LABELS,
  TERMS_SERVICE_LABELS,
  getVerificationStatusTone,
} from '@/lib/terms-labels';
import { useTermsAssetStore } from '@/stores/terms-asset-store';
import type { TermsAssetInput } from '@/types/terms';

const defaultForm: FormState = {
  auth_required: false,
  channel: 'html',
  controller_entity: '',
  document_type: 'privacy_policy',
  effective_date: '',
  language: 'en',
  last_seen_at: '',
  last_updated_text: '',
  market_entity: '',
  monitoring_tier: 'P2_monthly',
  notes: '',
  owner_team: '',
  service_family: 'website',
  url: '',
  verification_status: 'unverified',
};

type FormState = Omit<TermsAssetInput, 'controller_entity' | 'language' | 'last_updated_text' | 'effective_date' | 'last_seen_at' | 'owner_team' | 'notes'> & {
  controller_entity: string;
  effective_date: string;
  language: string;
  last_seen_at: string;
  last_updated_text: string;
  notes: string;
  owner_team: string;
};

export default function TermsAssetsPage() {
  const {
    marketEntities,
    controllers,
    assets,
    error,
    loading,
    actionLoading,
    fetchReferenceData,
    fetchAssets,
    saveAsset,
    deleteAsset,
    captureAsset,
    discoverCandidates,
    clearError,
  } = useTermsAssetStore();
  const [draft, setDraft] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([fetchReferenceData(), fetchAssets()]).catch(() => null);
  }, [fetchAssets, fetchReferenceData]);

  const groupedControllers = useMemo(
    () => [{ code: '', legal_name: '선택 안 함' }, ...controllers],
    [controllers],
  );

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>닫기</Button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4">
            <div className="text-xs tracking-[0.2em] text-primary">ASSET FORM</div>
            <h2 className="mt-2 text-lg font-medium text-foreground">
              {editingId ? `Asset #${editingId} 수정` : '신규 asset 등록'}
            </h2>
          </div>

          <div className="space-y-3">
            <Field label="Market Entity">
              <select
                className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                value={draft.market_entity}
                onChange={(event) => setDraft((prev) => ({ ...prev, market_entity: event.target.value }))}
              >
                <option value="">선택</option>
                {marketEntities.map((item) => (
                  <option key={item.code} value={item.code}>
                    {`${getTermsBrandLabel(item.brand)} · ${item.display_name}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Controller">
              <select
                className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                value={draft.controller_entity}
                onChange={(event) => setDraft((prev) => ({ ...prev, controller_entity: event.target.value }))}
              >
                {groupedControllers.map((item) => (
                  <option key={item.code} value={item.code}>{item.legal_name}</option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Service">
                <select
                  className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                  value={draft.service_family}
                  onChange={(event) => setDraft((prev) => ({ ...prev, service_family: event.target.value as TermsAssetInput['service_family'] }))}
                >
                  {Object.entries(TERMS_SERVICE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Document">
                <select
                  className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                  value={draft.document_type}
                  onChange={(event) => setDraft((prev) => ({ ...prev, document_type: event.target.value as TermsAssetInput['document_type'] }))}
                >
                  {Object.entries(TERMS_DOCUMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Channel">
                <select
                  className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                  value={draft.channel}
                  onChange={(event) => setDraft((prev) => ({ ...prev, channel: event.target.value as TermsAssetInput['channel'] }))}
                >
                  {['html', 'pdf', 'download_index', 'archive_index', 'portal_auth', 'guide'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Monitoring Tier">
                <select
                  className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                  value={draft.monitoring_tier}
                  onChange={(event) => setDraft((prev) => ({ ...prev, monitoring_tier: event.target.value as TermsAssetInput['monitoring_tier'] }))}
                >
                  {['P0_weekly', 'P1_weekly', 'P2_monthly'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="URL">
              <Input value={draft.url} onChange={(event) => setDraft((prev) => ({ ...prev, url: event.target.value }))} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Language">
                <Input value={draft.language} onChange={(event) => setDraft((prev) => ({ ...prev, language: event.target.value }))} />
              </Field>
              <Field label="Owner Team">
                <Input value={draft.owner_team} onChange={(event) => setDraft((prev) => ({ ...prev, owner_team: event.target.value }))} />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Verification">
                <select
                  className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                  value={draft.verification_status}
                  onChange={(event) => setDraft((prev) => ({ ...prev, verification_status: event.target.value as TermsAssetInput['verification_status'] }))}
                >
                  {['unverified', 'verified', 'broken', 'superseded'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Auth Required">
                <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.auth_required}
                    onChange={(event) => setDraft((prev) => ({ ...prev, auth_required: event.target.checked }))}
                  />
                  인증 필요
                </label>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea rows={4} value={draft.notes} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void saveAsset(normalizeForm(draft), editingId).then(() => {
                  setDraft(defaultForm);
                  setEditingId(null);
                }).catch(() => null);
              }}
              disabled={actionLoading}
            >
              {editingId ? '저장' : '등록'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(defaultForm);
                setEditingId(null);
              }}
            >
              초기화
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs tracking-[0.2em] text-primary">ASSETS</div>
              <h2 className="mt-2 text-lg font-medium text-foreground">추적 자산 목록</h2>
            </div>
            <Button variant="outline" onClick={() => void fetchAssets().catch(() => null)} disabled={loading}>
              새로고침
            </Button>
          </div>

          <div className="space-y-3">
            {assets.map((asset) => (
              <article key={asset.id} className="rounded-xl border bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-slate-900">
                        {asset.market_entity} / {TERMS_SERVICE_LABELS[asset.service_family]} / {TERMS_DOCUMENT_LABELS[asset.document_type]}
                      </h3>
                      <StatusChip className={getVerificationStatusTone(asset.verification_status)}>
                        {asset.verification_status}
                      </StatusChip>
                    </div>
                    <p className="mt-2 truncate text-sm text-slate-600">{asset.url}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusChip className="border-slate-200 bg-white text-slate-600">{asset.channel}</StatusChip>
                      <StatusChip className="border-slate-200 bg-white text-slate-600">{asset.monitoring_tier}</StatusChip>
                      {asset.language && <StatusChip className="border-slate-200 bg-white text-slate-600">{asset.language}</StatusChip>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void captureAsset(asset.id).catch(() => null)} disabled={actionLoading}>
                      Capture
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void discoverCandidates(asset.id).catch(() => null)} disabled={actionLoading}>
                      Discover
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(asset.id);
                        setDraft({
                          auth_required: asset.auth_required,
                          channel: asset.channel,
                          controller_entity: asset.controller_entity ?? '',
                          document_type: asset.document_type,
                          effective_date: asset.effective_date ?? '',
                          language: asset.language ?? '',
                          last_seen_at: asset.last_seen_at ?? '',
                          last_updated_text: asset.last_updated_text ?? '',
                          market_entity: asset.market_entity,
                          monitoring_tier: asset.monitoring_tier,
                          notes: asset.notes ?? '',
                          owner_team: asset.owner_team ?? '',
                          service_family: asset.service_family,
                          url: asset.url,
                          verification_status: asset.verification_status,
                        });
                      }}
                    >
                      편집
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/terms/documents/${asset.id}`}>문서</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void deleteAsset(asset.id).catch(() => null)} disabled={actionLoading}>
                      삭제
                    </Button>
                  </div>
                </div>
              </article>
            ))}

            {assets.length === 0 && (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {loading ? '로딩 중...' : '등록된 asset이 없습니다.'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function normalizeForm(form: FormState): TermsAssetInput {
  return {
    ...form,
    controller_entity: form.controller_entity || null,
    effective_date: form.effective_date || null,
    language: form.language || null,
    last_seen_at: form.last_seen_at || null,
    last_updated_text: form.last_updated_text || null,
    notes: form.notes || null,
    owner_team: form.owner_team || null,
  };
}
