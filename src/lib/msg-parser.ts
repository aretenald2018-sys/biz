import MsgReader from '@kenjiuno/msgreader';
import type { ParsedEmail, EmailRecipient } from '@/types/email';

export function parseMsgFile(buffer: ArrayBuffer): ParsedEmail {
  const reader = new MsgReader(buffer);
  const fileData = reader.getFileData();

  const recipients: EmailRecipient[] = [];
  const ccList: EmailRecipient[] = [];

  if (fileData.recipients) {
    for (const r of fileData.recipients) {
      const recipient: EmailRecipient = {
        name: r.name || '',
        email: r.smtpAddress || r.email || '',
        type: 'to',
      };

      const recipType = String(r.recipType || '').toLowerCase();
      if (recipType === 'cc') {
        recipient.type = 'cc';
        ccList.push(recipient);
      } else if (recipType === 'bcc') {
        recipient.type = 'bcc';
      } else {
        recipients.push(recipient);
      }
    }
  }

  return {
    subject: fileData.subject || null,
    senderName: fileData.senderName || null,
    senderEmail: fileData.senderSmtpAddress || fileData.senderEmail || null,
    recipients,
    ccList,
    bodyText: fileData.body || null,
    bodyHtml: fileData.bodyHtml || null,
    sentDate: fileData.messageDeliveryTime || fileData.clientSubmitTime || null,
    attachments: [],
  };
}
