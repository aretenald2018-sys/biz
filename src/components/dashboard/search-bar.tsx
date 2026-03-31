'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
          {loading ? '...' : '>_'}
        </span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="SEARCH TICKETS & EMAILS..."
          className="pl-9 bg-white/5 border-border text-xs h-8 tracking-wider placeholder:text-muted-foreground/50"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 glass rounded-lg border border-border z-50 max-h-64 overflow-y-auto">
          {results.map((result, i) => (
            <button
              key={`${result.type}-${result.id}-${i}`}
              onClick={() => handleSelect(result)}
              className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-border last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  result.type === 'ticket'
                    ? 'text-neon-cyan border-neon-cyan/30'
                    : 'text-neon-magenta border-neon-magenta/30'
                }`}>
                  {result.type === 'ticket' ? 'TKT' : 'EMAIL'}
                </span>
                <span className="text-xs text-foreground truncate flex-1">{result.title}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 ml-12 truncate">
                {result.subtitle}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 glass rounded-lg border border-border z-50 p-3">
          <div className="text-xs text-muted-foreground text-center tracking-wider">
            NO RESULTS FOUND
          </div>
        </div>
      )}
    </div>
  );
}
