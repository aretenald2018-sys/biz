'use client';

import { useEffect, useState } from 'react';
import { SearchBar } from '@/components/dashboard/search-bar';
import { useThemeStore } from '@/stores/theme-store';

export function Header() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const { theme, cycleTheme } = useThemeStore();

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

  /* ─── Hyundai: Navy #002C5F header ─── */
  if (theme === 'hyundai') {
    return (
      <header className="h-14 flex items-center justify-between px-8 relative z-10"
        style={{ background: '#002C5F', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ width: '224px' }} />
        <div className="flex-1 max-w-md mx-8">
          <SearchBar />
        </div>
        <div className="flex items-center gap-5">
          <button onClick={cycleTheme}
            className="text-[11px] px-3 py-1.5 rounded transition-all text-white/70 border border-white/20 hover:bg-white/10 hover:text-white"
            style={{ fontFamily: 'HyundaiSansTextKR, sans-serif' }}>
            KIA
          </button>
          <span className="text-[11px] text-white/50 hidden md:block" style={{ fontFamily: 'HyundaiSansTextKR, sans-serif' }}>{date}</span>
          <span className="text-[13px] text-white tabular-nums" style={{ fontFamily: 'HyundaiSansTextKR, sans-serif' }}>{time}</span>
        </div>
      </header>
    );
  }

  /* ─── KIA: Midnight Black #05141F header ─── */
  if (theme === 'kia') {
    return (
      <header className="h-12 flex items-center justify-between px-6 relative z-10"
        style={{ background: '#05141F', borderBottom: '1px solid rgba(158,161,162,0.15)' }}>
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-bold tracking-widest" style={{ color: '#F3C300' }}>KIA</span>
        </div>
        <SearchBar />
        <div className="flex items-center gap-4">
          <button onClick={cycleTheme}
            className="text-[10px] tracking-wider px-2.5 py-1 rounded border transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9EA1A2', borderColor: 'rgba(158,161,162,0.25)' }}>
            JARVIS
          </button>
          <div className="text-[10px] tracking-wider hidden md:block" style={{ color: '#9EA1A2' }}>{date}</div>
          <div className="text-[10px]" style={{ color: '#5D7D2B' }}>SYS: ONLINE</div>
          <div className="text-sm tabular-nums" style={{ color: '#F3C300', fontFamily: 'monospace' }}>{time}</div>
        </div>
      </header>
    );
  }

  /* ─── JARVIS (default) ─── */
  return (
    <header className="h-12 glass border-b border-border flex items-center justify-between px-6 relative z-10">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-neon-cyan neon-pulse" />
        <h1 className="text-sm font-bold tracking-widest text-neon-cyan text-glow-cyan uppercase">J.A.R.V.I.S</h1>
      </div>
      <SearchBar />
      <div className="flex items-center gap-4">
        <button onClick={cycleTheme}
          className="text-[10px] tracking-wider px-2.5 py-1 rounded border transition-all"
          style={{ background: 'rgba(94,196,212,0.1)', color: '#5ec4d4', borderColor: 'rgba(94,196,212,0.3)' }}>
          HYUNDAI
        </button>
        <div className="text-[10px] text-muted-foreground tracking-wider hidden md:block">{date}</div>
        <div className="text-xs text-muted-foreground">SYS: <span className="text-neon-green">ONLINE</span></div>
        <div className="text-sm font-mono text-neon-cyan text-glow-cyan tabular-nums">{time}</div>
      </div>
    </header>
  );
}
