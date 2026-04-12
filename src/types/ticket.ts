export type TicketStatus = '신규' | '진행중' | '검토중' | '종결' | '보류';

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  ai_summary: string | null;
  category_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  email_count?: number;
}

export interface CreateTicketInput {
  title: string;
  description?: string;
  status?: TicketStatus;
  category_id?: string;
  position?: number;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  status?: TicketStatus;
  ai_summary?: string;
  category_id?: string | null;
  position?: number;
}
