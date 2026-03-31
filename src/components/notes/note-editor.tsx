'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNoteStore } from '@/stores/note-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function MarkdownToolbar({ textareaRef, content, onChange }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onChange: (value: string) => void;
}) {
  const wrapSelection = (before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end) || 'text';
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);
    onChange(newContent);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    onChange(newContent);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + prefix.length; }, 0);
  };

  const insertText = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const newContent = content.substring(0, start) + text + content.substring(start);
    onChange(newContent);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + text.length; }, 0);
  };

  const [showColorPicker, setShowColorPicker] = useState(false);
  const colors = ['red', '#ff6600', '#ffd700', '#00cc00', '#0099ff', '#9933ff', '#ff3399'];

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/20 flex-wrap">
      <button onClick={() => wrapSelection('**', '**')} className="toolbar-btn" title="Bold"><b>B</b></button>
      <button onClick={() => wrapSelection('*', '*')} className="toolbar-btn" title="Italic"><i>I</i></button>
      <button onClick={() => wrapSelection('~~', '~~')} className="toolbar-btn" title="Strikethrough"><s>S</s></button>
      <span className="w-px h-4 bg-border mx-1" />
      <button onClick={() => insertAtLineStart('# ')} className="toolbar-btn" title="H1">H1</button>
      <button onClick={() => insertAtLineStart('## ')} className="toolbar-btn" title="H2">H2</button>
      <button onClick={() => insertAtLineStart('### ')} className="toolbar-btn" title="H3">H3</button>
      <span className="w-px h-4 bg-border mx-1" />
      <button onClick={() => insertAtLineStart('- ')} className="toolbar-btn" title="Bullet List">&#8226;</button>
      <button onClick={() => insertAtLineStart('1. ')} className="toolbar-btn" title="Numbered List">1.</button>
      <button onClick={() => wrapSelection('`', '`')} className="toolbar-btn" title="Inline Code">&lt;/&gt;</button>
      <button onClick={() => insertText('\n```\ncode\n```\n')} className="toolbar-btn" title="Code Block">{'{ }'}</button>
      <button onClick={() => insertAtLineStart('> ')} className="toolbar-btn" title="Quote">&quot;</button>
      <button onClick={() => insertText('\n---\n')} className="toolbar-btn" title="HR">&#8213;</button>
      <button onClick={() => wrapSelection('[', '](url)')} className="toolbar-btn" title="Link">Link</button>
      <span className="w-px h-4 bg-border mx-1" />
      <div className="relative">
        <button onClick={() => setShowColorPicker(!showColorPicker)} className="toolbar-btn" title="Text Color">A</button>
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-1.5 bg-card border border-border rounded shadow-lg z-50 flex gap-1">
            {colors.map(c => (
              <button key={c} onClick={() => { wrapSelection(`<span style="color:${c}">`, '</span>'); setShowColorPicker(false); }}
                className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }} />
            ))}
          </div>
        )}
      </div>
      <button onClick={() => wrapSelection('<mark>', '</mark>')} className="toolbar-btn" title="Highlight">Hi</button>
      <button onClick={() => insertText('\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n')} className="toolbar-btn" title="Table">Tbl</button>
    </div>
  );
}

export function NoteEditor({ ticketId, pinned, onTogglePin }: {
  ticketId: string;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { notes, activeNote, fetchNotes, createNote, updateNote, deleteNote, setActiveNote } = useNoteStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetchNotes(ticketId);
  }, [ticketId, fetchNotes]);

  const currentNote = notes.find(n => n.id === activeNote);

  const handleContentChange = useCallback((value: string) => {
    if (!activeNote) return;
    useNoteStore.setState({
      notes: notes.map(n => n.id === activeNote ? { ...n, content: value } : n),
    });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNote(ticketId, activeNote, { content: value });
    }, 500);
  }, [activeNote, ticketId, updateNote, notes]);

  const handleTitleSave = async () => {
    if (!activeNote || !titleDraft.trim()) return;
    await updateNote(ticketId, activeNote, { title: titleDraft.trim() });
    setEditingTitle(false);
  };

  if (collapsed) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-primary tracking-widest font-bold">NOTES ({notes.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onTogglePin}
              className={`text-[10px] tracking-wider px-2 py-0.5 rounded border transition-all ${pinned ? 'bg-primary/20 text-primary border-primary/30' : 'text-muted-foreground border-border hover:text-primary'}`}>
              {pinned ? '📌 PINNED' : '📌 PIN'}
            </button>
            <button onClick={() => setCollapsed(false)} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">▼ EXPAND</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-primary tracking-widest font-bold">NOTES ({notes.length})</span>
          <Button onClick={() => createNote(ticketId, 'New Note')}
            className="text-[10px] h-6 px-2 bg-primary/20 text-primary border border-primary/30">+ NEW</Button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onTogglePin}
            className={`text-[10px] tracking-wider px-2 py-0.5 rounded border transition-all ${pinned ? 'bg-primary/20 text-primary border-primary/30' : 'text-muted-foreground border-border hover:text-primary'}`}>
            {pinned ? '📌 PINNED' : '📌 PIN'}
          </button>
          <button onClick={() => setCollapsed(true)} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">▲ COLLAPSE</button>
        </div>
      </div>

      <div className="flex" style={{ minHeight: '350px' }}>
        {/* Note list sidebar */}
        <div className="w-48 border-r border-border bg-muted/10 overflow-y-auto flex flex-col">
          {notes.length === 0 && (
            <div className="p-4 text-center text-[11px] text-muted-foreground">No notes yet</div>
          )}
          {notes.map(note => (
            <button key={note.id} onClick={() => setActiveNote(note.id)}
              className={`w-full text-left p-2.5 border-b border-border transition-colors ${
                activeNote === note.id
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-muted/30 border-l-2 border-l-transparent'
              }`}>
              <div className="text-[11px] text-foreground font-medium truncate">{note.title}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{note.content.substring(0, 40) || 'Empty'}</div>
            </button>
          ))}
        </div>

        {/* Editor + Preview split */}
        {currentNote ? (
          <div className="flex-1 flex flex-col">
            {/* Title bar */}
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/10">
              {editingTitle ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); }}
                    className="bg-background border-border text-sm text-foreground h-7" autoFocus />
                  <Button onClick={handleTitleSave} className="text-[10px] h-6 px-2 bg-primary/20 text-primary border border-primary/30">OK</Button>
                </div>
              ) : (
                <h3 onClick={() => { setEditingTitle(true); setTitleDraft(currentNote.title); }}
                  className="text-xs font-semibold text-foreground cursor-pointer hover:text-primary transition-colors">{currentNote.title}</h3>
              )}
              <button onClick={() => { if (confirm('Delete this note?')) deleteNote(ticketId, currentNote.id); }}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors ml-3">DEL</button>
            </div>

            {/* Split: Editor left, Preview right */}
            <div className="flex-1 flex">
              {/* Left: Editor */}
              <div className="w-1/2 border-r border-border flex flex-col">
                <div className="px-2 py-1 border-b border-border bg-muted/20">
                  <span className="text-[9px] text-muted-foreground tracking-wider">EDIT</span>
                </div>
                <MarkdownToolbar textareaRef={textareaRef} content={currentNote.content} onChange={handleContentChange} />
                <textarea
                  ref={textareaRef}
                  value={currentNote.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Write in markdown..."
                  className="w-full flex-1 p-3 bg-transparent border-none outline-none resize-none text-[12px] leading-[1.7] text-foreground font-mono"
                  style={{ minHeight: '280px' }}
                />
              </div>
              {/* Right: Live Preview */}
              <div className="w-1/2">
                <div className="px-2 py-1 border-b border-border bg-muted/20">
                  <span className="text-[9px] text-muted-foreground tracking-wider">PREVIEW</span>
                </div>
                <div className="p-3 overflow-auto markdown-preview text-[12px]" style={{ maxHeight: '320px' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {currentNote.content || '*Empty — type on the left to preview*'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs tracking-wider">
            SELECT OR CREATE A NOTE
          </div>
        )}
      </div>
    </div>
  );
}
