'use client';

import { KDP_CATEGORIES, KDP_CATEGORY_LABELS, type KdpCategory } from '@/types/kdp';

interface Props {
  value: KdpCategory | null;
  onChange: (v: KdpCategory | null) => void;
}

export function CategoryChips({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip active={value === null} onClick={() => onChange(null)}>전체</Chip>
      {KDP_CATEGORIES.map((c) => (
        <Chip key={c} active={value === c} onClick={() => onChange(value === c ? null : c)}>
          {KDP_CATEGORY_LABELS[c]}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs transition-colors"
      style={{
        fontFamily: 'HyundaiSansTextKR, sans-serif',
        borderColor: active ? '#002C5F' : '#EFEFF0',
        background: active ? '#002C5F' : '#FFFFFF',
        color: active ? '#FFFFFF' : '#535356',
      }}
    >
      {children}
    </button>
  );
}
