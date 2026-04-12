'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import type { DocxAnchorInsert, DocxAnchorStatus } from '@/types/document';

const TOKEN_REGEX = /\{\{([^}]+?)\}\}|｛｛([^｝]+?)｝｝|<([가-힣A-Za-z0-9_]{1,40})>/g;
const ANCHOR_RADIUS = 30;

interface DocxPreviewProps {
  value: string;
  disabled?: boolean;
  originalPlaceholderCounts: Record<string, number>;
  onChange: (html: string, anchorInserts: DocxAnchorInsert[], anchorStatuses: DocxAnchorStatus[]) => void;
}

export function DocxPreview({
  value,
  disabled = false,
  originalPlaceholderCounts,
  onChange,
}: DocxPreviewProps) {
  function emit(editor: Editor) {
    const plainText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\n');
    const analysis = analyzeAnchors(plainText, originalPlaceholderCounts);
    onChange(editor.getHTML(), analysis.anchorInserts, analysis.anchorStatuses);
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        defaultProtocol: 'https',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: '양식을 선택하면 여기에 내용이 표시됩니다. 회사명, 금액 등 바뀌는 부분에 {{회사명}} 형태로 표시를 넣어 두세요.',
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[560px] px-6 py-5 text-sm leading-7 text-foreground outline-none',
      },
    },
    onCreate: ({ editor: nextEditor }) => {
      emit(nextEditor);
    },
    onUpdate: ({ editor: nextEditor }) => {
      emit(nextEditor);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
      emit(editor);
    }
  }, [editor, value, originalPlaceholderCounts]);

  useEffect(() => () => {
    editor?.destroy();
  }, [editor]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-6 py-4">
        <div className="text-sm font-medium text-foreground">미리보기 · 바뀌는 자리 표시</div>
        <p className="mt-1 text-sm text-muted-foreground">
          여기에 입력한 글자는 다운로드 파일에 영향을 주지 않습니다. 회사마다 다르게 들어갈 부분만
          <span className="mx-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-primary">{'{{회사명}}'}</span>
          처럼 표시해 두세요. 전각 <span className="font-mono">｛｛｝｝</span> 이나 <span className="font-mono">&lt;회사명&gt;</span> 도 자동 인식됩니다. <b>원본 워드 파일의 글꼴·표·서식은 그대로 유지됩니다.</b>
        </p>
      </div>

      <div className="bg-white">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="px-6 py-12 text-sm text-muted-foreground">미리보기를 준비하는 중입니다…</div>
        )}
      </div>
    </div>
  );
}

function analyzeAnchors(plainText: string, originalPlaceholderCounts: Record<string, number>) {
  const normalized = normalizeAnchorText(plainText);
  const matches = Array.from(normalized.matchAll(TOKEN_REGEX));
  const anchorInserts: DocxAnchorInsert[] = [];
  const anchorStatuses: DocxAnchorStatus[] = [];
  const tokenlessText = normalized.replace(TOKEN_REGEX, '');
  const seenByKey = new Map<string, number>();

  matches.forEach((match) => {
    const rawKey = (match[1] ?? match[2] ?? match[3])?.trim();

    if (!rawKey) {
      return;
    }

    const seen = (seenByKey.get(rawKey) ?? 0) + 1;
    seenByKey.set(rawKey, seen);

    if (seen <= (originalPlaceholderCounts[rawKey] ?? 0)) {
      return;
    }

    const start = match.index ?? 0;
    const end = start + match[0].length;
    const beforeText = normalized.slice(Math.max(0, start - ANCHOR_RADIUS), start);
    const afterText = normalized.slice(end, Math.min(normalized.length, end + ANCHOR_RADIUS));
    const occurrences = countAnchorCandidates(tokenlessText, beforeText, afterText);
    const status = occurrences === 0 ? 'failed' : occurrences > 1 ? 'conflict' : 'ready';
    const message = status === 'failed'
      ? '원본 문서에서 앵커를 찾지 못했습니다.'
      : status === 'conflict'
        ? '같은 앵커가 여러 곳에 있어 첫 번째 위치를 사용합니다.'
        : '앵커 위치가 확인되었습니다.';

    anchorInserts.push({
      key: rawKey,
      beforeText,
      afterText,
    });
    anchorStatuses.push({
      key: rawKey,
      beforeText,
      afterText,
      status,
      matches: occurrences,
      message,
    });
  });

  return {
    anchorInserts,
    anchorStatuses,
  };
}

function normalizeAnchorText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/\s+/g, '');
}

function countOccurrences(text: string, search: string) {
  if (!search) {
    return 0;
  }

  let count = 0;
  let index = 0;

  while (index <= text.length) {
    const next = text.indexOf(search, index);

    if (next === -1) {
      break;
    }

    count += 1;
    index = next + 1;
  }

  return count;
}

function countAnchorCandidates(text: string, beforeText: string, afterText: string) {
  if (beforeText && afterText) {
    const exactMatches = countOccurrences(text, `${beforeText}${afterText}`);

    if (exactMatches > 0) {
      return exactMatches;
    }

    let fuzzyMatches = 0;
    let index = 0;

    while (index <= text.length) {
      const beforeIndex = text.indexOf(beforeText, index);

      if (beforeIndex === -1) {
        break;
      }

      const afterIndex = text.indexOf(afterText, beforeIndex + beforeText.length);
      if (afterIndex !== -1) {
        const gap = afterIndex - (beforeIndex + beforeText.length);

        if (gap >= 0 && gap <= 240) {
          fuzzyMatches += 1;
        }
      }

      index = beforeIndex + 1;
    }

    return fuzzyMatches;
  }

  if (beforeText) {
    return countOccurrences(text, beforeText);
  }

  if (afterText) {
    return countOccurrences(text, afterText);
  }

  return 0;
}
