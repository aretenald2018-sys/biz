'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MiniRichEditor, RichContent } from '@/components/ui/rich-editor';
import { useAnnotationStore } from '@/stores/annotation-store';
import type { MetaAnnotation, MetaAnnotationReply } from '@/types/annotation';
import { ANNOTATION_COLORS } from '@/components/email/email-viewer-utils';
import { AttachmentList } from '@/components/email/email-attachment-stack';

export function MetaReplyItem({
  reply,
  ticketId,
  annotationId,
  metaId,
}: {
  reply: MetaAnnotationReply;
  ticketId: string;
  annotationId: string;
  metaId: string;
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
          <Textarea
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            onKeyDown={(event) => {
              if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                handleSave();
              }
            }}
            rows={2}
            className="bg-background border-border text-xs resize-none text-foreground"
            autoFocus
          />
          <div className="flex gap-1">
            <Button onClick={handleSave} className="text-[10px] h-5 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">SAVE</Button>
            <Button onClick={() => setEditing(false)} variant="ghost" className="text-[10px] h-5 px-2 text-muted-foreground">CANCEL</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-xs text-foreground/80 leading-relaxed">{reply.note}</div>
          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setEditing(true);
                setEditText(reply.note);
              }}
              className="text-[9px] text-muted-foreground hover:text-accent-primary transition-colors"
            >
              EDIT
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                deleteMetaReply(ticketId, annotationId, metaId, reply.id);
              }}
              className="text-[9px] text-muted-foreground hover:text-accent-red transition-colors"
            >
              DEL
            </button>
            <span className="text-[9px] text-muted-foreground/50">{reply.created_at}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function MetaAnnotationCard({
  meta,
  ticketId,
  annotationId,
  isActive,
  onActivate,
  cardRef,
}: {
  meta: MetaAnnotation;
  ticketId: string;
  annotationId: string;
  isActive: boolean;
  onActivate: () => void;
  cardRef: (element: HTMLDivElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);

  const { updateMetaAnnotation, deleteMetaAnnotation, addMetaReply, toggleResolveMetaAnnotation } = useAnnotationStore();
  const isResolved = !!meta.resolved;
  const colorPreset = ANNOTATION_COLORS.find((color) => color.border === meta.color) || ANNOTATION_COLORS[0];

  const handleSaveEdit = async () => {
    if (!editHtml.trim() || editHtml === '<p></p>') return;
    await updateMetaAnnotation(ticketId, annotationId, meta.id, { note: editHtml });
    setEditing(false);
  };

  const handleAddReply = async () => {
    if (!replyText.trim()) return;
    await addMetaReply(ticketId, annotationId, meta.id, replyText.trim());
    setReplyText('');
    setShowReplyInput(false);
  };

  const replies = meta.replies || [];
  const attachments = meta.attachments || [];

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
      <div className="p-2.5 bg-card rounded-tr-lg rounded-br-lg" style={isResolved ? { background: 'rgba(40,44,56,0.5)' } : undefined}>
        <div className={`text-[10px] text-muted-foreground truncate mb-1 italic ${isResolved ? 'line-through' : ''}`}>
          &ldquo;{meta.selected_text.substring(0, 50)}{meta.selected_text.length > 50 ? '...' : ''}&rdquo;
        </div>
        {editing ? (
          <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
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
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleResolveMetaAnnotation(ticketId, annotationId, meta.id);
                }}
                className={`text-[9px] transition-colors ${isResolved ? 'text-neon-green hover:text-neon-green/70' : 'text-muted-foreground hover:text-neon-green'}`}
              >
                {isResolved ? '✓ RESOLVED' : 'RESOLVE'}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(true);
                  setEditHtml(meta.note);
                }}
                className="text-[9px] text-muted-foreground hover:text-accent-primary transition-colors"
              >
                EDIT
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowReplyInput(!showReplyInput);
                }}
                className="text-[9px] text-muted-foreground hover:text-accent-primary transition-colors"
              >
                REPLY
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteMetaAnnotation(ticketId, annotationId, meta.id);
                }}
                className="text-[9px] text-muted-foreground hover:text-accent-red transition-colors"
              >
                DEL
              </button>
            </div>
          </>
        )}
        {showReplyInput && (
          <div className="mt-2 pt-2 border-t border-border" onClick={(event) => event.stopPropagation()}>
            <MiniRichEditor content="" onChange={setReplyText} onSubmit={handleAddReply} placeholder="Reply..." autoFocus />
            <div className="flex gap-1 mt-1">
              <Button onClick={handleAddReply} className="text-[10px] h-6 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">ADD</Button>
              <Button
                onClick={() => {
                  setShowReplyInput(false);
                  setReplyText('');
                }}
                variant="ghost"
                className="text-[10px] h-6 px-2 text-muted-foreground"
              >
                CANCEL
              </Button>
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
