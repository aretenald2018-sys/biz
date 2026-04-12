'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useThemeStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('kia-theme', 'dark');
    html.classList.add('hyundai-theme');
  }, []);

  return <>{children}</>;
}
