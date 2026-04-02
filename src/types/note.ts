export interface Note {
  id: string;
  ticket_id: string;
  title: string;
  content: string;
  parent_email_id: string | null;
  parent_note_id: string | null;
  created_at: string;
  updated_at: string;
}
