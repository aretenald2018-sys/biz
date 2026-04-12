import { GanttChart } from '@/components/gantt/gantt-chart';
import { KanbanBoard } from '@/components/kanban/kanban-board';

export default function TicketsPage() {
  return (
    <div className="space-y-8">
      <GanttChart />
      <KanbanBoard />
    </div>
  );
}
