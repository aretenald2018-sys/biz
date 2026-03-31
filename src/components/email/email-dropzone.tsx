'use client';

import { useCallback, useState } from 'react';
import { useEmailStore } from '@/stores/email-store';

export function EmailDropzone({ ticketId }: { ticketId: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadEmail = useEmailStore((s) => s.uploadEmail);

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

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
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
      <div className="text-2xl mb-2 opacity-40">
        {uploading ? '⟳' : '▼'}
      </div>
      <p className="text-xs text-muted-foreground tracking-wider">
        {uploading ? 'PROCESSING EMAIL DATA...' : 'DROP .MSG FILES HERE OR CLICK TO UPLOAD'}
      </p>
      <p className="text-[10px] text-muted-foreground/50 mt-1">
        .msg / .eml 파일 지원 — 드래그 앤 드롭 또는 클릭
      </p>
    </div>
  );
}
