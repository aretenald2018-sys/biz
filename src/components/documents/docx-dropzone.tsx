'use client';

import { useMemo, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocxDropzoneProps {
  title: string;
  description: string;
  hint?: string;
  accept?: string;
  fileName?: string | null;
  loading?: boolean;
  onFileSelect: (file: File) => Promise<void> | void;
}

export function DocxDropzone({
  title,
  description,
  hint,
  accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  fileName,
  loading = false,
  onFileSelect,
}: DocxDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const disabled = useMemo(() => loading, [loading]);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];

    if (!file || disabled) {
      return;
    }

    await onFileSelect(file);
  }

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-xl border border-dashed px-5 py-6 text-left transition-colors',
        'bg-white hover:border-primary/40 hover:bg-secondary/70',
        isDragging && 'border-primary bg-secondary/80',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setIsDragging(true);
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void handleFiles(event.dataTransfer.files);
      }}
      disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-secondary p-2.5 text-primary">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="truncate text-xs text-muted-foreground">
            {fileName
              ? `📎 ${fileName}`
              : hint || '워드 파일(.docx)만 가능 · 최대 20MB'}
          </div>
        </div>
      </div>
    </button>
  );
}
