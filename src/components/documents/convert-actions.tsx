'use client';

import { Download, FileOutput, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocxAnchorStatus } from '@/types/document';

type ConvertMode = 'left' | 'right' | 'both';

interface ConvertActionsProps {
  disabled?: boolean;
  loading?: boolean;
  companyNames: {
    left: string;
    right: string;
  };
  anchorStatuses: DocxAnchorStatus[];
  onConvert: (mode: ConvertMode) => void;
}

export function ConvertActions({
  disabled = false,
  loading = false,
  companyNames,
  anchorStatuses,
  onConvert,
}: ConvertActionsProps) {
  const readyCount = anchorStatuses.filter((item) => item.status === 'ready').length;
  const conflictCount = anchorStatuses.filter((item) => item.status === 'conflict').length;
  const failedCount = anchorStatuses.filter((item) => item.status === 'failed').length;
  const hasStatus = anchorStatuses.length > 0;

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-5 py-4">
        <div className="text-sm font-medium text-foreground">파일 만들어 내려받기</div>
        <p className="mt-1 text-sm text-muted-foreground">위에 입력한 값으로 두 회사 버전 워드 파일을 생성합니다.</p>
      </div>

      <div className="space-y-4 p-4">
        {hasStatus && (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
              <div className="text-[11px] text-emerald-700">정상 채워짐</div>
              <div className="mt-0.5 text-base font-medium text-emerald-700">{readyCount}</div>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2.5">
              <div className="text-[11px] text-amber-700">위치 중복</div>
              <div className="mt-0.5 text-base font-medium text-amber-700">{conflictCount}</div>
            </div>
            <div className="rounded-lg bg-rose-50 px-3 py-2.5">
              <div className="text-[11px] text-rose-700">위치 못 찾음</div>
              <div className="mt-0.5 text-base font-medium text-rose-700">{failedCount}</div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Button
            type="button"
            className="w-full"
            disabled={disabled || loading}
            onClick={() => onConvert('both')}
          >
            <FileOutput className="h-4 w-4" />
            {loading ? '만드는 중…' : '두 회사 모두 만들기'}
          </Button>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={disabled || loading}
              onClick={() => onConvert('left')}
            >
              <Download className="h-4 w-4" />
              {companyNames.left}만
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={disabled || loading}
              onClick={() => onConvert('right')}
            >
              <Download className="h-4 w-4" />
              {companyNames.right}만
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
          <RefreshCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>입력한 내용은 자동 저장되며, 만들기 전에 한 번 더 반영됩니다. 원본 워드의 글꼴·표·서식은 그대로 보존됩니다.</span>
        </div>
      </div>
    </div>
  );
}
