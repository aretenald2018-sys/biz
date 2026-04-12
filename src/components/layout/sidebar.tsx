'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/tickets', label: 'TICKETS', labelKo: '티켓 관리', icon: '▣', exact: false },
  { href: '/contracts', label: 'CONTRACTS', labelKo: '계약 현황', icon: '▤', exact: false },
  { href: '/documents', label: 'DOCUMENTS', labelKo: '표준문서', icon: '▥', exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/tickets/stats', { signal: controller.signal })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, [pathname]);

  return (
    <aside className="w-56 flex flex-col py-5 relative z-10" style={{ background: '#FFFFFF', borderRight: '1px solid #EFEFF0' }}>
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
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-4 py-2.5 transition-all"
              style={{
                fontFamily: 'HyundaiSansTextKR, sans-serif',
                fontSize: '13px',
                color: isActive ? '#002C5F' : '#535356',
                fontWeight: isActive ? 500 : 400,
                background: isActive ? '#F5F7F9' : 'transparent',
                borderLeft: isActive ? '3px solid #002C5F' : '3px solid transparent',
              }}
            >
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
              <div
                key={status}
                className="flex items-center justify-between px-4 py-2.5 rounded text-[12px]"
                style={{ background: '#FAFAFB', border: '1px solid #EFEFF0', fontFamily: 'HyundaiSansTextKR, sans-serif' }}
              >
                <span style={{ color: colors[status] }}>{status}</span>
                <span style={{ color: '#121416', fontWeight: 500 }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto px-4 py-3" style={{ borderTop: '1px solid #EFEFF0' }}>
        <div className="text-[11px]" style={{ color: '#929296', fontFamily: 'HyundaiSansTextKR, sans-serif' }}>
          v0.1.0
        </div>
      </div>
    </aside>
  );
}
