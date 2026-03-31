'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { useTicketStore } from '@/stores/ticket-store';

export function AISummaryPanel({ ticketId, summary }: { ticketId: string; summary: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchTicket = useTicketStore((s) => s.fetchTicket);

  const handleSummarize = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tickets/${ticketId}/summarize`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate summary');
      } else {
        await fetchTicket(ticketId);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-lg border border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-xs font-bold tracking-widest text-neon-cyan text-glow-cyan">
          AI ANALYSIS
        </h3>
        <Button
          onClick={handleSummarize}
          disabled={loading}
          className="bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/30 hover:bg-neon-magenta/20 text-[10px] tracking-wider h-7 px-3"
        >
          {loading ? 'ANALYZING...' : summary ? 'REFRESH' : 'GENERATE SUMMARY'}
        </Button>
      </div>

      <div className="p-4">
        {error && (
          <div className="text-neon-red text-xs p-3 rounded bg-neon-red/5 border border-neon-red/20 mb-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-neon-magenta neon-pulse text-xs tracking-widest">
              PROCESSING INTELLIGENCE DATA...
            </div>
          </div>
        ) : summary ? (
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed
            [&_h2]:text-neon-cyan [&_h2]:text-xs [&_h2]:tracking-widest [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-glow-cyan
            [&_ul]:space-y-1 [&_li]:text-muted-foreground
            [&_strong]:text-foreground
            [&_p]:text-muted-foreground">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-xs tracking-wider">
            NO ANALYSIS AVAILABLE — CLICK GENERATE TO START
          </div>
        )}
      </div>
    </div>
  );
}
