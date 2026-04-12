export interface TicketFileKanbanCategory {
  id: string;
  ticket_id: string;
  name: string;
  color: string;
  position: number;
  is_default: number;
  card_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TicketFileKanbanCard {
  id: string;
  ticket_id: string;
  category_id: string;
  email_attachment_id: string | null;
  file_name: string;
  description: string | null;
  position: number;
  source_email_id: string | null;
  source_email_subject: string | null;
  source_email_sender_name: string | null;
  source_email_sender_email: string | null;
  source_email_sent_date: string | null;
  file_type: string | null;
  file_size: number | null;
  is_image: number;
  content_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketFileKanbanCategoryInput {
  name: string;
  color?: string;
}

export interface UpdateTicketFileKanbanCategoryInput {
  name?: string;
  color?: string;
  position?: number;
  is_default?: number;
}

export interface CreateTicketFileKanbanCardInput {
  category_id: string;
  file_name?: string;
  description?: string | null;
  email_attachment_id?: string | null;
}

export interface UpdateTicketFileKanbanCardInput {
  category_id?: string;
  file_name?: string;
  description?: string | null;
  position?: number;
  email_attachment_id?: string | null;
}

export interface ReorderTicketFileKanbanCardInput {
  id: string;
  category_id: string;
  position: number;
}
