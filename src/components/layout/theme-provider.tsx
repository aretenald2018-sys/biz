'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('hyundai-theme', 'kia-theme', 'dark');

    if (theme === 'hyundai') {
      html.classList.add('hyundai-theme');
    } else if (theme === 'kia') {
      html.classList.add('kia-theme');
    } else {
      html.classList.add('dark');
    }
  }, [theme]);

  return <>{children}</>;
}
