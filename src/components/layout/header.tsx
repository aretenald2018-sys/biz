'use client';

import { useEffect, useState } from 'react';
import { SearchBar } from '@/components/dashboard/search-bar';

export function Header() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

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
    <header
      className="h-14 flex items-center justify-between px-8 relative z-10"
      style={{ background: '#002C5F', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
    >
      <div style={{ width: '224px' }} />
      <div className="flex-1 max-w-md mx-8">
        <SearchBar />
      </div>
      <div className="flex items-center gap-5">
        <span className="text-[11px] text-white/50 hidden md:block" style={{ fontFamily: 'HyundaiSansTextKR, sans-serif' }}>
          {date}
        </span>
        <span className="text-[13px] text-white tabular-nums" style={{ fontFamily: 'HyundaiSansTextKR, sans-serif' }}>
          {time}
        </span>
      </div>
    </header>
  );
}
