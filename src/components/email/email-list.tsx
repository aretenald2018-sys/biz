'use client';

import { useEffect, useState } from 'react';
import { useEmailStore } from '@/stores/email-store';
import { EmailViewer } from './email-viewer';
import type { Email } from '@/types/email';

export function EmailList({ ticketId }: { ticketId: string }) {
  const { emails, selectedEmail, loading, fetchEmails, selectEmail, deleteEmail } = useEmailStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchEmails(ticketId);
  }, [ticketId, fetchEmails]);

  if (loading) {
    return (
      <div className="text-center py-8 text-neon-cyan neon-pulse text-xs tracking-widest">
        LOADING EMAILS...
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="glass rounded-lg p-6 text-center border border-dashed border-border">
        <p className="text-muted-foreground text-xs tracking-wider">NO EMAILS ATTACHED</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Email list */}
      <div className="space-y-2">
        {emails.map((email: Email) => (
          <div
            key={email.id}
            className={`glass rounded-lg p-3 cursor-pointer transition-all border ${
              selectedEmail?.id === email.id
                ? 'border-neon-cyan/40 glow-cyan bg-neon-cyan/5'
                : 'border-border hover:border-neon-cyan/20'
            }`}
            onClick={() => selectEmail(selectedEmail?.id === email.id ? null : email)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">
                  {email.subject || '(No Subject)'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                  <span>FROM: {email.sender_name || email.sender_email || 'Unknown'}</span>
                  {email.sent_date && <span>| {email.sent_date}</span>}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirmDelete === email.id) {
                    deleteEmail(ticketId, email.id);
                    setConfirmDelete(null);
                  } else {
                    setConfirmDelete(email.id);
                    setTimeout(() => setConfirmDelete(null), 3000);
                  }
                }}
                className={`text-[10px] px-2 py-1 rounded transition-all ${
                  confirmDelete === email.id
                    ? 'text-neon-red bg-neon-red/10 border border-neon-red/30'
                    : 'text-muted-foreground hover:text-neon-red'
                }`}
              >
                {confirmDelete === email.id ? 'CONFIRM?' : 'DEL'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Email Viewer */}
      {selectedEmail && (
        <EmailViewer email={selectedEmail} ticketId={ticketId} />
      )}
    </div>
  );
}
