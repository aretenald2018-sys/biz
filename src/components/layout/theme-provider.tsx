'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'hyundai') {
      html.classList.add('hyundai-theme');
      html.classList.remove('dark');
    } else {
      html.classList.remove('hyundai-theme');
      html.classList.add('dark');
    }
  }, [theme]);

  return <>{children}</>;
}
