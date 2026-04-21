'use client';

import { KDP_BRANDS, KDP_BRAND_LABELS, type KdpBrand } from '@/types/kdp';

interface BrandTabsProps {
  brand: KdpBrand;
  onBrandChange: (b: KdpBrand) => void;
}

export function BrandTabs({ brand, onBrandChange }: BrandTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="브랜드 선택"
      className="inline-flex items-center gap-1 rounded-full border p-1"
      style={{ borderColor: '#EFEFF0', background: '#FAFAFB' }}
    >
      {KDP_BRANDS.map((b) => {
        const active = b === brand;
        return (
          <button
            key={b}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onBrandChange(b)}
            className="rounded-full px-4 py-1.5 text-sm transition-colors"
            style={{
              fontFamily: 'HyundaiSansTextKR, sans-serif',
              fontWeight: active ? 500 : 400,
              color: active ? '#FFFFFF' : '#535356',
              background: active ? '#002C5F' : 'transparent',
            }}
          >
            {KDP_BRAND_LABELS[b]}
          </button>
        );
      })}
    </div>
  );
}
