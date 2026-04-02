'use client';

import { useEffect, useState, useRef } from 'react';
import { useEmailStore } from '@/stores/email-store';
import { useNoteStore } from '@/stores/note-store';
import { useEmailFlowStore } from '@/stores/email-flow-store';
import { EmailViewer } from './email-viewer';
import { AIChatModal } from './ai-chat-modal';
import { NoteEditor } from '@/components/notes/note-editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Email } from '@/types/email';
import type { Note } from '@/types/note';
import type { EmailFlowStep, FlowStepType } from '@/types/email-flow';

const STEP_CONFIG: Record<FlowStepType, { label: string; labelKo: string; color: string; icon: string }> = {
  request: { label: 'REQUEST', labelKo: '요청', color: '#5ec4d4', icon: '→' },
  response: { label: 'RESPONSE', labelKo: '답변', color: '#5ec490', icon: '←' },
  follow_up: { label: 'FOLLOW-UP', labelKo: '추가요청', color: '#d4a04e', icon: '↻' },
};

/* ─── Bookmark tab for item type ─── */
function BookmarkTab({ type }: { type: 'email' | 'note' }) {
  const isEmail = type === 'email';
  return (
    <div className="absolute left-0 top-3 z-10"
      style={{
        width: '6px',
        height: '28px',
        borderRadius: '0 3px 3px 0',
        backgroundColor: isEmail ? '#002C5F' : '#00AAD2',
      }}
      title={isEmail ? '이메일' : '노트'}
    />
  );
}

/* ─── Vertical dot timeline ─── */
function FlowTimeline({ steps }: { steps: EmailFlowStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-0 py-1 min-w-[20px]">
      {steps.map((step, i) => {
        const config = STEP_CONFIG[step.step_type];
        const isCurrent = !!step.is_current;
        return (
          <div key={step.id} className="flex flex-col items-center">
            {i > 0 && <div className="w-px h-2" style={{ backgroundColor: `${config.color}40` }} />}
            <div className={`w-3 h-3 rounded-full border-2 transition-all ${isCurrent ? 'scale-125' : ''}`}
              style={{
                borderColor: config.color,
                backgroundColor: isCurrent ? config.color : 'transparent',
                boxShadow: isCurrent ? `0 0 8px ${config.color}60` : undefined,
                animation: isCurrent ? 'flow-dot-pulse 2s ease-in-out infinite' : undefined,
              }}
              title={`${config.labelKo}: ${step.summary}`} />
          </div>
        );
      })}
    </div>
  );
}

/* ─── Flow step item ─── */
function FlowStepItem({ step, ticketId, emailId, onEdit }: {
  step: EmailFlowStep; ticketId: string; emailId: string; onEdit: () => void;
}) {
  const { deleteFlowStep, updateFlowStep } = useEmailFlowStore();
  const config = STEP_CONFIG[step.step_type];
  const isCurrent = !!step.is_current;

  return (
    <div className={`flex items-start gap-2 p-2 rounded-md transition-all ${isCurrent ? 'bg-muted/40 ring-1 ring-inset' : 'hover:bg-muted/20'}`}
      style={{ '--tw-ring-color': isCurrent ? `${config.color}30` : undefined } as React.CSSProperties}>
      <div className="flex flex-col items-center mt-1 shrink-0">
        <div className="w-2.5 h-2.5 rounded-full border-2"
          style={{ borderColor: config.color, backgroundColor: isCurrent ? config.color : 'transparent', animation: isCurrent ? 'flow-dot-pulse 2s ease-in-out infinite' : undefined }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[9px] tracking-wider font-bold" style={{ color: config.color }}>{config.icon} {config.label}</span>
          {step.actor && <span className="text-[9px] text-muted-foreground">{step.actor}</span>}
          {isCurrent && <span className="text-[8px] px-1 py-px rounded-sm tracking-wider font-medium" style={{ backgroundColor: `${config.color}20`, color: config.color }}>CURRENT</span>}
        </div>
        <div className="text-[11px] text-foreground/90 leading-relaxed">{step.summary}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isCurrent && <button onClick={(e) => { e.stopPropagation(); updateFlowStep(ticketId, emailId, { id: step.id, is_current: true }); }} className="text-[8px] text-muted-foreground hover:text-neon-cyan transition-colors px-1">SET</button>}
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-[8px] text-muted-foreground hover:text-accent-primary transition-colors px-1">EDIT</button>
        <button onClick={(e) => { e.stopPropagation(); deleteFlowStep(ticketId, emailId, step.id); }} className="text-[8px] text-muted-foreground hover:text-accent-red transition-colors px-1">DEL</button>
      </div>
    </div>
  );
}

/* ─── Flow panel ─── */
function EmailFlowPanel({ email, ticketId, expanded, onToggle }: {
  email: Email; ticketId: string; expanded: boolean; onToggle: () => void;
}) {
  const { flowSteps, fetchFlowSteps, createFlowStep, updateFlowStep } = useEmailFlowStore();
  const steps = flowSteps[email.id] || [];
  const [addingStep, setAddingStep] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [stepType, setStepType] = useState<FlowStepType>('request');
  const [actor, setActor] = useState('');
  const [summary, setSummary] = useState('');

  useEffect(() => { fetchFlowSteps(ticketId, email.id); }, [ticketId, email.id, fetchFlowSteps]);

  const handleAdd = async () => {
    if (!summary.trim()) return;
    await createFlowStep(ticketId, email.id, { step_type: stepType, actor: actor.trim() || undefined, summary: summary.trim(), is_current: steps.length === 0 });
    setSummary(''); setActor(''); setAddingStep(false);
  };
  const handleUpdate = async () => {
    if (!editingStep || !summary.trim()) return;
    await updateFlowStep(ticketId, email.id, { id: editingStep, step_type: stepType, actor: actor.trim() || undefined, summary: summary.trim() });
    setSummary(''); setActor(''); setEditingStep(null);
  };
  const startEdit = (step: EmailFlowStep) => { setEditingStep(step.id); setStepType(step.step_type); setActor(step.actor || ''); setSummary(step.summary); setAddingStep(false); };

  if (!expanded) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
      {steps.length > 0 ? (
        <div className="space-y-0.5 mb-2">
          {steps.map(step => <FlowStepItem key={step.id} step={step} ticketId={ticketId} emailId={email.id} onEdit={() => startEdit(step)} />)}
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground/60 mb-2 text-center py-1">No flow steps yet</div>
      )}
      {(addingStep || editingStep) ? (
        <div className="p-2 rounded-md bg-muted/20 border border-border space-y-2">
          <div className="flex items-center gap-1.5">
            {(['request', 'response', 'follow_up'] as FlowStepType[]).map(t => {
              const c = STEP_CONFIG[t];
              return (
                <button key={t} onClick={() => setStepType(t)}
                  className={`text-[9px] px-2 py-0.5 rounded border transition-all ${stepType === t ? 'border-current font-bold' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  style={stepType === t ? { color: c.color, borderColor: c.color, backgroundColor: `${c.color}15` } : undefined}>
                  {c.labelKo}
                </button>
              );
            })}
          </div>
          <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="담당자 (optional)"
            className="w-full bg-background border border-border rounded px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/40" />
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)}
            onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); editingStep ? handleUpdate() : handleAdd(); } }}
            placeholder="요약..." rows={2} className="bg-background border-border text-xs resize-none text-foreground" autoFocus />
          <div className="flex gap-1">
            <Button onClick={editingStep ? handleUpdate : handleAdd} className="text-[10px] h-6 px-2 bg-primary/20 text-primary border border-primary/30">{editingStep ? 'UPDATE' : 'ADD'}</Button>
            <Button onClick={() => { setAddingStep(false); setEditingStep(null); setSummary(''); setActor(''); }} variant="ghost" className="text-[10px] h-6 px-2 text-muted-foreground">CANCEL</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAddingStep(true); setStepType(steps.length === 0 ? 'request' : steps.length === 1 ? 'response' : 'follow_up'); }}
          className="text-[9px] text-muted-foreground hover:text-primary transition-colors tracking-wider">+ ADD STEP</button>
      )}
    </div>
  );
}

/* ─── Unified item type ─── */
type StackItem = { type: 'email'; data: Email; date: string } | { type: 'note'; data: Note; date: string };

export function EmailList({ ticketId }: { ticketId: string }) {
  const { emails, selectedEmail, loading, fetchEmails, selectEmail, deleteEmail } = useEmailStore();
  const { notes, activeNote, fetchNotes, setActiveNote, deleteNote } = useNoteStore();
  const { flowSteps, fetchFlowSteps } = useEmailFlowStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [aiEmail, setAiEmail] = useState<Email | null>(null);
  const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set());
  const [showNoteEditor, setShowNoteEditor] = useState(false);

  useEffect(() => { fetchEmails(ticketId); fetchNotes(ticketId); }, [ticketId, fetchEmails, fetchNotes]);
  useEffect(() => { emails.forEach(email => { fetchFlowSteps(ticketId, email.id); }); }, [emails, ticketId, fetchFlowSteps]);

  const toggleFlow = (emailId: string) => {
    setExpandedFlows(prev => { const next = new Set(prev); if (next.has(emailId)) next.delete(emailId); else next.add(emailId); return next; });
  };

  // Merge emails and notes into unified sorted list
  const stackItems: StackItem[] = [
    ...emails.map(e => ({ type: 'email' as const, data: e, date: e.sent_date || e.created_at })),
    ...notes.map(n => ({ type: 'note' as const, data: n, date: n.updated_at || n.created_at })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) {
    return <div className="text-center py-8 text-neon-cyan neon-pulse text-xs tracking-widest">LOADING...</div>;
  }

  if (stackItems.length === 0) {
    return (
      <div className="glass rounded-lg p-6 text-center border border-dashed border-border">
        <p className="text-muted-foreground text-xs tracking-wider">이메일을 업로드하거나 노트를 생성하세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Unified stack */}
      <div className="space-y-2">
        {stackItems.map((item) => {
          if (item.type === 'email') {
            const email = item.data as Email;
            const steps = flowSteps[email.id] || [];
            const isExpanded = expandedFlows.has(email.id);
            const isSelected = selectedEmail?.id === email.id;

            return (
              <div key={`email-${email.id}`}
                className={`relative glass rounded-lg cursor-pointer transition-all border ${
                  isSelected ? 'border-neon-cyan/40 glow-cyan bg-neon-cyan/5' : 'border-border hover:border-neon-cyan/20'
                }`}>
                {/* Bookmark tab — Navy for email */}
                <BookmarkTab type="email" />

                <div className="flex items-stretch pl-3"
                  onClick={() => selectEmail(isSelected ? null : email)}>
                  {steps.length > 0 && (
                    <div className="flex items-center px-2 border-r border-border/30"
                      onClick={(e) => { e.stopPropagation(); toggleFlow(email.id); }}>
                      <FlowTimeline steps={steps} />
                    </div>
                  )}
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(0,44,95,0.08)', color: '#002C5F' }}>EMAIL</span>
                          <span className="text-xs font-semibold truncate">{email.subject || '(No Subject)'}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                          <span>FROM: {email.sender_name || email.sender_email || 'Unknown'}</span>
                          {email.sent_date && <span>| {email.sent_date}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); toggleFlow(email.id); }}
                          className={`text-[10px] px-2 py-1 rounded transition-all ${isExpanded ? 'text-neon-magenta bg-neon-magenta/10' : 'text-muted-foreground hover:text-neon-magenta hover:bg-neon-magenta/10'}`}>
                          FLOW{steps.length > 0 ? ` (${steps.length})` : ''}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setAiEmail(email); }}
                          className="text-[10px] px-2 py-1 rounded transition-all text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10">AI</button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          if (confirmDelete === email.id) { deleteEmail(ticketId, email.id); setConfirmDelete(null); }
                          else { setConfirmDelete(email.id); setTimeout(() => setConfirmDelete(null), 3000); }
                        }}
                          className={`text-[10px] px-2 py-1 rounded transition-all ${confirmDelete === email.id ? 'text-neon-red bg-neon-red/10 border border-neon-red/30' : 'text-muted-foreground hover:text-neon-red'}`}>
                          {confirmDelete === email.id ? 'CONFIRM?' : 'DEL'}
                        </button>
                      </div>
                    </div>
                    {steps.length > 0 && !isExpanded && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {steps.map(step => {
                          const config = STEP_CONFIG[step.step_type];
                          const isCurrent = !!step.is_current;
                          return (
                            <span key={step.id} className={`text-[9px] px-1.5 py-px rounded-sm truncate max-w-[200px] ${isCurrent ? 'font-medium' : 'opacity-60'}`}
                              style={{ color: config.color, backgroundColor: `${config.color}12`, border: isCurrent ? `1px solid ${config.color}40` : '1px solid transparent' }}>
                              {config.icon} {step.summary}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <EmailFlowPanel email={email} ticketId={ticketId} expanded={isExpanded} onToggle={() => toggleFlow(email.id)} />
              </div>
            );
          }

          /* ─── Note item ─── */
          const note = item.data as Note;
          const isNoteActive = activeNote === note.id;
          const confirmingNoteDelete = confirmDelete === `note-${note.id}`;

          return (
            <div key={`note-${note.id}`}
              className={`relative glass rounded-lg cursor-pointer transition-all border ${
                isNoteActive ? 'border-neon-cyan/40 glow-cyan bg-neon-cyan/5' : 'border-border hover:border-neon-cyan/20'
              }`}
              onClick={() => { setActiveNote(isNoteActive ? null : note.id); if (!isNoteActive) setShowNoteEditor(true); }}>
              {/* Bookmark tab — Cyan/teal for note */}
              <BookmarkTab type="note" />

              <div className="flex-1 p-3 pl-5 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(0,170,210,0.08)', color: '#00AAD2' }}>NOTE</span>
                      <span className="text-xs font-semibold truncate">{note.title}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {note.content.replace(/<[^>]*>/g, '').substring(0, 80) || 'Empty'}
                      <span className="ml-2">| {note.updated_at?.split(' ')[0] || note.created_at?.split(' ')[0]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      if (confirmingNoteDelete) { deleteNote(ticketId, note.id); setConfirmDelete(null); }
                      else { setConfirmDelete(`note-${note.id}`); setTimeout(() => setConfirmDelete(null), 3000); }
                    }}
                      className={`text-[10px] px-2 py-1 rounded transition-all ${confirmingNoteDelete ? 'text-neon-red bg-neon-red/10 border border-neon-red/30' : 'text-muted-foreground hover:text-neon-red'}`}>
                      {confirmingNoteDelete ? 'CONFIRM?' : 'DEL'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Email Viewer */}
      {selectedEmail && <EmailViewer email={selectedEmail} ticketId={ticketId} />}

      {/* Note Editor (expanded below when a note is selected) */}
      {activeNote && showNoteEditor && (
        <NoteEditor ticketId={ticketId} pinned={true} onTogglePin={() => setShowNoteEditor(false)} />
      )}

      {/* AI Chat Modal */}
      {aiEmail && <AIChatModal open={!!aiEmail} onOpenChange={(v) => { if (!v) setAiEmail(null); }} email={aiEmail} />}
    </div>
  );
}
