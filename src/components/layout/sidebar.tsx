'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/', label: 'DASHBOARD', icon: '◆', exact: true },
  { href: '/tickets', label: 'TICKETS', icon: '▣', exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);

  useEffect(() => {
    fetch('/api/tickets/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, [pathname]);

  return (
    <aside className="w-56 glass border-r border-border flex flex-col py-4 relative z-10">
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-wider transition-all ${
                isActive
                  ? 'bg-neon-cyan/10 text-neon-cyan glow-cyan border border-neon-cyan/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={`text-sm ${isActive ? 'text-glow-cyan' : ''}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Quick Stats */}
      {stats && (
        <div className="mx-3 mt-6 space-y-2">
          <div className="text-[9px] text-muted-foreground tracking-widest px-1">
            QUICK STATUS
          </div>
          {['진행중', '검토중', '신규'].map(status => {
            const count = stats.byStatus[status] || 0;
            if (count === 0) return null;
            const colors: Record<string, string> = {
              '진행중': 'text-neon-cyan',
              '검토중': 'text-neon-amber',
              '신규': 'text-neon-blue',
            };
            return (
              <div key={status} className="flex items-center justify-between px-3 py-1.5 rounded glass-light border border-border text-[10px]">
                <span className={colors[status]}>{status}</span>
                <span className="text-foreground font-bold">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto px-3 py-3 border-t border-border">
        <div className="text-[10px] text-muted-foreground tracking-wider">
          v0.1.0 // CLASSIFIED
        </div>
      </div>
    </aside>
  );
}
