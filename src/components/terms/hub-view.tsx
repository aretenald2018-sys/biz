'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BoardView } from '@/components/terms/board-view';
import { ManualInputModal } from '@/components/terms/manual-input-modal';
import { Button } from '@/components/ui/button';
import {
  getTermsBrandLabel,
  getTermsDocumentLabel,
  getTermsServiceLabel,
  TERMS_BRAND_LABELS,
} from '@/lib/terms-labels';
import { cn } from '@/lib/utils';
import { useTermsAssetStore } from '@/stores/terms-asset-store';
import { useTermsFactStore } from '@/stores/terms-fact-store';
import type { Brand, Region } from '@/types/terms';

const BRANDS: { code: Brand; label: string }[] = [
  { code: 'hyundai', label: TERMS_BRAND_LABELS.hyundai },
  { code: 'kia', label: TERMS_BRAND_LABELS.kia },
  { code: 'genesis', label: TERMS_BRAND_LABELS.genesis },
];

const REGIONS: { code: Region | 'ALL'; label: string }[] = [
  { code: 'ALL', label: '전체' },
  { code: 'EU', label: 'EU' },
  { code: 'NA', label: '북미' },
  { code: 'IN', label: '인도' },
];

interface ProgressState {
  running: boolean;
  phase: string;
  current: number;
  total: number;
  succeeded: number;
  unchanged: number;
  failed: number;
  blocked: number;
  blockedUrls: string[];
  lastError?: string | null;
}

type FilterMode = 'service_family' | 'document_type' | 'asset_url';

const FILTER_MODES: { key: FilterMode; label: string }[] = [
  { key: 'service_family', label: '서비스군' },
  { key: 'document_type', label: '문서 타입' },
  { key: 'asset_url', label: 'URL' },
];

// 유럽 코어법인 코드 (중앙 법인 + 테크센터 + 모빌리티/커넥트 운영사). 그 외 EU 코드는 지역법인으로 간주.
const CORE_EU_ENTITY_CODES = new Set<string>(['HME', 'HME_TC', 'HCM', 'KEU', 'KCONNECT']);

type EntityTier = 'core' | 'regional';
const ENTITY_TIERS: { key: EntityTier; label: string }[] = [
  { key: 'core', label: '코어법인' },
  { key: 'regional', label: '지역법인' },
];

function entityTier(code: string): EntityTier {
  return CORE_EU_ENTITY_CODES.has(code) ? 'core' : 'regional';
}

export function TermsHubView() {
  const [params, setParams] = useSearchParams();
  const selectedEntity = params.get('market_entity');
  const selectedRegion = (params.get('region') as Region | 'ALL' | null) ?? 'ALL';
  const brandParam = params.get('brand') ?? '';
  const selectedBrands = useMemo(
    () => brandParam.split(',').filter(Boolean) as Brand[],
    [brandParam],
  );

  const { marketEntities, assets, fetchReferenceData, fetchAssets } = useTermsAssetStore();
  const { fetchBoard } = useTermsFactStore();

  const [progress, setProgress] = useState<ProgressState>({
    running: false,
    phase: '',
    current: 0,
    total: 0,
    succeeded: 0,
    unchanged: 0,
    failed: 0,
    blocked: 0,
    blockedUrls: [],
  });
  const [filterMode, setFilterMode] = useState<FilterMode>('service_family');
  const [selectedFilterKeys, setSelectedFilterKeys] = useState<string[]>([]);
  const [selectedTiers, setSelectedTiers] = useState<EntityTier[]>([]);
  const [manualOpen, setManualOpen] = useState(false);

  const showTierFilter = selectedRegion === 'EU';

  useEffect(() => {
    if (marketEntities.length === 0) {
      void fetchReferenceData().catch(() => null);
    }
  }, [fetchReferenceData, marketEntities.length]);

  // 전체 자산을 한 번에 로드. 개별 법인 선택 시엔 클라이언트 사이드로 필터.
  useEffect(() => {
    void fetchAssets().catch(() => null);
  }, [fetchAssets]);

  const entitiesWithAssets = useMemo(() => {
    const set = new Set<string>();
    for (const asset of assets) set.add(asset.market_entity);
    return set;
  }, [assets]);

  const visibleEntities = useMemo(
    () =>
      marketEntities.filter((entity) => {
        if (selectedBrands.length > 0 && !selectedBrands.includes(entity.brand)) return false;
        if (selectedRegion !== 'ALL' && entity.region !== selectedRegion) return false;
        // tier 필터: EU 또는 전체 지역일 때만 적용. EU 엔트리에만 tier 검사.
        if (showTierFilter && selectedTiers.length > 0 && entity.region === 'EU') {
          if (!selectedTiers.includes(entityTier(entity.code))) return false;
        }
        return true;
      }),
    [marketEntities, selectedBrands, selectedRegion, selectedTiers, showTierFilter],
  );

  const entityAssets = useMemo(
    () => assets.filter((asset) => asset.market_entity === selectedEntity),
    [assets, selectedEntity],
  );

  useEffect(() => {
    setSelectedFilterKeys([]);
  }, [selectedEntity]);

  useEffect(() => {
    if (!selectedEntity || visibleEntities.some((entity) => entity.code === selectedEntity)) {
      return;
    }

    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('market_entity');
      return next;
    });
    setSelectedFilterKeys([]);
  }, [selectedEntity, setParams, visibleEntities]);

  const filterOptions = useMemo(() => {
    if (filterMode === 'service_family') {
      const unique = Array.from(new Set(entityAssets.map((a) => a.service_family)));
      return unique.map((key) => ({ key, label: getTermsServiceLabel(key), hint: key }));
    }
    if (filterMode === 'document_type') {
      const unique = Array.from(new Set(entityAssets.map((a) => a.document_type)));
      return unique.map((key) => ({ key, label: getTermsDocumentLabel(key), hint: key }));
    }
    return entityAssets.map((a) => ({
      key: a.url,
      label: `${getTermsServiceLabel(a.service_family)} · ${getTermsDocumentLabel(a.document_type)}`,
      hint: a.url,
    }));
  }, [entityAssets, filterMode]);

  const handleToggleBrand = (code: Brand) => {
    const current = new Set(selectedBrands);
    if (current.has(code)) current.delete(code);
    else current.add(code);

    const nextBrands = BRANDS.map((item) => item.code).filter((value) => current.has(value));
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextBrands.length === 0) next.delete('brand');
      else next.set('brand', nextBrands.join(','));
      return next;
    });
  };

  const handleRegionChange = (region: Region | 'ALL') => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (region === 'ALL') next.delete('region');
      else next.set('region', region);
      return next;
    });
  };

  const handleSelectEntity = (code: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('market_entity', code);
      return next;
    });
  };

  const runAutoProcess = async () => {
    if (!selectedEntity || entityAssets.length === 0) return;

    const targets = entityAssets;
    setProgress({
      running: true,
      phase: '약관 수집 중',
      current: 0,
      total: targets.length,
      succeeded: 0,
      unchanged: 0,
      failed: 0,
      blocked: 0,
      blockedUrls: [],
      lastError: null,
    });

    let succeeded = 0;
    let unchanged = 0;
    let failed = 0;
    let blocked = 0;
    const blockedUrls: string[] = [];
    let lastError: string | null = null;

    for (let i = 0; i < targets.length; i += 1) {
      const asset = targets[i];
      setProgress((p) => ({ ...p, current: i, phase: `약관 수집 중 (${asset.document_type})` }));
      try {
        const captureRes = await fetch(`/api/terms/documents/capture/${asset.id}`, { method: 'POST' });
        if (!captureRes.ok) {
          const payload = await captureRes.json().catch(() => null);
          // robots 차단(-1), 원격 4xx/5xx, 파싱 실패 전부 "자동 수집 차단"으로 분류
          const isBlocked =
            payload?.blocked_by_robots === true ||
            (payload?.http_status != null && (payload.http_status === -1 || payload.http_status >= 400)) ||
            (captureRes.status >= 400 && captureRes.status < 600);
          if (isBlocked) {
            blocked += 1;
            blockedUrls.push(asset.url);
          } else {
            failed += 1;
          }
          lastError = payload?.error ?? `HTTP ${captureRes.status} (${asset.url})`;
          setProgress((p) => ({ ...p, failed, blocked, blockedUrls: [...blockedUrls], lastError }));
          continue;
        }
        const version = await captureRes.json();
        if (version && version.id && (version.change_kind === 'new' || version.change_kind === 'normalized_change')) {
          setProgress((p) => ({ ...p, phase: `분석 중 (${asset.document_type})` }));
          const extractRes = await fetch(`/api/terms/facts/extract/${version.id}`, { method: 'POST' });
          if (extractRes.ok) {
            succeeded += 1;
          } else {
            failed += 1;
            const payload = await extractRes.json().catch(() => null);
            lastError = payload?.error ?? `추출 실패 (${asset.url})`;
          }
          setProgress((p) => ({ ...p, succeeded, failed, lastError }));
        } else {
          unchanged += 1;
          setProgress((p) => ({ ...p, unchanged }));
        }
      } catch (error) {
        failed += 1;
        lastError = error instanceof Error ? error.message : '네트워크 오류';
        setProgress((p) => ({ ...p, failed, lastError }));
      }
    }

    setProgress((p) => ({ ...p, current: targets.length, phase: '보드 갱신 중' }));
    await Promise.all([
      fetchBoard(selectedEntity).catch(() => null),
      fetchAssets().catch(() => null),
    ]);
    setProgress({
      running: false,
      phase: '완료',
      current: targets.length,
      total: targets.length,
      succeeded,
      unchanged,
      failed,
      blocked,
      blockedUrls,
      lastError,
    });
  };

  return (
    <div className="space-y-5">
      {/* 법인 선택 */}
      <section className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground">브랜드</div>
            <div className="flex flex-wrap gap-4">
              {BRANDS.map((brand) => {
                const active = selectedBrands.includes(brand.code);
                return (
                  <label
                    key={brand.code}
                    className="flex cursor-pointer items-center gap-2 text-xs select-none"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => handleToggleBrand(brand.code)}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary accent-primary focus:ring-1 focus:ring-primary"
                    />
                    <span className={cn('transition-colors', active ? 'font-medium text-primary' : 'text-[#535356]')}>
                      {brand.label}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="text-[11px] text-muted-foreground">체크 없으면 전체</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground">지역</div>
            <div className="flex flex-wrap gap-1">
              {REGIONS.map((region) => {
                const active = selectedRegion === region.code;
                return (
                  <button
                    key={region.code}
                    type="button"
                    onClick={() => handleRegionChange(region.code)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      active
                        ? 'border-primary bg-[#F5F7F9] font-medium text-primary'
                        : 'border-[#EAEAEB] bg-white text-[#535356] hover:border-primary/40 hover:bg-[#F5F5F5]',
                    )}
                  >
                    {region.label}
                  </button>
                );
              })}
            </div>
          </div>

          {showTierFilter && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground">EU 구분</div>
              <div className="flex flex-wrap gap-4">
                {ENTITY_TIERS.map((tier) => {
                  const active = selectedTiers.includes(tier.key);
                  return (
                    <label
                      key={tier.key}
                      className="flex cursor-pointer items-center gap-2 text-xs select-none"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          setSelectedTiers((prev) =>
                            active ? prev.filter((k) => k !== tier.key) : [...prev, tier.key],
                          )
                        }
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className={cn('transition-colors', active ? 'font-medium text-primary' : 'text-[#535356]')}>
                        {tier.label}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">체크 없으면 전체</div>
            </div>
          )}

          <div className="flex flex-wrap items-start gap-3">
            <div className="pt-1 text-xs font-medium tracking-[0.2em] text-muted-foreground">법인</div>
            <div className="flex flex-1 flex-wrap gap-1">
              {visibleEntities.map((entity) => {
                const active = entity.code === selectedEntity;
                const hasAssets = entitiesWithAssets.has(entity.code);
                const strikeStyle = !hasAssets && !active
                  ? { backgroundImage: 'linear-gradient(to top right, transparent calc(50% - 1px), #B0B0B3 50%, transparent calc(50% + 1px))' }
                  : undefined;
                return (
                  <button
                    key={entity.code}
                    type="button"
                    onClick={() => handleSelectEntity(entity.code)}
                    style={strikeStyle}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                      active
                        ? 'border-primary bg-[#F5F7F9] font-medium text-primary'
                        : hasAssets
                          ? 'border-[#EAEAEB] bg-white text-[#535356] hover:border-primary/40 hover:bg-[#F5F5F5]'
                          : 'border-[#EAEAEB] bg-white text-[#929296] hover:border-primary/30',
                    )}
                    title={`${entity.display_name} · ${getTermsBrandLabel(entity.brand)}${hasAssets ? '' : ' (URL 미등록)'}`}
                  >
                    {entity.code}
                  </button>
                );
              })}
              {visibleEntities.length === 0 && (
                <div className="text-xs text-muted-foreground">이 조건에 맞는 법인이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {!selectedEntity && (
        <section className="rounded-2xl border border-dashed bg-white px-5 py-10 text-center">
          <div className="text-sm text-muted-foreground">위에서 법인을 선택하세요.</div>
        </section>
      )}

      {selectedEntity && (
        <>
          {/* 발견된 약관 + 자동 정리 실행 */}
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs tracking-[0.2em] text-primary">감지된 약관</div>
                <h2 className="mt-1 text-lg font-medium text-foreground">
                  {marketEntities.find((e) => e.code === selectedEntity)?.display_name ?? selectedEntity} ·{' '}
                  {entityAssets.length}건
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  아래 주소를 눌러 원문을 확인할 수 있고, [자동 정리]를 누르면 수집·분석해서 보드를 채웁니다.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setManualOpen(true)} disabled={progress.running}>
                  직접 약관 입력
                </Button>
                <Button onClick={() => void runAutoProcess()} disabled={progress.running || entityAssets.length === 0}>
                  {progress.running ? '처리 중…' : '자동 정리 실행'}
                </Button>
              </div>
            </div>

            {selectedEntity && (
              <ManualInputModal
                open={manualOpen}
                marketEntity={selectedEntity}
                onClose={() => setManualOpen(false)}
                onDone={() => {
                  void fetchAssets().catch(() => null);
                  void fetchBoard(selectedEntity).catch(() => null);
                }}
              />
            )}

            {progress.running && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <div className="flex items-center justify-between">
                  <span>{progress.phase}</span>
                  <span className="font-medium">
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
                {progress.lastError && <div className="mt-2 text-xs text-rose-700">최근 오류: {progress.lastError}</div>}
              </div>
            )}

            {!progress.running && progress.phase === '완료' && (
              <div className="mt-4 space-y-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <div className="font-medium">자동 정리 완료</div>
                  <div className="mt-1 text-xs text-emerald-800">
                    신규 분석 {progress.succeeded}건 · 변경 없음 {progress.unchanged}건
                    {progress.blocked > 0 && ` · 자동 수집 차단 ${progress.blocked}건`}
                    {progress.failed > 0 && ` · 실패 ${progress.failed}건`}
                  </div>
                </div>
                {progress.blocked > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="font-medium">사이트 측에서 자동 수집을 차단했습니다</div>
                    <div className="mt-1 text-xs text-amber-800">
                      원문을 직접 열어 PDF/HTML 로 저장한 뒤
                      <a
                        href={`/terms/documents/${entityAssets[0]?.id ?? ''}`}
                        className="mx-1 underline hover:text-amber-900"
                      >
                        수동 업로드
                      </a>
                      해 주시면 동일하게 분석이 진행됩니다.
                    </div>
                    {progress.blockedUrls.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-amber-900/80">
                        {progress.blockedUrls.slice(0, 4).map((url) => (
                          <li key={url} className="truncate">· {url}</li>
                        ))}
                        {progress.blockedUrls.length > 4 && (
                          <li>· 외 {progress.blockedUrls.length - 4}건</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
                {progress.failed > 0 && progress.lastError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                    마지막 오류: {progress.lastError}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 space-y-2">
              {entityAssets.map((asset) => (
                <a
                  key={asset.id}
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-[#F7FAFC]"
                >
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                    {getTermsServiceLabel(asset.service_family)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                    {getTermsDocumentLabel(asset.document_type)}
                  </span>
                  <span className="flex-1 truncate text-xs text-slate-600">{asset.url}</span>
                  <span className="text-xs text-primary">↗ 원문</span>
                </a>
              ))}
              {entityAssets.length === 0 && (
                <div className="rounded-xl border border-dashed bg-amber-50/40 px-4 py-6 text-center text-sm">
                  <div className="font-medium text-slate-900">등록된 약관 URL이 아직 없습니다</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    이 법인은 플레이스홀더로 추가된 상태입니다. 실제 사이트에 약관 페이지가 있다면
                    <br />
                    관리자 메뉴에서 URL을 등록한 뒤 자동 정리를 실행하세요.
                  </div>
                  <a
                    href={`/terms/admin/assets?market_entity=${encodeURIComponent(selectedEntity)}`}
                    className="mt-3 inline-block rounded-lg border border-primary bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-[#F5F7F9]"
                  >
                    관리자에서 URL 추가 →
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* 4컬럼 보드 */}
          <section>
            <div className="mb-3">
              <div className="text-xs tracking-[0.2em] text-primary">현황 보드</div>
              <h2 className="mt-1 text-xl font-medium text-foreground">분석된 처리/이전 현황</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ⚠ 표시는 신뢰도가 낮아 원문 재확인이 필요한 항목입니다. 카드를 누르면 근거 조항이 열립니다.
              </p>
            </div>

            <div className="mb-3 rounded-2xl border bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground">필터 기준</div>
                <div className="flex gap-1">
                  {FILTER_MODES.map((mode) => {
                    const active = filterMode === mode.key;
                    return (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => {
                          setFilterMode(mode.key);
                          setSelectedFilterKeys([]);
                        }}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          active
                            ? 'border-primary bg-primary text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40',
                        )}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>

                {selectedFilterKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFilterKeys([])}
                    className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-primary/40"
                  >
                    선택 해제 ({selectedFilterKeys.length})
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {filterOptions.length === 0 && (
                  <div className="text-xs text-muted-foreground">필터할 소스가 없습니다.</div>
                )}
                {filterOptions.map((opt) => {
                  const active = selectedFilterKeys.includes(opt.key);
                  return (
                    <label
                      key={opt.key}
                      className="flex max-w-full cursor-pointer items-center gap-2 text-xs select-none"
                      title={opt.hint ?? opt.label}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          setSelectedFilterKeys((prev) =>
                            active ? prev.filter((k) => k !== opt.key) : [...prev, opt.key],
                          )
                        }
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className={cn('truncate transition-colors', active ? 'font-medium text-primary' : 'text-slate-700')}>
                        {opt.label}
                      </span>
                    </label>
                  );
                })}
              </div>
              {filterOptions.length > 0 && (
                <div className="mt-2 text-[11px] text-muted-foreground">체크 없으면 전체</div>
              )}
            </div>

            <BoardView marketEntity={selectedEntity} filterBy={filterMode} selectedKeys={selectedFilterKeys} />
          </section>
        </>
      )}
    </div>
  );
}
