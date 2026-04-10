import { GanttChart } from '@/components/gantt/gantt-chart';
import { TicketTimeline } from '@/components/tickets/ticket-timeline';

export default function TicketsPage() {
  return (
    <div className="space-y-8">
      <GanttChart />
      <TicketTimeline />
    </div>
  );
}
