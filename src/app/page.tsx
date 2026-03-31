import { StatsPanel } from '@/components/dashboard/stats-panel';
import { TicketTimeline } from '@/components/tickets/ticket-timeline';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <StatsPanel />
      <TicketTimeline />
    </div>
  );
}
