'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export function SlidePanel({
  open,
  onClose,
  children,
  width = 'max(600px, 70vw)',
}: SlidePanelProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-40 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      <button
        type="button"
        aria-label="Close panel backdrop"
        className="absolute inset-0 bg-background/70 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className={`absolute right-0 top-0 h-full border-l border-border bg-background/95 shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-xs tracking-[0.25em] text-muted-foreground">DETAIL VIEW</h3>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="h-[calc(100%-49px)] overflow-y-auto p-4">
          {children}
        </div>
      </aside>
    </div>
  );
}
