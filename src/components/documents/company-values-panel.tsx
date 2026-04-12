'use client';

import { AlertTriangle, CheckCircle2, Link2, ScanText, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { AnchorMatchStatus } from '@/types/document';
import { cn } from '@/lib/utils';

type CompanySide = 'left' | 'right';

export interface CompanyValuePlaceholder {
  key: string;
  occurrences: number;
  hasOriginal: boolean;
  hasAnchor: boolean;
  anchorStatus: AnchorMatchStatus | null;
  anchorMatches: number;
}

interface CompanyValuesPanelProps {
  placeholders: CompanyValuePlaceholder[];
  companyNames: Record<CompanySide, string>;
  values: Record<CompanySide, Record<string, string>>;
  onCompanyNameChange: (side: CompanySide, value: string) => void;
  onValueChange: (side: CompanySide, key: string, value: string) => void;
}

export function CompanyValuesPanel({
  placeholders,
  companyNames,
  values,
  onCompanyNameChange,
  onValueChange,
}: CompanyValuesPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        문서에서 <span className="font-mono text-primary">{'{{...}}'}</span> 로 표시된 자리에 아래 입력한 값이 들어갑니다.
        한 번에 두 회사 버전을 나란히 만들 수 있습니다.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">첫 번째 회사 이름</label>
          <Input
            value={companyNames.left}
            onChange={(event) => onCompanyNameChange('left', event.target.value)}
            placeholder="예: 현대자동차"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">두 번째 회사 이름</label>
          <Input
            value={companyNames.right}
            onChange={(event) => onCompanyNameChange('right', event.target.value)}
            placeholder="예: 기아"
          />
        </div>
      </div>

      {placeholders.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          채울 값이 아직 없어요.<br />
          위 미리보기에서 <span className="font-mono text-primary">{'{{회사명}}'}</span> 같은 표시를 넣어주세요.
          <div className="mt-1 text-[11px] text-muted-foreground/70">전각 <span className="font-mono">｛｛｝｝</span>, <span className="font-mono">&lt;회사명&gt;</span> 도 인식됩니다.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {placeholders.map((item) => (
            <div key={item.key} className="rounded-lg border bg-white px-4 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-primary">
                    {`{{${item.key}}}`}
                  </span>
                  <span className="text-xs text-muted-foreground">문서에서 {item.occurrences}곳</span>
                </div>
                <PlaceholderStatusBadges item={item} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{companyNames.left}에 넣을 값</label>
                  <Textarea
                    value={values.left[item.key] || ''}
                    onChange={(event) => onValueChange('left', item.key, event.target.value)}
                    className="min-h-20"
                    placeholder="실제 들어갈 내용을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{companyNames.right}에 넣을 값</label>
                  <Textarea
                    value={values.right[item.key] || ''}
                    onChange={(event) => onValueChange('right', item.key, event.target.value)}
                    className="min-h-20"
                    placeholder="실제 들어갈 내용을 입력하세요"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderStatusBadges({ item }: { item: CompanyValuePlaceholder }) {
  const statusIcon = item.anchorStatus === 'failed'
    ? <XCircle className="h-3 w-3" />
    : item.anchorStatus === 'conflict'
      ? <AlertTriangle className="h-3 w-3" />
      : item.anchorStatus === 'ready'
        ? <CheckCircle2 className="h-3 w-3" />
        : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.hasOriginal && (
        <Badge variant="outline" className="gap-1 border-primary/20 bg-secondary/60 text-primary" title="원본 워드 파일에 이미 들어 있어요">
          <ScanText className="h-3 w-3" />
          원본
        </Badge>
      )}
      {item.hasAnchor && (
        <Badge variant="outline" className="gap-1 border-info/20 bg-[var(--color-info-bg)] text-[var(--color-info)]" title="미리보기에서 새로 추가했어요">
          <Link2 className="h-3 w-3" />
          추가됨
        </Badge>
      )}
      {item.anchorStatus && (
        <Badge
          variant="outline"
          className={cn(
            'gap-1',
            item.anchorStatus === 'ready' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
            item.anchorStatus === 'conflict' && 'border-amber-200 bg-amber-50 text-amber-700',
            item.anchorStatus === 'failed' && 'border-rose-200 bg-rose-50 text-rose-700',
          )}
          title={item.anchorStatus === 'failed'
            ? '원본 문서에서 위치를 찾지 못했습니다. 미리보기에서 표시 위치를 다시 확인해주세요.'
            : item.anchorStatus === 'conflict'
              ? `같은 위치가 ${item.anchorMatches}곳에 있어 첫 번째 자리에 채워집니다.`
              : '바로 채울 준비가 되었습니다.'}
        >
          {statusIcon}
          {item.anchorStatus === 'ready' && '확인됨'}
          {item.anchorStatus === 'conflict' && '위치 중복'}
          {item.anchorStatus === 'failed' && '위치 못 찾음'}
        </Badge>
      )}
    </div>
  );
}
