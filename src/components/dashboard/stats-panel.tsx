'use client';

import { useEffect, useState } from 'react';

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  emailCount: number;
  recentTickets: { id: string; title: string; status: string; created_at: string }[];
}

const statusColors: Record<string, string> = {
  '신규': 'text-neon-blue',
  '진행중': 'text-neon-cyan',
  '검토중': 'text-neon-amber',
  '종결': 'text-neon-green',
  '보류': 'text-neon-magenta',
};

export function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/tickets/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-lg p-4 border border-border animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const statCards = [
    { label: 'TOTAL TICKETS', value: stats.total, color: 'text-neon-cyan', glow: 'text-glow-cyan' },
    { label: 'ACTIVE', value: (stats.byStatus['진행중'] || 0) + (stats.byStatus['검토중'] || 0), color: 'text-neon-amber', glow: '' },
    { label: 'EMAILS', value: stats.emailCount, color: 'text-neon-magenta', glow: 'text-glow-magenta' },
    { label: 'CLOSED', value: stats.byStatus['종결'] || 0, color: 'text-neon-green', glow: '' },
  ];

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="glass rounded-lg p-4 border border-border hover:border-neon-cyan/20 transition-all">
            <div className="text-[10px] text-muted-foreground tracking-widest mb-2">
              {card.label}
            </div>
            <div className={`text-2xl font-bold ${card.color} ${card.glow}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="glass rounded-lg p-4 border border-border">
        <div className="text-[10px] text-muted-foreground tracking-widest mb-3">
          STATUS DISTRIBUTION
        </div>
        <div className="flex gap-2 flex-wrap">
          {['신규', '진행중', '검토중', '종결', '보류'].map((status) => {
            const count = stats.byStatus[status] || 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={status} className="flex items-center gap-2 px-3 py-1.5 rounded glass-light border border-border">
                <span className={`text-xs font-bold ${statusColors[status]}`}>{status}</span>
                <span className="text-xs text-foreground">{count}</span>
                <span className="text-[10px] text-muted-foreground">({pct}%)</span>
              </div>
            );
          })}
        </div>
        {stats.total > 0 && (
          <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-white/5">
            {['신규', '진행중', '검토중', '종결', '보류'].map((status) => {
              const count = stats.byStatus[status] || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const colors: Record<string, string> = {
                '신규': 'bg-neon-blue',
                '진행중': 'bg-neon-cyan',
                '검토중': 'bg-neon-amber',
                '종결': 'bg-neon-green',
                '보류': 'bg-neon-magenta',
              };
              if (pct === 0) return null;
              return (
                <div
                  key={status}
                  className={`${colors[status]} opacity-60`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
