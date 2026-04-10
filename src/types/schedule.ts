export interface Schedule {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  ticket_id: string | null;
  ticket_title?: string | null;
  ticket_status?: string | null;
  url: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  ticket_id?: string;
  url?: string;
  color?: string;
}

export interface UpdateScheduleInput {
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  ticket_id?: string | null;
  url?: string | null;
  color?: string;
}
