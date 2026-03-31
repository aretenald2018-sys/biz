export interface EmailRecipient {
  name: string;
  email: string;
  type: 'to' | 'cc' | 'bcc';
}

export interface ParsedParticipant {
  name: string;
  email: string;
  title?: string;
  department?: string;
  organization?: string;
}

export interface Email {
  id: string;
  ticket_id: string;
  file_name: string;
  subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
  recipients: string | null; // JSON string of EmailRecipient[]
  cc_list: string | null; // JSON string of EmailRecipient[]
  body_text: string | null;
  body_html: string | null;
  sent_date: string | null;
  parsed_participants: string | null; // JSON string of ParsedParticipant[]
  created_at: string;
}

export interface ParsedEmail {
  subject: string | null;
  senderName: string | null;
  senderEmail: string | null;
  recipients: EmailRecipient[];
  ccList: EmailRecipient[];
  bodyText: string | null;
  bodyHtml: string | null;
  sentDate: string | null;
}
