'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Email } from '@/types/email';
import type { EmailRecipient } from '@/types/email';
import type { Annotation, MetaAnnotation, MetaAnnotationReply, Attachment } from '@/types/annotation';
import { useAnnotationStore } from '@/stores/annotation-store';
import { splitTextByAnnotations, getSelectionOffsets } from '@/lib/annotation-utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MiniRichEditor, RichContent } from '@/components/ui/rich-editor';

const ANNOTATION_COLORS = [
  { bg: 'rgba(255, 220, 100, 0.35)', border: '#ffd54f', label: 'Yellow' },
  { bg: 'rgba(100, 220, 255, 0.30)', border: '#4dd0e1', label: 'Cyan' },
  { bg: 'rgba(255, 150, 200, 0.30)', border: '#f48fb1', label: 'Pink' },
  { bg: 'rgba(150, 255, 150, 0.30)', border: '#81c784', label: 'Green' },
  { bg: 'rgba(200, 170, 255, 0.30)', border: '#b39ddb', label: 'Purple' },
];

function getAnnotationStyle(color: string, isActive: boolean) {
  const preset = ANNOTATION_COLORS.find(c => c.border === color) || ANNOTATION_COLORS[0];
  return {
    backgroundColor: isActive ? preset.bg.replace(/[\d.]+\)$/, '0.55)') : preset.bg,
    borderBottom: `3px solid ${preset.border}`,
    borderRadius: '2px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    padding: '1px 0',
    color: 'var(--color-soft-primary)',
  };
}

/* ─── SVG Connector Lines — solid chevron (꺾쇠) from highlight top-right ─── */
function ConnectorLines({
  containerRef,
  highlightRefs,
  cardRefs,
  annotations,
  activeAnnotation,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  highlightRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  annotations: Annotation[];
  activeAnnotation: string | null;
}) {
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string; active: boolean; id: string }[]>([]);

  const updateLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof lines = [];

    for (const ann of annotations) {
      const highlight = highlightRefs.current.get(ann.id);
      const card = cardRefs.current.get(ann.id);
      if (!highlight || !card) continue;

      const hRect = highlight.getBoundingClientRect();
      const cRect = card.getBoundingClientRect();

      // Start: top-right corner of highlight
      const x1 = hRect.right - containerRect.left;
      const y1 = hRect.top - containerRect.top;

      // End: left edge of card, near top
      const x2 = cRect.left - containerRect.left;
      const y2 = cRect.top + 12 - containerRect.top;

      const preset = ANNOTATION_COLORS.find(c => c.border === ann.color) || ANNOTATION_COLORS[0];
      newLines.push({ x1, y1, x2, y2, color: preset.border, active: activeAnnotation === ann.id, id: ann.id });
    }
    setLines(newLines);
  }, [containerRef, highlightRefs, cardRefs, annotations, activeAnnotation]);

  useEffect(() => {
    updateLines();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(updateLines);
    observer.observe(container);
    const scrollables = container.querySelectorAll('[style*="max-height"]');
    scrollables.forEach(el => el.addEventListener('scroll', updateLines));
    window.addEventListener('resize', updateLines);
    const interval = setInterval(updateLines, 250);
    return () => {
      observer.disconnect();
      scrollables.forEach(el => el.removeEventListener('scroll', updateLines));
      window.removeEventListener('resize', updateLines);
      clearInterval(interval);
    };
  }, [updateLines]);

  if (lines.length === 0) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      {lines.map(l => {
        // Chevron path: diagonal from highlight top-right, then diagonal to card
        // Using a single angled line (꺾쇠) with a bend point
        const midX = l.x1 + (l.x2 - l.x1) * 0.35;
        const midY = l.y2;

        return (
          <g key={l.id}>
            {/* Glow effect for active */}
            {l.active && (
              <path
                d={`M ${l.x1} ${l.y1} L ${midX} ${midY} L ${l.x2} ${l.y2}`}
                fill="none"
                stroke={l.color}
                strokeWidth={6}
                opacity={0.15}
              />
            )}
            {/* Main solid chevron line */}
            <path
              d={`M ${l.x1} ${l.y1} L ${midX} ${midY} L ${l.x2} ${l.y2}`}
              fill="none"
              stroke={l.color}
              strokeWidth={l.active ? 2.2 : 1.4}
              opacity={l.active ? 0.9 : 0.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Start dot at highlight top-right */}
            <circle
              cx={l.x1} cy={l.y1}
              r={l.active ? 4 : 3}
              fill={l.color}
              opacity={l.active ? 0.9 : 0.55}
            />
            {/* Arrow tip at card */}
            <polygon
              points={`${l.x2},${l.y2} ${l.x2 - 7},${l.y2 - 4} ${l.x2 - 7},${l.y2 + 4}`}
              fill={l.color}
              opacity={l.active ? 0.9 : 0.55}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Meta Connector Lines ─── */
function MetaConnectorLines({
  containerRef,
  metaHighlightRefs,
  metaCardRefs,
  metas,
  activeMetaAnnotation,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  metaHighlightRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  metaCardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  metas: MetaAnnotation[];
  activeMetaAnnotation: string | null;
}) {
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string; active: boolean; id: string }[]>([]);

  const updateLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof lines = [];

    for (const m of metas) {
      const highlight = metaHighlightRefs.current.get(m.id);
      const card = metaCardRefs.current.get(m.id);
      if (!highlight || !card) continue;

      const hRect = highlight.getBoundingClientRect();
      const cRect = card.getBoundingClientRect();

      const x1 = hRect.right - containerRect.left;
      const y1 = hRect.top - containerRect.top;
      const x2 = cRect.left - containerRect.left;
      const y2 = cRect.top + 10 - containerRect.top;

      const preset = ANNOTATION_COLORS.find(c => c.border === m.color) || ANNOTATION_COLORS[1];
      newLines.push({ x1, y1, x2, y2, color: preset.border, active: activeMetaAnnotation === m.id, id: m.id });
    }
    setLines(newLines);
  }, [containerRef, metaHighlightRefs, metaCardRefs, metas, activeMetaAnnotation]);

  useEffect(() => {
    updateLines();
    const interval = setInterval(updateLines, 250);
    window.addEventListener('resize', updateLines);
    return () => { clearInterval(interval); window.removeEventListener('resize', updateLines); };
  }, [updateLines]);

  if (lines.length === 0) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      {lines.map(l => {
        const midX = l.x1 + (l.x2 - l.x1) * 0.4;
        const midY = l.y2;
        return (
          <g key={l.id}>
            <path
              d={`M ${l.x1} ${l.y1} L ${midX} ${midY} L ${l.x2} ${l.y2}`}
              fill="none" stroke={l.color}
              strokeWidth={l.active ? 1.8 : 1.2}
              opacity={l.active ? 0.8 : 0.45}
              strokeLinejoin="round" strokeLinecap="round"
            />
            <circle cx={l.x1} cy={l.y1} r={l.active ? 3 : 2} fill={l.color} opacity={l.active ? 0.8 : 0.45} />
            <polygon
              points={`${l.x2},${l.y2} ${l.x2 - 5},${l.y2 - 3} ${l.x2 - 5},${l.y2 + 3}`}
              fill={l.color} opacity={l.active ? 0.8 : 0.45}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Attachment display / upload widget ─── */
function AttachmentList({ attachments, ticketId, parentType, parentId }: {
  attachments: Attachment[]; ticketId: string; parentType: 'annotation' | 'meta_annotation'; parentId: string;
}) {
  const { uploadAttachment, deleteAttachment } = useAnnotationStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadAttachment(ticketId, parentType, parentId, files[i]);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="mt-1.5">
      {attachments.map(att => (
        <div key={att.id} className="mb-1.5">
          {att.is_image ? (
            <div className="relative group">
              <img src={`/api/attachments/${att.id}`} alt={att.file_name} className="max-w-full rounded border border-surface-border" />
              <button onClick={(e) => { e.stopPropagation(); deleteAttachment(ticketId, att.id); }}
                className="absolute top-1 right-1 hidden group-hover:block text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px]">
              <a href={`/api/attachments/${att.id}`} download={att.file_name}
                className="text-accent-primary hover:underline truncate" onClick={(e) => e.stopPropagation()}>
                📎 {att.file_name}
              </a>
              <span className="text-soft-muted">({(att.file_size / 1024).toFixed(1)}KB)</span>
              <button onClick={(e) => { e.stopPropagation(); deleteAttachment(ticketId, att.id); }}
                className="text-soft-muted hover:text-accent-red">✕</button>
            </div>
          )}
        </div>
      ))}
      <label className="inline-flex items-center gap-1 text-[9px] text-soft-muted hover:text-accent-primary cursor-pointer mt-0.5 transition-colors">
        + ATTACH
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} onClick={(e) => e.stopPropagation()} />
      </label>
    </div>
  );
}

/* ─── Meta-annotation reply card ─── */
function MetaReplyItem({ reply, ticketId, annotationId, metaId }: {
  reply: MetaAnnotationReply; ticketId: string; annotationId: string; metaId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const { updateMetaReply, deleteMetaReply } = useAnnotationStore();

  const handleSave = async () => {
    if (!editText.trim()) return;
    await updateMetaReply(ticketId, annotationId, metaId, reply.id, editText.trim());
    setEditing(false);
  };

  return (
    <div className="p-2 pl-3 bg-card/50">
      {editing ? (
        <div className="space-y-1">
          <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSave(); } }} rows={2} className="bg-background border-border text-xs resize-none text-foreground" autoFocus />
          <div className="flex gap-1">
            <Button onClick={handleSave} className="text-[10px] h-5 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">SAVE</Button>
            <Button onClick={() => setEditing(false)} variant="ghost" className="text-[10px] h-5 px-2 text-muted-foreground">CANCEL</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-xs text-foreground/80 leading-relaxed">{reply.note}</div>
          <div className="flex gap-3 mt-1">
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); setEditText(reply.note); }} className="text-[9px] text-muted-foreground hover:text-accent-primary transition-colors">EDIT</button>
            <button onClick={(e) => { e.stopPropagation(); deleteMetaReply(ticketId, annotationId, metaId, reply.id); }} className="text-[9px] text-muted-foreground hover:text-accent-red transition-colors">DEL</button>
            <span className="text-[9px] text-muted-foreground/50">{reply.created_at}</span>
          </div>
        </>
      )}
    </div>
  );
}


/* ─── Meta-annotation (메메모) card ─── */
function MetaAnnotationCard({ meta, ticketId, annotationId, isActive, onActivate, cardRef }: {
  meta: MetaAnnotation; ticketId: string; annotationId: string; isActive: boolean; onActivate: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const { updateMetaAnnotation, deleteMetaAnnotation, addMetaReply, toggleResolveMetaAnnotation } = useAnnotationStore();

  const isResolved = !!meta.resolved;
  const colorPreset = ANNOTATION_COLORS.find(c => c.border === meta.color) || ANNOTATION_COLORS[0];

  const handleSaveEdit = async () => { if (!editHtml.trim() || editHtml === '<p></p>') return; await updateMetaAnnotation(ticketId, annotationId, meta.id, { note: editHtml }); setEditing(false); };
  const handleAddReply = async () => { if (!replyText.trim()) return; await addMetaReply(ticketId, annotationId, meta.id, replyText.trim()); setReplyText(''); setShowReplyInput(false); };

  const replies = meta.replies || [];
  const attachments = meta.attachments || [];

  return (
    <div ref={cardRef} className={`rounded-lg transition-all ${isResolved ? 'opacity-60' : ''} ${isActive ? 'ring-1 shadow-md' : 'hover:shadow-sm'}`}
      style={{
        borderLeft: `3px solid ${isResolved ? '#6b7a8d' : colorPreset.border}`,
        boxShadow: isActive && !isResolved ? `0 0 12px ${colorPreset.border}40` : undefined,
        backgroundColor: isResolved ? 'rgba(40,44,56,0.5)' : undefined,
      }}
      onClick={onActivate}>
      <div className="p-2.5 bg-card rounded-tr-lg rounded-br-lg" style={isResolved ? { background: 'rgba(40,44,56,0.5)' } : undefined}>
        <div className={`text-[10px] text-muted-foreground truncate mb-1 italic ${isResolved ? 'line-through' : ''}`}>
          &ldquo;{meta.selected_text.substring(0, 50)}{meta.selected_text.length > 50 ? '...' : ''}&rdquo;
        </div>
        {editing ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <MiniRichEditor content={meta.note} onChange={setEditHtml} onSubmit={handleSaveEdit} placeholder="메메모 편집..." autoFocus />
            <div className="flex gap-1">
              <Button onClick={handleSaveEdit} className="text-[10px] h-6 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">SAVE</Button>
              <Button onClick={() => setEditing(false)} variant="ghost" className="text-[10px] h-6 px-2 text-muted-foreground">CANCEL</Button>
            </div>
          </div>
        ) : (
          <>
            <RichContent html={meta.note} className={`text-[11px] leading-relaxed ${isResolved ? 'line-through text-muted-foreground' : 'text-foreground'}`} />
            <AttachmentList attachments={attachments} ticketId={ticketId} parentType="meta_annotation" parentId={meta.id} />
            <div className="flex gap-3 mt-2">
              <button onClick={(e) => { e.stopPropagation(); toggleResolveMetaAnnotation(ticketId, annotationId, meta.id); }}
                className={`text-[9px] transition-colors ${isResolved ? 'text-neon-green hover:text-neon-green/70' : 'text-muted-foreground hover:text-neon-green'}`}>
                {isResolved ? '✓ RESOLVED' : 'RESOLVE'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setEditing(true); setEditHtml(meta.note); }} className="text-[9px] text-muted-foreground hover:text-accent-primary transition-colors">EDIT</button>
              <button onClick={(e) => { e.stopPropagation(); setShowReplyInput(!showReplyInput); }} className="text-[9px] text-muted-foreground hover:text-accent-primary transition-colors">REPLY</button>
              <button onClick={(e) => { e.stopPropagation(); deleteMetaAnnotation(ticketId, annotationId, meta.id); }} className="text-[9px] text-muted-foreground hover:text-accent-red transition-colors">DEL</button>
            </div>
          </>
        )}
        {showReplyInput && (
          <div className="mt-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
            <MiniRichEditor content="" onChange={setReplyText} onSubmit={handleAddReply} placeholder="Reply..." autoFocus />
            <div className="flex gap-1 mt-1">
              <Button onClick={handleAddReply} className="text-[10px] h-6 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">ADD</Button>
              <Button onClick={() => { setShowReplyInput(false); setReplyText(''); }} variant="ghost" className="text-[10px] h-6 px-2 text-muted-foreground">CANCEL</Button>
            </div>
          </div>
        )}
      </div>
      {replies.length > 0 && (
        <div className="ml-2.5 border-l-2 border-border">
          {replies.map((reply) => (
            <MetaReplyItem key={reply.id} reply={reply} ticketId={ticketId} annotationId={annotationId} metaId={meta.id} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Annotation (메모) card ─── */
function AnnotationCard({ annotation, isActive, ticketId, onActivate, cardRef, metaHighlightRefs, metaCardRefs }: {
  annotation: Annotation; isActive: boolean; ticketId: string; onActivate: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
  metaHighlightRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  metaCardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
}) {
  const [editing, setEditing] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const noteRef = useRef<HTMLDivElement>(null);
  const [metaSelData, setMetaSelData] = useState<{ start: number; end: number; text: string } | null>(null);
  const [metaNoteHtml, setMetaNoteHtml] = useState('');
  const [metaColor, setMetaColor] = useState(ANNOTATION_COLORS[1].border);

  const { updateAnnotation, deleteAnnotation, createMetaAnnotation, toggleResolveAnnotation, activeMetaAnnotation, setActiveMetaAnnotation } = useAnnotationStore();

  const isResolved = !!annotation.resolved;
  const colorPreset = ANNOTATION_COLORS.find(c => c.border === annotation.color) || ANNOTATION_COLORS[0];
  const metaAnnotations = annotation.meta_annotations || [];
  const attachments = annotation.attachments || [];

  const handleSaveEdit = async () => { if (!editHtml.trim() || editHtml === '<p></p>') return; await updateAnnotation(ticketId, annotation.id, { note: editHtml }); setEditing(false); };

  const handleNoteMouseUp = useCallback(() => {
    if (!noteRef.current) return;
    setMetaSelData(getSelectionOffsets(noteRef.current));
  }, []);

  const handleCreateMeta = async () => {
    if (!metaSelData || !metaNoteHtml.trim() || metaNoteHtml === '<p></p>') return;
    await createMetaAnnotation(ticketId, annotation.id, {
      start_offset: metaSelData.start, end_offset: metaSelData.end,
      selected_text: metaSelData.text, note: metaNoteHtml, color: metaColor,
    });
    setMetaSelData(null); setMetaNoteHtml(''); window.getSelection()?.removeAllRanges();
  };

  const noteSegments = splitNoteByMetas(annotation.note, metaAnnotations);

  return (
    <div ref={cardRef} className={`rounded-lg transition-all ${isResolved ? 'opacity-60' : ''} ${isActive ? 'ring-1 shadow-md' : 'hover:shadow-sm'}`}
      style={{
        borderLeft: `3px solid ${isResolved ? '#6b7a8d' : colorPreset.border}`,
        boxShadow: isActive && !isResolved ? `0 0 12px ${colorPreset.border}40` : undefined,
        backgroundColor: isResolved ? 'rgba(40,44,56,0.5)' : undefined,
      }}
      onClick={onActivate}>
      <div className="p-3 bg-card rounded-tr-lg rounded-br-lg" style={isResolved ? { background: 'rgba(40,44,56,0.5)' } : undefined}>
        <div className={`text-[10px] text-muted-foreground truncate mb-1.5 italic ${isResolved ? 'line-through' : ''}`}>
          &ldquo;{annotation.selected_text.substring(0, 60)}{annotation.selected_text.length > 60 ? '...' : ''}&rdquo;
        </div>

        {editing ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <MiniRichEditor content={annotation.note} onChange={setEditHtml} onSubmit={handleSaveEdit} placeholder="메모 편집..." autoFocus />
            <div className="flex gap-1">
              <Button onClick={handleSaveEdit} className="text-[10px] h-6 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">SAVE</Button>
              <Button onClick={() => setEditing(false)} variant="ghost" className="text-[10px] h-6 px-2 text-muted-foreground">CANCEL</Button>
            </div>
          </div>
        ) : (
          <>
            <div ref={noteRef} onMouseUp={handleNoteMouseUp} className={`text-xs leading-relaxed select-text cursor-text ${isResolved ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {noteSegments.map((seg, i) => {
                if (seg.metaId) {
                  const meta = metaAnnotations.find(m => m.id === seg.metaId);
                  const mColor = meta?.color || ANNOTATION_COLORS[1].border;
                  const preset = ANNOTATION_COLORS.find(c => c.border === mColor) || ANNOTATION_COLORS[1];
                  const isMetaActive = activeMetaAnnotation === seg.metaId;
                  return (
                    <mark key={i}
                      ref={(el) => { if (el && seg.metaId) metaHighlightRefs.current.set(seg.metaId, el); }}
                      style={{
                        backgroundColor: isMetaActive ? preset.bg.replace(/[\d.]+\)$/, '0.6)') : preset.bg,
                        borderBottom: `2px solid ${preset.border}`, borderRadius: '1px',
                        cursor: 'pointer', color: 'var(--color-soft-primary)', padding: '0 1px',
                      }}
                      onClick={(e) => { e.stopPropagation(); setActiveMetaAnnotation(isMetaActive ? null : seg.metaId!); }}>
                      <RichContent html={seg.text} />
                    </mark>
                  );
                }
                return <RichContent key={i} html={seg.text} />;
              })}
            </div>
            <AttachmentList attachments={attachments} ticketId={ticketId} parentType="annotation" parentId={annotation.id} />
            <div className="flex gap-3 mt-2">
              <button onClick={(e) => { e.stopPropagation(); toggleResolveAnnotation(ticketId, annotation.id); }}
                className={`text-[10px] transition-colors ${isResolved ? 'text-neon-green hover:text-neon-green/70' : 'text-muted-foreground hover:text-neon-green'}`}>
                {isResolved ? '✓ RESOLVED' : 'RESOLVE'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setEditing(true); setEditHtml(annotation.note); }} className="text-[10px] text-muted-foreground hover:text-accent-primary transition-colors">EDIT</button>
              <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(ticketId, annotation.id); }} className="text-[10px] text-muted-foreground hover:text-accent-red transition-colors">DEL</button>
            </div>
          </>
        )}

        {metaSelData && isActive && (
          <div className="mt-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
            <div className="text-[9px] text-accent-primary tracking-wider mb-1 font-medium">NEW 메메모</div>
            <div className="text-[9px] text-muted-foreground italic mb-1.5 truncate">
              &ldquo;{metaSelData.text.substring(0, 60)}{metaSelData.text.length > 60 ? '...' : ''}&rdquo;
            </div>
            <div className="flex gap-1 mb-1.5">
              {ANNOTATION_COLORS.map((c) => (
                <button key={c.border} onClick={() => setMetaColor(c.border)}
                  className={`w-4 h-4 rounded-full border-2 transition-transform ${metaColor === c.border ? 'scale-125 border-white/60' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: c.border }} title={c.label} />
              ))}
            </div>
            <MiniRichEditor content="" onChange={setMetaNoteHtml} onSubmit={handleCreateMeta} placeholder="메메모 작성..." autoFocus />
            <div className="flex gap-1 mt-1.5">
              <Button onClick={handleCreateMeta} className="text-[10px] h-6 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">SAVE</Button>
              <Button onClick={() => { setMetaSelData(null); window.getSelection()?.removeAllRanges(); }} variant="ghost" className="text-[10px] h-6 px-2 text-muted-foreground">CANCEL</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helper: split note text by meta-annotation offsets ─── */
function splitNoteByMetas(text: string, metas: MetaAnnotation[]): { text: string; metaId?: string }[] {
  if (metas.length === 0) return [{ text }];
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);
  for (const m of metas) { boundaries.add(Math.max(0, m.start_offset)); boundaries.add(Math.min(text.length, m.end_offset)); }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const segments: { text: string; metaId?: string }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]; const end = sorted[i + 1];
    if (start === end) continue;
    const covering = metas.find(m => m.start_offset <= start && m.end_offset >= end);
    segments.push({ text: text.substring(start, end), metaId: covering?.id });
  }
  return segments;
}

/* ─── Main EmailViewer ─── */
export function EmailViewer({ email, ticketId }: { email: Email; ticketId: string }) {
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const metaHighlightRefs = useRef<Map<string, HTMLElement>>(new Map());
  const metaCardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [selectionData, setSelectionData] = useState<{ start: number; end: number; text: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0].border);
  const [viewMode, setViewMode] = useState<'html' | 'text'>(email.body_html ? 'html' : 'text');

  const { annotations, activeAnnotation, activeMetaAnnotation, fetchAnnotations, createAnnotation, setActiveAnnotation, setActiveMetaAnnotation } = useAnnotationStore();

  useEffect(() => { fetchAnnotations(ticketId, email.id); }, [ticketId, email.id, fetchAnnotations]);

  const handleMouseUp = useCallback(() => {
    if (!textRef.current) return;
    setSelectionData(getSelectionOffsets(textRef.current));
  }, []);

  const handleCreateAnnotation = async () => {
    if (!selectionData || !noteText.trim()) return;
    await createAnnotation(ticketId, { email_id: email.id, start_offset: selectionData.start, end_offset: selectionData.end, selected_text: selectionData.text, note: noteText.trim(), color: selectedColor });
    setSelectionData(null); setNoteText(''); window.getSelection()?.removeAllRanges();
  };

  const bodyText = email.body_text || '(No content)';
  const segments = splitTextByAnnotations(bodyText, annotations);
  const recipients: EmailRecipient[] = email.recipients ? JSON.parse(email.recipients) : [];
  const ccList: EmailRecipient[] = email.cc_list ? JSON.parse(email.cc_list) : [];

  const activeAnn = annotations.find(a => a.id === activeAnnotation);
  const activeMetas = activeAnn?.meta_annotations || [];
  const showMetaPanel = activeAnnotation && activeMetas.length > 0;

  const hasAnnotations = annotations.length > 0 || selectionData;
  let bodyWidth = 'w-full';
  let annoWidth = '';
  let metaWidth = '';

  if (hasAnnotations && showMetaPanel) {
    bodyWidth = 'w-[45%]'; annoWidth = 'w-[30%]'; metaWidth = 'w-[25%]';
  } else if (hasAnnotations) {
    bodyWidth = 'w-3/5'; annoWidth = 'w-2/5';
  }

  useEffect(() => {
    highlightRefs.current.clear(); cardRefs.current.clear();
    metaHighlightRefs.current.clear(); metaCardRefs.current.clear();
  }, [annotations, activeAnnotation]);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      {/* Email Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-foreground">{email.subject || '(No Subject)'}</div>
          {email.body_html && (
            <button
              onClick={() => setViewMode(viewMode === 'html' ? 'text' : 'html')}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                viewMode === 'html'
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'bg-muted/30 text-muted-foreground border-border hover:text-primary'
              }`}
            >
              {viewMode === 'html' ? 'HTML' : 'TEXT'}
            </button>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          <div>FROM: <span className="text-primary font-medium">{email.sender_name}</span> &lt;{email.sender_email}&gt;</div>
          {recipients.length > 0 && <div>TO: {recipients.map(r => `${r.name} <${r.email}>`).join(', ')}</div>}
          {ccList.length > 0 && <div>CC: {ccList.map(r => `${r.name} <${r.email}>`).join(', ')}</div>}
          {email.sent_date && <div>DATE: {email.sent_date}</div>}
        </div>
      </div>

      {/* Email Body + Annotation + Meta-Annotation Panels */}
      <div ref={containerRef} className="flex relative">
        {annotations.length > 0 && (
          <ConnectorLines containerRef={containerRef} highlightRefs={highlightRefs} cardRefs={cardRefs} annotations={annotations} activeAnnotation={activeAnnotation} />
        )}
        {showMetaPanel && (
          <MetaConnectorLines containerRef={containerRef} metaHighlightRefs={metaHighlightRefs} metaCardRefs={metaCardRefs} metas={activeMetas} activeMetaAnnotation={activeMetaAnnotation} />
        )}

        {/* Col 1: Email Body */}
        <div className={`${bodyWidth} p-5 overflow-auto transition-all`} style={{ maxHeight: '70vh' }}>
          {viewMode === 'html' && email.body_html ? (
            <div
              ref={textRef}
              onMouseUp={handleMouseUp}
              className="email-html-content text-[13px] leading-[1.8] select-text text-foreground"
              dangerouslySetInnerHTML={{ __html: email.body_html }}
            />
          ) : (
            <div ref={textRef} onMouseUp={handleMouseUp} className="text-[13px] leading-[1.8] whitespace-pre-wrap select-text text-foreground">
              {segments.map((seg, i) => {
                if (seg.annotations.length > 0) {
                  const ann = seg.annotations[0];
                  const isActive = activeAnnotation === ann.id;
                  return (
                    <mark key={i} ref={(el) => { if (el) highlightRefs.current.set(ann.id, el); }}
                      style={getAnnotationStyle(ann.color, isActive)}
                      onClick={() => setActiveAnnotation(isActive ? null : ann.id)}>
                      {seg.text}
                    </mark>
                  );
                }
                return <span key={i}>{seg.text}</span>;
              })}
            </div>
          )}
        </div>

        {/* Col 2: Annotation Panel */}
        {hasAnnotations && (
          <div className={`${annoWidth} border-l border-border bg-muted/20 overflow-y-auto p-3 space-y-3 transition-all`} style={{ maxHeight: '70vh' }}>
            <div className="text-[10px] text-primary tracking-widest font-bold mb-1">NOTES ({annotations.length})</div>
            {selectionData && (
              <div className="p-3 rounded-lg bg-card border border-primary/30 shadow-sm">
                <div className="text-[10px] text-primary tracking-wider mb-2 font-medium">NEW NOTE</div>
                <div className="text-[10px] text-muted-foreground italic mb-2 truncate">
                  &ldquo;{selectionData.text.substring(0, 80)}{selectionData.text.length > 80 ? '...' : ''}&rdquo;
                </div>
                <div className="flex gap-1.5 mb-2">
                  {ANNOTATION_COLORS.map((c) => (
                    <button key={c.border} onClick={() => setSelectedColor(c.border)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${selectedColor === c.border ? 'scale-125 border-white/60' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: c.border }} title={c.label} />
                  ))}
                </div>
                <MiniRichEditor content="" onChange={setNoteText} onSubmit={handleCreateAnnotation} placeholder="Write your note..." autoFocus className="mb-2" />
                <div className="flex gap-2">
                  <Button onClick={handleCreateAnnotation} className="bg-primary/20 text-primary border border-primary/30 text-[10px] h-7 px-3">SAVE NOTE</Button>
                  <Button onClick={() => { setSelectionData(null); window.getSelection()?.removeAllRanges(); }} variant="ghost" className="text-[10px] h-7 px-3 text-muted-foreground">CANCEL</Button>
                </div>
              </div>
            )}
            {annotations.map((ann) => (
              <AnnotationCard key={ann.id} annotation={ann} isActive={activeAnnotation === ann.id} ticketId={ticketId}
                onActivate={() => setActiveAnnotation(activeAnnotation === ann.id ? null : ann.id)}
                cardRef={(el) => { if (el) cardRefs.current.set(ann.id, el); }}
                metaHighlightRefs={metaHighlightRefs} metaCardRefs={metaCardRefs} />
            ))}
          </div>
        )}

        {/* Col 3: Meta-annotations (메메모) panel */}
        {showMetaPanel && (
          <div className={`${metaWidth} border-l border-border bg-card/50 overflow-y-auto p-2.5 space-y-2.5 transition-all`} style={{ maxHeight: '70vh' }}>
            <div className="text-[9px] text-neon-magenta tracking-widest font-bold mb-1">메메모 ({activeMetas.length})</div>
            {activeMetas.map((meta) => (
              <MetaAnnotationCard key={meta.id} meta={meta} ticketId={ticketId} annotationId={activeAnnotation!}
                isActive={activeMetaAnnotation === meta.id}
                onActivate={() => setActiveMetaAnnotation(activeMetaAnnotation === meta.id ? null : meta.id)}
                cardRef={(el) => { if (el) metaCardRefs.current.set(meta.id, el); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
