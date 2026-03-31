'use client';

import type { TicketStatus } from '@/types/ticket';

const statusConfig: Record<TicketStatus, { color: string; glowClass: string; label: string }> = {
  '신규': { color: 'text-neon-blue', glowClass: 'glow-cyan', label: '신규' },
  '진행중': { color: 'text-neon-cyan', glowClass: 'glow-cyan', label: '진행중' },
  '검토중': { color: 'text-neon-amber', glowClass: 'glow-amber', label: '검토중' },
  '종결': { color: 'text-neon-green', glowClass: 'glow-green', label: '종결' },
  '보류': { color: 'text-neon-magenta', glowClass: 'glow-magenta', label: '보류' },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] tracking-wider font-bold uppercase border border-current/20 ${config.color} badge-pulse`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
