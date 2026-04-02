'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { useNoteStore } from '@/stores/note-store';
import { useAnnotationStore } from '@/stores/annotation-store';
import { getSelectionOffsets } from '@/lib/annotation-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MiniRichEditor, RichContent } from '@/components/ui/rich-editor';
import type { Annotation } from '@/types/annotation';

const ANNOTATION_COLORS = [
  { bg: 'rgba(255, 220, 100, 0.35)', border: '#ffd54f', label: 'Yellow' },
  { bg: 'rgba(100, 220, 255, 0.30)', border: '#4dd0e1', label: 'Cyan' },
  { bg: 'rgba(255, 150, 200, 0.30)', border: '#f48fb1', label: 'Pink' },
  { bg: 'rgba(150, 255, 150, 0.30)', border: '#81c784', label: 'Green' },
  { bg: 'rgba(200, 170, 255, 0.30)', border: '#b39ddb', label: 'Purple' },
];

/* ─── Tiptap toolbar ─── */
function TiptapToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colors = ['#ff4444', '#ff6600', '#ffd700', '#00cc00', '#0099ff', '#9933ff', '#ff3399'];

  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/20 flex-wrap">
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        className={`toolbar-btn ${editor.isActive('bold') ? 'bg-muted text-foreground border-border' : ''}`} title="Bold (Ctrl+B)"><b>B</b></button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        className={`toolbar-btn ${editor.isActive('italic') ? 'bg-muted text-foreground border-border' : ''}`} title="Italic (Ctrl+I)"><i>I</i></button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
        className={`toolbar-btn ${editor.isActive('underline') ? 'bg-muted text-foreground border-border' : ''}`} title="Underline (Ctrl+U)"><u>U</u></button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
        className={`toolbar-btn ${editor.isActive('strike') ? 'bg-muted text-foreground border-border' : ''}`} title="Strikethrough"><s>S</s></button>
      <span className="w-px h-4 bg-border mx-1" />
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
        className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'bg-muted text-foreground border-border' : ''}`}>H1</button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
        className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'bg-muted text-foreground border-border' : ''}`}>H2</button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
        className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'bg-muted text-foreground border-border' : ''}`}>H3</button>
      <span className="w-px h-4 bg-border mx-1" />
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
        className={`toolbar-btn ${editor.isActive('bulletList') ? 'bg-muted text-foreground border-border' : ''}`}>&#8226;</button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
        className={`toolbar-btn ${editor.isActive('orderedList') ? 'bg-muted text-foreground border-border' : ''}`}>1.</button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run(); }}
        className={`toolbar-btn ${editor.isActive('codeBlock') ? 'bg-muted text-foreground border-border' : ''}`}>{'{ }'}</button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
        className={`toolbar-btn ${editor.isActive('blockquote') ? 'bg-muted text-foreground border-border' : ''}`}>&quot;</button>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}
        className="toolbar-btn">&#8213;</button>
      <span className="w-px h-4 bg-border mx-1" />
      <div className="relative">
        <button onMouseDown={(e) => { e.preventDefault(); setShowColorPicker(!showColorPicker); }}
          className="toolbar-btn" title="Text Color">A</button>
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-1.5 bg-card border border-border rounded shadow-lg z-50 flex gap-1">
            {colors.map(c => (
              <button key={c} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setShowColorPicker(false); }}
                className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }} />
            ))}
            <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
              className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform bg-foreground/20 text-[8px] flex items-center justify-center"
              title="Remove">x</button>
          </div>
        )}
      </div>
      <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color: '#ffd70060' }).run(); }}
        className={`toolbar-btn ${editor.isActive('highlight') ? 'bg-muted text-foreground border-border' : ''}`}>Hi</button>
    </div>
  );
}

/* ─── Compact annotation card for note panel ─── */
function NoteAnnotationCard({ ann, ticketId, isActive, onActivate }: {
  ann: Annotation; ticketId: string; isActive: boolean; onActivate: () => void;
}) {
  const { updateAnnotation, deleteAnnotation, toggleResolveAnnotation } = useAnnotationStore();
  const [editing, setEditing] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const isResolved = !!ann.resolved;
  const colorPreset = ANNOTATION_COLORS.find(c => c.border === ann.color) || ANNOTATION_COLORS[0];

  const handleSave = async () => { if (!editHtml.trim() || editHtml === '<p></p>') return; await updateAnnotation(ticketId, ann.id, { note: editHtml }); setEditing(false); };

  return (
    <div className={`rounded-lg transition-all ${isResolved ? 'opacity-60' : ''} ${isActive ? 'ring-1 shadow-md' : 'hover:shadow-sm'}`}
      style={{
        borderLeft: `3px solid ${isResolved ? '#6b7a8d' : colorPreset.border}`,
        backgroundColor: isResolved ? 'rgba(40,44,56,0.5)' : undefined,
      }}
      onClick={onActivate}>
      <div className="p-2.5 bg-card rounded-tr-lg rounded-br-lg" style={isResolved ? { background: 'rgba(40,44,56,0.5)' } : undefined}>
        <div className={`text-[10px] text-muted-foreground truncate mb-1 italic ${isResolved ? 'line-through' : ''}`}>
          &ldquo;{ann.selected_text.substring(0, 50)}{ann.selected_text.length > 50 ? '...' : ''}&rdquo;
        </div>
        {editing ? (
          <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
            <MiniRichEditor content={ann.note} onChange={setEditHtml} onSubmit={handleSave} placeholder="Edit memo..." autoFocus />
            <div className="flex gap-1">
              <Button onClick={handleSave} className="text-[10px] h-5 px-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30">SAVE</Button>
              <Button onClick={() => setEditing(false)} variant="ghost" className="text-[10px] h-5 px-2 text-muted-foreground">CANCEL</Button>
            </div>
          </div>
        ) : (
          <>
            <RichContent html={ann.note} className={`text-[11px] leading-relaxed ${isResolved ? 'line-through text-muted-foreground' : 'text-foreground'}`} />
            <div className="flex gap-3 mt-1.5">
              <button onClick={(e) => { e.stopPropagation(); toggleResolveAnnotation(ticketId, ann.id); }}
                className={`text-[9px] transition-colors ${isResolved ? 'text-neon-green hover:text-neon-green/70' : 'text-muted-foreground hover:text-neon-green'}`}>
                {isResolved ? '✓ RESOLVED' : 'RESOLVE'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setEditing(true); setEditHtml(ann.note); }}
                className="text-[9px] text-muted-foreground hover:text-accent-primary transition-colors">EDIT</button>
              <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(ticketId, ann.id); }}
                className="text-[9px] text-muted-foreground hover:text-accent-red transition-colors">DEL</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function NoteEditor({ ticketId, pinned, onTogglePin }: {
  ticketId: string;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { notes, activeNote, fetchNotes, createNote, updateNote, deleteNote, setActiveNote } = useNoteStore();
  const { annotations, activeAnnotation, fetchAnnotations, createAnnotation, setActiveAnnotation } = useAnnotationStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Annotation creation state
  const [selectionData, setSelectionData] = useState<{ start: number; end: number; text: string } | null>(null);
  const [annoNoteHtml, setAnnoNoteHtml] = useState('');
  const [annoColor, setAnnoColor] = useState(ANNOTATION_COLORS[0].border);

  useEffect(() => {
    fetchNotes(ticketId);
  }, [ticketId, fetchNotes]);

  const currentNote = notes.find(n => n.id === activeNote);

  // Fetch annotations for the active note
  useEffect(() => {
    if (activeNote) {
      fetchAnnotations(ticketId, '', activeNote);
    }
  }, [activeNote, ticketId, fetchAnnotations]);

  // Filter annotations for current note
  const noteAnnotations = annotations.filter(a => a.note_id === activeNote);

  const handleContentChange = useCallback((html: string) => {
    if (!activeNote) return;
    useNoteStore.setState({
      notes: notes.map(n => n.id === activeNote ? { ...n, content: html } : n),
    });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNote(ticketId, activeNote, { content: html });
    }, 500);
  }, [activeNote, ticketId, updateNote, notes]);

  const handleTitleSave = async () => {
    if (!activeNote || !titleDraft.trim()) return;
    await updateNote(ticketId, activeNote, { title: titleDraft.trim() });
    setEditingTitle(false);
  };

  const handlePreviewMouseUp = useCallback(() => {
    if (!previewRef.current) return;
    const sel = getSelectionOffsets(previewRef.current);
    setSelectionData(sel);
  }, []);

  const handleCreateAnnotation = async () => {
    if (!selectionData || !annoNoteHtml.trim() || annoNoteHtml === '<p></p>' || !activeNote) return;
    await createAnnotation(ticketId, {
      note_id: activeNote,
      start_offset: selectionData.start,
      end_offset: selectionData.end,
      selected_text: selectionData.text,
      note: annoNoteHtml,
      color: annoColor,
    });
    setSelectionData(null);
    setAnnoNoteHtml('');
    window.getSelection()?.removeAllRanges();
    await fetchAnnotations(ticketId, '', activeNote);
  };

  const hasAnnotations = noteAnnotations.length > 0 || selectionData;

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
              <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{note.content.replace(/<[^>]*>/g, '').substring(0, 40) || 'Empty'}</div>
            </button>
          ))}
        </div>

        {/* Editor + annotation panel */}
        {currentNote ? (
          <div className="flex-1 flex">
            {/* Main Tiptap editor area */}
            <div className={`${hasAnnotations ? 'w-3/5' : 'w-full'} flex flex-col transition-all`}>
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

              {/* Tiptap WYSIWYG Editor */}
              <NoteWysiwygEditor
                key={currentNote.id}
                content={currentNote.content}
                onChange={handleContentChange}
                previewRef={previewRef}
                onMouseUp={handlePreviewMouseUp}
              />
            </div>

            {/* Annotation panel for notes */}
            {hasAnnotations && (
              <div className="w-2/5 border-l border-border bg-muted/20 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '400px' }}>
                <div className="text-[10px] text-primary tracking-widest font-bold mb-1">MEMO ({noteAnnotations.length})</div>

                {selectionData && (
                  <div className="p-3 rounded-lg bg-card border border-primary/30 shadow-sm">
                    <div className="text-[10px] text-primary tracking-wider mb-2 font-medium">NEW MEMO</div>
                    <div className="text-[10px] text-muted-foreground italic mb-2 truncate">
                      &ldquo;{selectionData.text.substring(0, 80)}{selectionData.text.length > 80 ? '...' : ''}&rdquo;
                    </div>
                    <div className="flex gap-1.5 mb-2">
                      {ANNOTATION_COLORS.map((c) => (
                        <button key={c.border} onClick={() => setAnnoColor(c.border)}
                          className={`w-5 h-5 rounded-full border-2 transition-transform ${annoColor === c.border ? 'scale-125 border-white/60' : 'border-transparent hover:scale-110'}`}
                          style={{ backgroundColor: c.border }} title={c.label} />
                      ))}
                    </div>
                    <MiniRichEditor content="" onChange={setAnnoNoteHtml} onSubmit={handleCreateAnnotation} placeholder="Write memo..." autoFocus className="mb-2" />
                    <div className="flex gap-2">
                      <Button onClick={handleCreateAnnotation} className="bg-primary/20 text-primary border border-primary/30 text-[10px] h-6 px-3">SAVE</Button>
                      <Button onClick={() => { setSelectionData(null); window.getSelection()?.removeAllRanges(); }} variant="ghost" className="text-[10px] h-6 px-3 text-muted-foreground">CANCEL</Button>
                    </div>
                  </div>
                )}

                {noteAnnotations.map((ann) => (
                  <NoteAnnotationCard key={ann.id} ann={ann} ticketId={ticketId}
                    isActive={activeAnnotation === ann.id}
                    onActivate={() => setActiveAnnotation(activeAnnotation === ann.id ? null : ann.id)} />
                ))}
              </div>
            )}
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

/* ─── Tiptap WYSIWYG note editor ─── */
function NoteWysiwygEditor({ content, onChange, previewRef, onMouseUp }: {
  content: string;
  onChange: (html: string) => void;
  previewRef: React.RefObject<HTMLDivElement | null>;
  onMouseUp: () => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[280px] p-4 text-[12px] leading-[1.8] text-foreground markdown-preview',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    return () => { editor?.destroy(); };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col" ref={previewRef} onMouseUp={onMouseUp}>
      <TiptapToolbar editor={editor} />
      <div className="flex-1 overflow-auto" style={{ maxHeight: '400px' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
