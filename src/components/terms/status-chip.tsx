'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatusChipProps {
  children: ReactNode;
  className?: string;
}

export function StatusChip({ children, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}
