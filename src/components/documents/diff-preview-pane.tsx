'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { FileText, LoaderCircle } from 'lucide-react';
import { renderPdfToCanvases, type RenderedPdfDocument } from '@/lib/pdf-renderer';
import { cn } from '@/lib/utils';

type DiffPreviewPayload =
  | { kind: 'docx'; html: string }
  | { kind: 'pdf' };

interface PdfPreviewPage {
  pageNumber: number;
  text: string;
}

export interface DiffPreviewPaneHandle {
  scrollToText: (text: string) => void;
}

interface DiffPreviewPaneProps {
  uploadId: string;
  fileType: string | null;
  filename: string;
}

export const DiffPreviewPane = forwardRef<DiffPreviewPaneHandle, DiffPreviewPaneProps>(function DiffPreviewPane(
  { uploadId, fileType, filename },
  ref,
) {
  const [previewKind, setPreviewKind] = useState<'docx' | 'pdf' | null>(null);
  const [docxHtml, setDocxHtml] = useState('');
  const [pdfPages, setPdfPages] = useState<PdfPreviewPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const docxArticleRef = useRef<HTMLElement | null>(null);
  const pageFrameRefs = useRef(new Map<number, HTMLDivElement>());
  const pageHostRefs = useRef(new Map<number, HTMLDivElement>());
  const pdfRenderRef = useRef<RenderedPdfDocument | null>(null);
  const highlightedRef = useRef<HTMLElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    scrollToText(text: string) {
      const normalizedTarget = normalizeSearchText(text);

      if (!normalizedTarget) {
        return;
      }

      if (previewKind === 'docx') {
        const target = findDocxElement(docxArticleRef.current, normalizedTarget);

        if (target) {
          revealElement(target);
        }

        return;
      }

      if (previewKind === 'pdf') {
        const pageNumber = findPdfPageNumber(pdfPages, normalizedTarget);
        const target = pageNumber ? pageFrameRefs.current.get(pageNumber) : null;

        if (target) {
          revealElement(target);
        }
      }
    },
  }), [pdfPages, previewKind]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPreviewKind(null);
    setDocxHtml('');
    setPdfPages([]);
    pageFrameRefs.current.clear();
    pageHostRefs.current.clear();
    clearHighlight();

    void (async () => {
      await disposePdfRender();

      try {
        const previewResponse = await fetch(`/api/documents/diff/${uploadId}/preview`);

        if (!previewResponse.ok) {
          throw new Error(await readResponseError(previewResponse, '문서 미리보기를 불러오지 못했습니다.'));
        }

        const preview = await previewResponse.json() as DiffPreviewPayload;

        if (cancelled) {
          return;
        }

        setPreviewKind(preview.kind);

        if (preview.kind === 'docx') {
          setDocxHtml(sanitizeDocxHtml(preview.html));
          setLoading(false);
          return;
        }

        const rawResponse = await fetch(`/api/documents/diff/${uploadId}/raw`);

        if (!rawResponse.ok) {
          throw new Error(await readResponseError(rawResponse, 'PDF 원본을 불러오지 못했습니다.'));
        }

        const blob = await rawResponse.blob();
        const rendered = await renderPdfToCanvases(blob);

        if (cancelled) {
          await rendered.dispose();
          return;
        }

        pdfRenderRef.current = rendered;
        setPdfPages(rendered.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
        })));
        setLoading(false);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : '문서 미리보기를 불러오지 못했습니다.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearHighlight();
      pageFrameRefs.current.clear();
      pageHostRefs.current.clear();
      void disposePdfRender();
    };
  }, [uploadId]);

  useEffect(() => {
    const rendered = pdfRenderRef.current;

    if (previewKind !== 'pdf' || !rendered) {
      return;
    }

    rendered.pages.forEach((page) => {
      const host = pageHostRefs.current.get(page.pageNumber);

      if (host) {
        mountCanvas(host, page.canvas);
      }
    });
  }, [pdfPages, previewKind]);

  function clearHighlight() {
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }

    highlightedRef.current?.classList.remove('diff-preview-hit');
    highlightedRef.current = null;
  }

  function revealElement(element: HTMLElement) {
    clearHighlight();
    highlightedRef.current = element;
    element.classList.add('diff-preview-hit');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightTimerRef.current = window.setTimeout(() => {
      element.classList.remove('diff-preview-hit');
      if (highlightedRef.current === element) {
        highlightedRef.current = null;
      }
      highlightTimerRef.current = null;
    }, 1200);
  }

  async function disposePdfRender() {
    const rendered = pdfRenderRef.current;
    pdfRenderRef.current = null;

    if (rendered) {
      await rendered.dispose();
    }
  }

  function setPageFrame(pageNumber: number, node: HTMLDivElement | null) {
    if (!node) {
      pageFrameRefs.current.delete(pageNumber);
      return;
    }

    pageFrameRefs.current.set(pageNumber, node);
  }

  function setPageHost(pageNumber: number, node: HTMLDivElement | null) {
    if (!node) {
      pageHostRefs.current.delete(pageNumber);
      return;
    }

    pageHostRefs.current.set(pageNumber, node);

    const page = pdfRenderRef.current?.pages.find((item) => item.pageNumber === pageNumber);

    if (page) {
      mountCanvas(node, page.canvas);
    }
  }

  const previewTypeLabel = previewKind === 'pdf' || isPdfFile(fileType, filename) ? 'PDF' : 'DOCX';
  const description = previewKind === 'pdf'
    ? '원본 페이지 렌더'
    : previewKind === 'docx'
      ? 'mammoth HTML 미리보기'
      : '원본 서식 미리보기';

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{filename}</div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
          previewTypeLabel === 'PDF'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-primary/20 bg-secondary/60 text-primary',
        )}>
          <FileText className="h-3 w-3" />
          {previewTypeLabel}
        </span>
      </div>

      <div className="h-[640px] overflow-auto bg-white">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 px-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            원본 서식 미리보기를 준비하는 중입니다…
          </div>
        ) : error ? (
          <div className="px-6 py-10 text-sm text-rose-700">{error}</div>
        ) : previewKind === 'docx' ? (
          <article
            ref={docxArticleRef}
            className="diff-preview-docx px-6 py-6"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        ) : (
          <div className="space-y-4 p-4">
            {pdfPages.map((page) => (
              <div
                key={page.pageNumber}
                ref={(node) => {
                  setPageFrame(page.pageNumber, node);
                }}
                className="rounded-xl border bg-secondary/20 p-3"
              >
                <div className="mb-2 text-[11px] font-medium text-muted-foreground">페이지 {page.pageNumber}</div>
                <div
                  ref={(node) => {
                    setPageHost(page.pageNumber, node);
                  }}
                  className="overflow-hidden rounded-md"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function mountCanvas(host: HTMLDivElement, canvas: HTMLCanvasElement) {
  if (canvas.parentElement !== host) {
    host.replaceChildren(canvas);
  }
}

function findDocxElement(container: HTMLElement | null, normalizedTarget: string) {
  if (!container) {
    return null;
  }

  const blocks = container.querySelectorAll<HTMLElement>('p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote');

  for (const block of blocks) {
    if (normalizeSearchText(block.textContent || '').includes(normalizedTarget)) {
      return block;
    }
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();

  while (current) {
    if (normalizeSearchText(current.textContent || '').includes(normalizedTarget)) {
      return current.parentElement;
    }
    current = walker.nextNode();
  }

  return null;
}

function findPdfPageNumber(pages: PdfPreviewPage[], normalizedTarget: string) {
  const directMatch = pages.find((page) => normalizeSearchText(page.text).includes(normalizedTarget));

  if (directMatch) {
    return directMatch.pageNumber;
  }

  if (normalizedTarget.length < 18) {
    return null;
  }

  const shortened = normalizedTarget.slice(0, Math.min(48, normalizedTarget.length));
  return pages.find((page) => normalizeSearchText(page.text).includes(shortened))?.pageNumber ?? null;
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, '').trim();
}

function sanitizeDocxHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['style', 'class', 'colspan', 'rowspan', 'src', 'alt'],
    ADD_TAGS: ['img'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#|data:image\/)/i,
  });
}

function isPdfFile(fileType: string | null, filename: string) {
  return fileType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
}

async function readResponseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return payload?.error || fallback;
}
