'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useThemeStore } from '@/stores/theme-store';

interface SearchResult {
  type: 'ticket' | 'email';
  id: string;
  ticketId: string;
  title: string;
  subtitle: string;
  status?: string;
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const isHyundai = theme === 'hyundai';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setOpen(true);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    router.push(`/tickets/${result.ticketId}`);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isHyundai ? 'text-[#929296]' : 'text-muted-foreground'}`}>
          {loading ? '...' : isHyundai ? '🔍' : '>_'}
        </span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={isHyundai ? '티켓, 이메일 검색' : 'SEARCH TICKETS & EMAILS...'}
          className={isHyundai
            ? 'pl-9 bg-white/10 border-white/15 text-white text-[13px] h-9 placeholder:text-white/40 rounded focus:bg-white/15 focus:border-white/30'
            : 'pl-9 bg-white/5 border-border text-xs h-8 tracking-wider placeholder:text-muted-foreground/50'
          }
        />
      </div>

      {open && results.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg border z-50 max-h-64 overflow-y-auto ${
          isHyundai ? 'bg-white border-[#EFEFF0] shadow-lg' : 'glass border-border'
        }`}>
          {results.map((result, i) => (
            <button
              key={`${result.type}-${result.id}-${i}`}
              onClick={() => handleSelect(result)}
              className={`w-full text-left px-3 py-2.5 transition-colors border-b last:border-0 ${
                isHyundai
                  ? 'border-[#EFEFF0] hover:bg-[#F5F5F5]'
                  : 'border-border hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                  isHyundai
                    ? result.type === 'ticket'
                      ? 'text-[#002C5F] bg-[#EDF2FF]'
                      : 'text-[#00809E] bg-[#F0FCFF]'
                    : result.type === 'ticket'
                      ? 'text-neon-cyan border border-neon-cyan/30'
                      : 'text-neon-magenta border border-neon-magenta/30'
                }`}>
                  {result.type === 'ticket' ? '티켓' : '이메일'}
                </span>
                <span className={`truncate flex-1 ${isHyundai ? 'text-[13px] text-[#121416]' : 'text-xs text-foreground'}`}>{result.title}</span>
              </div>
              <div className={`mt-0.5 ml-12 truncate ${isHyundai ? 'text-[11px] text-[#69696E]' : 'text-[10px] text-muted-foreground'}`}>
                {result.subtitle}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && !loading && (
        <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg border z-50 p-3 ${
          isHyundai ? 'bg-white border-[#EFEFF0] shadow-lg' : 'glass border-border'
        }`}>
          <div className={`text-center ${isHyundai ? 'text-[12px] text-[#929296]' : 'text-xs text-muted-foreground tracking-wider'}`}>
            {isHyundai ? '검색 결과가 없습니다' : 'NO RESULTS FOUND'}
          </div>
        </div>
      )}
    </div>
  );
}
