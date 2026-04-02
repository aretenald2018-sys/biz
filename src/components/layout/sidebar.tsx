'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/theme-store';

const navItems = [
  { href: '/', label: 'DASHBOARD', labelKo: '대시보드', icon: '◆', exact: true },
  { href: '/tickets', label: 'TICKETS', labelKo: '티켓 관리', icon: '▣', exact: false },
  { href: '/contracts', label: 'CONTRACTS', labelKo: '계약 현황', icon: '▤', exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const theme = useThemeStore((s) => s.theme);
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);

  useEffect(() => {
    fetch('/api/tickets/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, [pathname]);

  const isHyundai = theme === 'hyundai';
  const isKia = theme === 'kia';

  /* ─── Hyundai: White sidebar with navy accents ─── */
  if (isHyundai) {
    return (
      <aside className="w-56 flex flex-col py-5 relative z-10"
        style={{ background: '#FFFFFF', borderRight: '1px solid #EFEFF0' }}>
        {/* Section label */}
        <div className="px-4 mb-2">
          <span style={{ fontFamily: 'HyundaiSansTextKR, sans-serif', fontSize: '12px', fontWeight: 500, color: '#002C5F' }}>
            CDO 컴플라이언스그룹
          </span>
        </div>
        <nav className="flex flex-col gap-0">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center px-4 py-2.5 transition-all"
                style={{
                  fontFamily: 'HyundaiSansTextKR, sans-serif',
                  fontSize: '13px',
                  color: isActive ? '#002C5F' : '#535356',
                  fontWeight: isActive ? 500 : 400,
                  background: isActive ? '#F5F7F9' : 'transparent',
                  borderLeft: isActive ? '3px solid #002C5F' : '3px solid transparent',
                }}>
                {item.labelKo}
              </Link>
            );
          })}
        </nav>

        {stats && (
          <div className="mx-3 mt-8 space-y-2">
            <div className="text-[11px] px-4" style={{ color: '#929296', fontFamily: 'HyundaiSansTextKR, sans-serif' }}>
              현황
            </div>
            {['진행중', '검토중', '신규'].map(status => {
              const count = stats.byStatus[status] || 0;
              if (count === 0) return null;
              const colors: Record<string, string> = {
                '진행중': '#002C5F', '검토중': '#EC8E01', '신규': '#0672ED',
              };
              return (
                <div key={status} className="flex items-center justify-between px-4 py-2.5 rounded text-[12px]"
                  style={{ background: '#FAFAFB', border: '1px solid #EFEFF0', fontFamily: 'HyundaiSansTextKR, sans-serif' }}>
                  <span style={{ color: colors[status] }}>{status}</span>
                  <span style={{ color: '#121416', fontWeight: 500 }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto px-4 py-3" style={{ borderTop: '1px solid #EFEFF0' }}>
          <div className="text-[11px]" style={{ color: '#929296', fontFamily: 'HyundaiSansTextKR, sans-serif' }}>v0.1.0</div>
        </div>
      </aside>
    );
  }

  /* ─── KIA: Midnight Black sidebar ─── */
  if (isKia) {
    return (
      <aside className="w-56 flex flex-col py-4 relative z-10"
        style={{ background: '#030D14', borderRight: '1px solid rgba(158,161,162,0.12)' }}>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-wider transition-all ${
                  isActive
                    ? 'text-white bg-white/8 border border-white/10'
                    : 'text-[#9EA1A2] hover:text-white hover:bg-white/5 border border-transparent'
                }`}>
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {stats && (
          <div className="mx-3 mt-6 space-y-2">
            <div className="text-[9px] text-[#9EA1A2] tracking-widest px-1">STATUS</div>
            {['진행중', '검토중', '신규'].map(status => {
              const count = stats.byStatus[status] || 0;
              if (count === 0) return null;
              const colors: Record<string, string> = {
                '진행중': '#F3C300', '검토중': '#9EA1A2', '신규': '#5D7D2B',
              };
              return (
                <div key={status} className="flex items-center justify-between px-3 py-1.5 rounded text-[10px]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(158,161,162,0.1)' }}>
                  <span style={{ color: colors[status] }}>{status}</span>
                  <span className="text-white font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto px-3 py-3" style={{ borderTop: '1px solid rgba(158,161,162,0.1)' }}>
          <div className="text-[10px] text-[#838486] tracking-wider">v0.1.0</div>
        </div>
      </aside>
    );
  }

  /* ─── JARVIS (default) ─── */
  return (
    <aside className="w-56 glass border-r border-border flex flex-col py-4 relative z-10">
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-wider transition-all ${
                isActive
                  ? 'bg-neon-cyan/10 text-neon-cyan glow-cyan border border-neon-cyan/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
              }`}>
              <span className={`text-sm ${isActive ? 'text-glow-cyan' : ''}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {stats && (
        <div className="mx-3 mt-6 space-y-2">
          <div className="text-[9px] text-muted-foreground tracking-widest px-1">QUICK STATUS</div>
          {['진행중', '검토중', '신규'].map(status => {
            const count = stats.byStatus[status] || 0;
            if (count === 0) return null;
            const colors: Record<string, string> = {
              '진행중': 'text-neon-cyan', '검토중': 'text-neon-amber', '신규': 'text-neon-blue',
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
        <div className="text-[10px] text-muted-foreground tracking-wider">v0.1.0 // CLASSIFIED</div>
      </div>
    </aside>
  );
}
