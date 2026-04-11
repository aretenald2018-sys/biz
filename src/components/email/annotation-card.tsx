'use client';

import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useAnnotationStore } from '@/stores/annotation-store';
import { getSelectionOffsets } from '@/lib/annotation-utils';
import type { Annotation, MetaAnnotation } from '@/types/annotation';
import { Button } from '@/components/ui/button';
import { MiniRichEditor, RichContent } from '@/components/ui/rich-editor';
import { ANNOTATION_COLORS } from '@/components/email/email-viewer-utils';
import { AttachmentList } from '@/components/email/email-attachment-stack';

export function splitNoteByMetas(text: string, metas: MetaAnnotation[]): { text: string; metaId?: string }[] {
  if (metas.length === 0) return [{ text }];
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);
  for (const meta of metas) {
    boundaries.add(Math.max(0, meta.start_offset));
    boundaries.add(Math.min(text.length, meta.end_offset));
  }

  const sorted = [...boundaries].sort((a, b) => a - b);
  const segments: { text: string; metaId?: string }[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const coveringMeta = metas.find((meta) => meta.start_offset <= start && meta.end_offset >= end);
    segments.push({ text: text.substring(start, end), metaId: coveringMeta?.id });
  }
  return segments;
}

export function AnnotationCard({
  annotation,
  isActive,
  ticketId,
  onActivate,
  cardRef,
  metaHighlightRefs,
}: {
  annotation: Annotation;
  isActive: boolean;
  ticketId: string;
  onActivate: () => void;
  cardRef: (element: HTMLDivElement | null) => void;
  metaHighlightRefs: MutableRefObject<Map<string, HTMLElement>>;
}) {
  const [editing, setEditing] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const noteRef = useRef<HTMLDivElement>(null);
  const [metaSelectionData, setMetaSelectionData] = useState<{ start: number; end: number; text: string } | null>(null);
  const [metaNoteHtml, setMetaNoteHtml] = useState('');
  const [metaColor, setMetaColor] = useState(ANNOTATION_COLORS[1].border);

  const {
    updateAnnotation,
    deleteAnnotation,
    createMetaAnnotation,
    toggleResolveAnnotation,
    activeMetaAnnotation,
    setActiveMetaAnnotation,
  } = useAnnotationStore();

  const isResolved = !!annotation.resolved;
  const colorPreset = ANNOTATION_COLORS.find((color) => color.border === annotation.color) || ANNOTATION_COLORS[0];
  const metaAnnotations = annotation.meta_annotations || [];
  const attachments = annotation.attachments || [];

  const handleSaveEdit = async () => {
    if (!editHtml.trim() || editHtml === '<p></p>') return;
    await updateAnnotation(ticketId, annotation.id, { note: editHtml });
    setEditing(false);
  };

  const handleNoteMouseUp = useCallback(() => {
    if (!noteRef.current) return;
    setMetaSelectionData(getSelectionOffsets(noteRef.current));
  }, []);

  const handleCreateMeta = async () => {
    if (!metaSelectionData || !metaNoteHtml.trim() || metaNoteHtml === '<p></p>') return;
    await createMetaAnnotation(ticketId, annotation.id, {
      start_offset: metaSelectionData.start,
      end_offset: metaSelectionData.end,
      selected_text: metaSelectionData.text,
      note: metaNoteHtml,
      color: metaColor,
    });
    setMetaSelectionData(null);
    setMetaNoteHtml('');
  };

  const noteSegments = splitNoteByMetas(annotation.note, metaAnnotations);

  return (
    <div
      ref={cardRef}
      className={`rounded-lg transition-all ${isResolved ? 'opacity-60' : ''} ${isActive ? 'ring-1 shadow-md' : 'hover:shadow-sm'}`}
      style={{
        borderLeft: `3px solid ${isResolved ? '#6b7a8d' : colorPreset.border}`,
        boxShadow: isActive && !isResolved ? `0 0 12px ${colorPreset.border}40` : undefined,
        backgroundColor: isResolved ? 'rgba(40,44,56,0.5)' : undefined,
      }}
      onClick={onActivate}
    >
      <div className="p-3 bg-card rounded-tr-lg rounded-br-lg" style={isResolved ? { background: 'rgba(40,44,56,0.5)' } : undefined}>
        <div className={`text-[10px] text-muted-foreground truncate mb-1.5 italic ${isResolved ? 'line-through' : ''}`}>
          &ldquo;{annotation.selected_text.substring(0, 60)}{annotation.selected_text.length > 60 ? '...' : ''}&rdquo;
        </div>

        {editing ? (
          <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
            <MiniRichEditor content={annotation.note} onChange={setEditHtml} onSubmit={handleSaveEdit} placeholder="메모 편집..." autoFocus />
            <div className="flex gap-1">
              <Button onClick={handleSaveEdit} className="text-[10px] h-6 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">SAVE</Button>
              <Button onClick={() => setEditing(false)} variant="ghost" className="text-[10px] h-6 px-2 text-muted-foreground">CANCEL</Button>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={noteRef}
              onMouseUp={handleNoteMouseUp}
              className={`text-xs leading-relaxed select-text cursor-text ${isResolved ? 'line-through text-muted-foreground' : 'text-foreground'}`}
            >
              {noteSegments.map((segment, index) => {
                if (segment.metaId) {
                  const meta = metaAnnotations.find((item) => item.id === segment.metaId);
                  const metaColorValue = meta?.color || ANNOTATION_COLORS[1].border;
                  const preset = ANNOTATION_COLORS.find((color) => color.border === metaColorValue) || ANNOTATION_COLORS[1];
                  const isMetaActive = activeMetaAnnotation === segment.metaId;
                  return (
                    <mark
                      key={`${segment.metaId}-${index}`}
                      ref={(element) => {
                        if (element && segment.metaId) metaHighlightRefs.current.set(segment.metaId, element);
                      }}
                      style={{
                        backgroundColor: isMetaActive ? preset.bg.replace(/[\d.]+\)$/, '0.6)') : preset.bg,
                        borderBottom: `2px solid ${preset.border}`,
                        borderRadius: '1px',
                        cursor: 'pointer',
                        color: 'var(--color-soft-primary)',
                        padding: '0 1px',
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveMetaAnnotation(isMetaActive ? null : segment.metaId!);
                      }}
                    >
                      <RichContent html={segment.text} />
                    </mark>
                  );
                }
                return <RichContent key={`${annotation.id}-${index}`} html={segment.text} />;
              })}
            </div>
            <AttachmentList attachments={attachments} ticketId={ticketId} parentType="annotation" parentId={annotation.id} />
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleResolveAnnotation(ticketId, annotation.id);
                }}
                className={`text-[10px] transition-colors ${isResolved ? 'text-neon-green hover:text-neon-green/70' : 'text-muted-foreground hover:text-neon-green'}`}
              >
                {isResolved ? '✓ RESOLVED' : 'RESOLVE'}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(true);
                  setEditHtml(annotation.note);
                }}
                className="text-[10px] text-muted-foreground hover:text-accent-primary transition-colors"
              >
                EDIT
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteAnnotation(ticketId, annotation.id);
                }}
                className="text-[10px] text-muted-foreground hover:text-accent-red transition-colors"
              >
                DEL
              </button>
            </div>
          </>
        )}

        {metaSelectionData && isActive && (
          <div className="mt-2 pt-2 border-t border-border" onClick={(event) => event.stopPropagation()}>
            <div className="text-[9px] text-accent-primary tracking-wider mb-1 font-medium">NEW 메메모</div>
            <div className="text-[9px] text-muted-foreground italic mb-1.5 truncate">
              &ldquo;{metaSelectionData.text.substring(0, 60)}{metaSelectionData.text.length > 60 ? '...' : ''}&rdquo;
            </div>
            <div className="flex gap-1 mb-1.5">
              {ANNOTATION_COLORS.map((color) => (
                <button
                  key={color.border}
                  type="button"
                  onClick={() => setMetaColor(color.border)}
                  className={`w-4 h-4 rounded-full border-2 transition-transform ${metaColor === color.border ? 'scale-125 border-white/60' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: color.border }}
                  title={color.label}
                />
              ))}
            </div>
            <MiniRichEditor content="" onChange={setMetaNoteHtml} onSubmit={handleCreateMeta} placeholder="메메모 작성..." autoFocus />
            <div className="flex gap-1 mt-1.5">
              <Button onClick={handleCreateMeta} className="text-[10px] h-6 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">SAVE</Button>
              <Button onClick={() => setMetaSelectionData(null)} variant="ghost" className="text-[10px] h-6 px-2 text-muted-foreground">CANCEL</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
