'use client';

import { useEffect, useState } from 'react';
import { SearchBar } from '@/components/dashboard/search-bar';
import { useThemeStore } from '@/stores/theme-store';

export function Header() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ko-KR', { hour12: false }));
      setDate(now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-12 glass border-b border-border flex items-center justify-between px-6 relative z-10">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-neon-cyan neon-pulse" />
        <h1 className="text-sm font-bold tracking-widest text-neon-cyan text-glow-cyan uppercase">
          {theme === 'hyundai' ? 'HYUNDAI' : 'J.A.R.V.I.S'}
        </h1>
      </div>
      <SearchBar />
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="text-[10px] tracking-wider px-2.5 py-1 rounded border transition-all"
          style={theme === 'hyundai' ? {
            background: '#002c5f',
            color: '#ffffff',
            borderColor: '#00aad2',
          } : {
            background: 'rgba(94,196,212,0.1)',
            color: '#5ec4d4',
            borderColor: 'rgba(94,196,212,0.3)',
          }}
        >
          {theme === 'hyundai' ? 'JARVIS' : 'HYUNDAI'}
        </button>
        <div className="text-[10px] text-muted-foreground tracking-wider hidden md:block">
          {date}
        </div>
        <div className="text-xs text-muted-foreground">
          SYS: <span className="text-neon-green">ONLINE</span>
        </div>
        <div className="text-sm font-mono text-neon-cyan text-glow-cyan tabular-nums">
          {time}
        </div>
      </div>
    </header>
  );
}
