'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useEffect, useCallback } from 'react';

/* ─── Mini rich editor for memos / meta-memos ─── */
export function MiniRichEditor({ content, onChange, onSubmit, placeholder, autoFocus, className }: {
  content: string;
  onChange: (html: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [showColors, setShowColors] = useState(false);
  const colors = ['#ff4444', '#ff6600', '#ffd700', '#00cc00', '#0099ff', '#9933ff', '#ff3399'];

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: placeholder || 'Write...' }),
    ],
    content,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[40px] max-h-[120px] overflow-y-auto text-xs leading-relaxed text-foreground',
      },
      handleKeyDown: (_view, event) => {
        if (event.ctrlKey && event.key === 'Enter' && onSubmit) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
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
    <div className={`border border-border rounded-md bg-background overflow-hidden ${className || ''}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border bg-muted/20">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          className={`toolbar-btn h-5 min-w-[20px] text-[10px] ${editor.isActive('bold') ? 'bg-muted text-foreground' : ''}`}
          title="Bold (Ctrl+B)"><b>B</b></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          className={`toolbar-btn h-5 min-w-[20px] text-[10px] ${editor.isActive('italic') ? 'bg-muted text-foreground' : ''}`}
          title="Italic (Ctrl+I)"><i>I</i></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          className={`toolbar-btn h-5 min-w-[20px] text-[10px] ${editor.isActive('underline') ? 'bg-muted text-foreground' : ''}`}
          title="Underline (Ctrl+U)"><u>U</u></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
          className={`toolbar-btn h-5 min-w-[20px] text-[10px] ${editor.isActive('strike') ? 'bg-muted text-foreground' : ''}`}
          title="Strikethrough"><s>S</s></button>
        <div className="relative">
          <button type="button" onMouseDown={(e) => { e.preventDefault(); setShowColors(!showColors); }}
            className="toolbar-btn h-5 min-w-[20px] text-[10px]" title="Text Color">A</button>
          {showColors && (
            <div className="absolute top-full left-0 mt-0.5 p-1 bg-card border border-border rounded shadow-lg z-50 flex gap-0.5">
              {colors.map(c => (
                <button key={c} type="button" onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().setColor(c).run();
                  setShowColors(false);
                }}
                  className="w-4 h-4 rounded-full border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }} />
              ))}
              <button type="button" onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().unsetColor().run();
                setShowColors(false);
              }}
                className="w-4 h-4 rounded-full border border-border hover:scale-110 transition-transform bg-foreground/20 text-[8px] flex items-center justify-center"
                title="Remove color">x</button>
            </div>
          )}
        </div>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color: '#ffd70060' }).run(); }}
          className={`toolbar-btn h-5 min-w-[20px] text-[10px] ${editor.isActive('highlight') ? 'bg-muted text-foreground' : ''}`}
          title="Highlight">Hi</button>
      </div>
      {/* Editor content */}
      <div className="px-2 py-1.5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/* ─── Read-only rich HTML renderer ─── */
export function RichContent({ html, className }: { html: string; className?: string }) {
  return (
    <span className={`rich-content ${className || ''}`} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
