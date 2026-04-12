'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEmailStore } from '@/stores/email-store';
import { useNoteStore } from '@/stores/note-store';

export function EmailDropzone({ ticketId }: { ticketId: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [outlookHint, setOutlookHint] = useState<string | null>(null);
  const uploadEmail = useEmailStore((s) => s.uploadEmail);
  const createNote = useNoteStore((s) => s.createNote);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const showOutlookHint = useCallback((subject: string) => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setOutlookHint(subject);
    hintTimerRef.current = setTimeout(() => setOutlookHint(null), 6000);
  }, []);

  useEffect(() => () => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const dt = e.dataTransfer;

    // Collect files from dataTransfer
    let files = Array.from(dt.files);

    // Outlook drag-drop: may deliver files via dataTransfer.items instead of .files
    if (files.length === 0 && dt.items) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
    }

    // Filter: accept .msg, .eml, or Outlook-related MIME types
    const EMAIL_MIMES = ['message/rfc822', 'application/vnd.ms-outlook', 'application/octet-stream'];
    const accepted = files.filter((f) => {
      const name = f.name.toLowerCase();
      if (name.endsWith('.msg') || name.endsWith('.eml')) return true;
      if (EMAIL_MIMES.includes(f.type)) return true;
      if (!name.includes('.') && f.size > 0) return true;
      return false;
    });

    // Rename files with no/wrong extension so the parser can route correctly
    const normalized = accepted.map((f) => {
      const name = f.name.toLowerCase();
      if (name.endsWith('.msg') || name.endsWith('.eml')) return f;
      return new File([f], f.name + '.msg', { type: f.type });
    });

    // Outlook Web drag detected — show hint with subject
    if (normalized.length === 0) {
      if (dt.types.includes('multimaillistconversationrows')) {
        try {
          const raw = dt.getData('multimaillistconversationrows');
          const data = JSON.parse(raw);
          const subject = data.subjects?.[0] || '(제목 없음)';
          showOutlookHint(subject);
        } catch {
          showOutlookHint('(제목 없음)');
        }
      }
      return;
    }

    setUploading(true);
    for (const file of normalized) {
      await uploadEmail(ticketId, file);
    }
    setUploading(false);
  }, [ticketId, uploadEmail, showOutlookHint]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => f.name.toLowerCase().endsWith('.msg') || f.name.toLowerCase().endsWith('.eml')
    );
    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      await uploadEmail(ticketId, file);
    }
    setUploading(false);
    e.target.value = '';
  }, [ticketId, uploadEmail]);

  const handleCreateNote = useCallback(async () => {
    await createNote(ticketId, 'New Note');
  }, [ticketId, createNote]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        {/* Email Upload Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false); }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex-1 rounded-lg border-2 border-dashed p-5 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-neon-cyan bg-neon-cyan/5 glow-cyan'
              : 'border-border hover:border-neon-cyan/30'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".msg,.eml"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="text-lg mb-1 opacity-40">
            {uploading ? '⟳' : '✉'}
          </div>
          <p className="text-[10px] text-muted-foreground tracking-wider font-medium">
            {uploading ? 'PROCESSING...' : 'EMAIL UPLOAD'}
          </p>
          <p className="text-[9px] text-muted-foreground/50 mt-0.5">
            .msg / .eml 드래그 또는 클릭
          </p>
        </div>

        {/* Note Creation Button */}
        <button
          onClick={handleCreateNote}
          className="flex-1 rounded-lg border-2 border-dashed border-border p-5 text-center transition-all cursor-pointer hover:border-neon-magenta/30 hover:bg-neon-magenta/5"
        >
          <div className="text-lg mb-1 opacity-40">
            ✎
          </div>
          <p className="text-[10px] text-muted-foreground tracking-wider font-medium">
            NEW NOTE
          </p>
          <p className="text-[9px] text-muted-foreground/50 mt-0.5">
            클릭하여 노트 생성
          </p>
        </button>
      </div>

      {/* Outlook Web drag hint */}
      {outlookHint && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="font-medium text-amber-400 mb-1">
            아웃룩 웹에서 직접 드래그는 지원되지 않습니다
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground/70">
            「{outlookHint}」→ 메일 우클릭 또는 ⋯ 메뉴에서 <span className="text-foreground/80 font-medium">.eml 다운로드</span> 후 파일을 드래그하거나 클릭하여 업로드해 주세요.
          </p>
        </div>
      )}
    </div>
  );
}
