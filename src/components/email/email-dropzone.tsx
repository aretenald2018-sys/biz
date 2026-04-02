'use client';

import { useCallback, useState } from 'react';
import { useEmailStore } from '@/stores/email-store';
import { useNoteStore } from '@/stores/note-store';

export function EmailDropzone({ ticketId }: { ticketId: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadEmail = useEmailStore((s) => s.uploadEmail);
  const createNote = useNoteStore((s) => s.createNote);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.toLowerCase().endsWith('.msg') || f.name.toLowerCase().endsWith('.eml')
    );

    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      await uploadEmail(ticketId, file);
    }
    setUploading(false);
  }, [ticketId, uploadEmail]);

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
    <div className="flex gap-3">
      {/* Email Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex-1 rounded-lg border-2 border-dashed p-5 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-neon-cyan bg-neon-cyan/5 glow-cyan'
            : 'border-border hover:border-neon-cyan/30'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept=".msg,.eml"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
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
  );
}
