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
  parent_note_id: string | null;
  parent_email_id: string | null;
  created_at: string;
  email_attachments?: EmailAttachment[];
}

export interface ParsedEmailAttachment {
  fileName: string;
  content: Buffer;
  contentType: string;
  contentId?: string;
  size: number;
}

export interface EmailAttachment {
  id: string;
  email_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  is_image: number;
  content_id: string | null;
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
  attachments: ParsedEmailAttachment[];
}
