'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import type { Email, EmailRecipient } from '@/types/email';
import { useAnnotationStore } from '@/stores/annotation-store';
import { splitTextByAnnotations, getSelectionOffsets } from '@/lib/annotation-utils';
import { applyAnnotationsToDOM, clearAnnotationMarks } from '@/lib/dom-annotation-utils';
import { normalizeCid } from '@/lib/cid-utils';
import { Button } from '@/components/ui/button';
import { MiniRichEditor } from '@/components/ui/rich-editor';
import { ANNOTATION_COLORS, getAnnotationStyle, resolveInlineCidImages } from '@/components/email/email-viewer-utils';
import { ConnectorLines, MetaConnectorLines } from '@/components/email/connector-lines';
import { AnnotationCard } from '@/components/email/annotation-card';
import { MetaAnnotationCard } from '@/components/email/meta-annotation-card';
import { EmailAttachmentStack } from '@/components/email/email-attachment-stack';

function parseRecipients(raw: string | null): EmailRecipient[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmailRecipient[]) : [];
  } catch {
    return [];
  }
}

export function EmailViewer({ email, ticketId, embedded = false }: { email: Email; ticketId: string; embedded?: boolean }) {
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const metaHighlightRefs = useRef<Map<string, HTMLElement>>(new Map());
  const metaCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const annotationAbortRef = useRef<AbortController | null>(null);

  const [selectionData, setSelectionData] = useState<{ start: number; end: number; text: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0].border);

  const {
    annotations,
    activeAnnotation,
    activeMetaAnnotation,
    fetchAnnotations,
    createAnnotation,
    setActiveAnnotation,
    setActiveMetaAnnotation,
  } = useAnnotationStore();

  useEffect(() => {
    fetchAnnotations(ticketId, email.id);
  }, [ticketId, email.id, fetchAnnotations]);

  const sanitizedHtml = useMemo(() => {
    if (!email.body_html) return null;
    const resolvedHtml = resolveInlineCidImages(email.body_html, email.email_attachments || []);
    return DOMPurify.sanitize(resolvedHtml, {
      ADD_ATTR: ['style', 'class', 'bgcolor', 'width', 'height', 'align', 'valign', 'cellpadding', 'cellspacing', 'border', 'src', 'alt'],
      ADD_TAGS: ['style', 'img'],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#|data:image\/)/i,
    });
  }, [email.body_html, email.email_attachments]);

  const htmlProp = useMemo(() => (sanitizedHtml ? { __html: sanitizedHtml } : undefined), [sanitizedHtml]);
  const isHtmlMode = !!sanitizedHtml;

  useEffect(() => {
    if (!textRef.current || !isHtmlMode) return;

    annotationAbortRef.current?.abort();
    clearAnnotationMarks(textRef.current);
    if (annotations.length === 0) return;

    let frameId: number | null = null;
    const abortController = new AbortController();
    let appliedAbortController: AbortController | null = null;
    annotationAbortRef.current = abortController;

    frameId = window.requestAnimationFrame(() => {
      if (abortController.signal.aborted || !textRef.current) return;
      const applied = applyAnnotationsToDOM(
        textRef.current,
        annotations,
        activeAnnotation,
        (id) => setActiveAnnotation(activeAnnotation === id ? null : id),
      );
      highlightRefs.current.clear();
      applied.refMap.forEach((element, id) => highlightRefs.current.set(id, element));
      appliedAbortController = applied.abortController;
      annotationAbortRef.current = applied.abortController;
    });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      abortController.abort();
      appliedAbortController?.abort();
      if (annotationAbortRef.current === abortController) {
        annotationAbortRef.current = null;
      }
    };
  }, [annotations, activeAnnotation, isHtmlMode, setActiveAnnotation]);

  useEffect(() => {
    if (!isHtmlMode) {
      annotationAbortRef.current?.abort();
      highlightRefs.current.clear();
    }
    cardRefs.current.clear();
    metaHighlightRefs.current.clear();
    metaCardRefs.current.clear();
  }, [annotations, activeAnnotation, isHtmlMode]);

  useEffect(() => {
    return () => {
      annotationAbortRef.current?.abort();
    };
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!textRef.current) return;
    setSelectionData(getSelectionOffsets(textRef.current));
  }, []);

  const handleCreateAnnotation = async () => {
    if (!selectionData || !noteText.trim()) return;
    await createAnnotation(ticketId, {
      email_id: email.id,
      start_offset: selectionData.start,
      end_offset: selectionData.end,
      selected_text: selectionData.text,
      note: noteText.trim(),
      color: selectedColor,
    });
    setSelectionData(null);
    setNoteText('');
  };

  const bodyText = email.body_text || '(No content)';
  const segments = splitTextByAnnotations(bodyText, annotations);
  const recipients = parseRecipients(email.recipients);
  const ccList = parseRecipients(email.cc_list);
  const activeAnnotationData = annotations.find((annotation) => annotation.id === activeAnnotation);
  const activeMetas = activeAnnotationData?.meta_annotations || [];
  const showMetaPanel = Boolean(activeAnnotation && activeMetas.length > 0);

  const hasAnnotations = annotations.length > 0 || selectionData;
  let bodyWidth = 'w-full';
  let annotationWidth = '';
  let metaWidth = '';
  if (hasAnnotations && showMetaPanel) {
    bodyWidth = 'w-[45%]';
    annotationWidth = 'w-[30%]';
    metaWidth = 'w-[25%]';
  } else if (hasAnnotations) {
    bodyWidth = 'w-3/5';
    annotationWidth = 'w-2/5';
  }

  const emailAttachments = (email.email_attachments || []).filter((attachment) => !normalizeCid(attachment.content_id));

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-foreground">{email.subject || '(No Subject)'}</div>
        </div>
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          <div>FROM: <span className="text-primary font-medium">{email.sender_name}</span> &lt;{email.sender_email}&gt;</div>
          {recipients.length > 0 && <div>TO: {recipients.map((recipient) => `${recipient.name} <${recipient.email}>`).join(', ')}</div>}
          {ccList.length > 0 && <div>CC: {ccList.map((recipient) => `${recipient.name} <${recipient.email}>`).join(', ')}</div>}
          {email.sent_date && <div>DATE: {email.sent_date}</div>}
        </div>
      </div>

      <EmailAttachmentStack attachments={emailAttachments} />

      <div ref={containerRef} className="flex relative">
        {annotations.length > 0 && (
          <ConnectorLines
            containerRef={containerRef}
            highlightRefs={highlightRefs}
            cardRefs={cardRefs}
            annotations={annotations}
            activeAnnotation={activeAnnotation}
          />
        )}
        {showMetaPanel && (
          <MetaConnectorLines
            containerRef={containerRef}
            metaHighlightRefs={metaHighlightRefs}
            metaCardRefs={metaCardRefs}
            metas={activeMetas}
            activeMetaAnnotation={activeMetaAnnotation}
          />
        )}

        <div className={`${bodyWidth} p-5 overflow-auto transition-all`} style={{ maxHeight: embedded ? '60vh' : '70vh' }}>
          {isHtmlMode ? (
            <div
              ref={textRef}
              onMouseUp={handleMouseUp}
              className="email-html-content text-[13px] leading-[1.8] select-text text-foreground"
              dangerouslySetInnerHTML={htmlProp}
            />
          ) : (
            <div ref={textRef} onMouseUp={handleMouseUp} className="text-[13px] leading-[1.8] whitespace-pre-wrap select-text text-foreground">
              {segments.map((segment, index) => {
                if (segment.annotations.length > 0) {
                  const annotation = segment.annotations[0];
                  const isActive = activeAnnotation === annotation.id;
                  return (
                    <mark
                      key={`${annotation.id}-${index}`}
                      ref={(element) => { if (element) highlightRefs.current.set(annotation.id, element); }}
                      style={getAnnotationStyle(annotation.color, isActive)}
                      onClick={() => setActiveAnnotation(isActive ? null : annotation.id)}
                    >
                      {segment.text}
                    </mark>
                  );
                }
                return <span key={`${email.id}-segment-${index}`}>{segment.text}</span>;
              })}
            </div>
          )}
        </div>

        {hasAnnotations && (
          <div className={`${annotationWidth} border-l border-border bg-muted/20 overflow-y-auto p-3 space-y-3 transition-all`} style={{ maxHeight: embedded ? '60vh' : '70vh' }}>
            <div className="text-[10px] text-primary tracking-widest font-bold mb-1">NOTES ({annotations.length})</div>
            {selectionData && (
              <div className="p-3 rounded-lg bg-card border border-primary/30 shadow-sm">
                <div className="text-[10px] text-primary tracking-wider mb-2 font-medium">NEW NOTE</div>
                <div className="text-[10px] text-muted-foreground italic mb-2 truncate">
                  &ldquo;{selectionData.text.substring(0, 80)}{selectionData.text.length > 80 ? '...' : ''}&rdquo;
                </div>
                <div className="flex gap-1.5 mb-2">
                  {ANNOTATION_COLORS.map((color) => (
                    <button
                      key={color.border}
                      type="button"
                      onClick={() => setSelectedColor(color.border)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${selectedColor === color.border ? 'scale-125 border-white/60' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: color.border }}
                      title={color.label}
                    />
                  ))}
                </div>
                <MiniRichEditor content="" onChange={setNoteText} onSubmit={handleCreateAnnotation} placeholder="Write your note..." className="mb-2" />
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!selectionData?.text) return;
                      try {
                        await navigator.clipboard.writeText(selectionData.text);
                      } catch {
                        // Keep selection state even if clipboard write fails.
                      }
                    }}
                    variant="ghost"
                    className="text-[10px] h-7 px-3 text-muted-foreground"
                  >
                    COPY
                  </Button>
                  <Button onClick={handleCreateAnnotation} className="bg-primary/20 text-primary border border-primary/30 text-[10px] h-7 px-3">SAVE NOTE</Button>
                  <Button onClick={() => { setSelectionData(null); }} variant="ghost" className="text-[10px] h-7 px-3 text-muted-foreground">CANCEL</Button>
                </div>
              </div>
            )}
            {annotations.map((annotation) => (
              <AnnotationCard
                key={annotation.id}
                annotation={annotation}
                isActive={activeAnnotation === annotation.id}
                ticketId={ticketId}
                onActivate={() => setActiveAnnotation(activeAnnotation === annotation.id ? null : annotation.id)}
                cardRef={(element) => { if (element) cardRefs.current.set(annotation.id, element); }}
                metaHighlightRefs={metaHighlightRefs}
              />
            ))}
          </div>
        )}

        {showMetaPanel && (
          <div className={`${metaWidth} border-l border-border bg-card/50 overflow-y-auto p-2.5 space-y-2.5 transition-all`} style={{ maxHeight: embedded ? '60vh' : '70vh' }}>
            <div className="text-[9px] text-neon-magenta tracking-widest font-bold mb-1">메메모 ({activeMetas.length})</div>
            {activeMetas.map((meta) => (
              <MetaAnnotationCard
                key={meta.id}
                meta={meta}
                ticketId={ticketId}
                annotationId={activeAnnotation!}
                isActive={activeMetaAnnotation === meta.id}
                onActivate={() => setActiveMetaAnnotation(activeMetaAnnotation === meta.id ? null : meta.id)}
                cardRef={(element) => { if (element) metaCardRefs.current.set(meta.id, element); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
