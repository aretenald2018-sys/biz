import type { Ticket } from './ticket';

export interface KanbanCategory {
  id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanBoardColumn extends KanbanCategory {
  tickets: Ticket[];
}

export interface KanbanBoardView {
  categories: KanbanBoardColumn[];
}

export interface CreateKanbanCategoryInput {
  name: string;
  color?: string;
}

export interface UpdateKanbanCategoryInput {
  name?: string;
  color?: string;
  position?: number;
}

export interface ReorderKanbanTicketInput {
  ticketId: string;
  category_id: string;
  position: number;
}
