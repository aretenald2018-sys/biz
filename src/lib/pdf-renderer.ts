// @ts-expect-error - Vite resolves this URL import; no type declaration available
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

const DEFAULT_RENDER_SCALE = 1.35;

interface PdfTextContentLike {
  items: Array<{ str?: string }>;
}

interface PdfPageLike {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<unknown> };
  getTextContent: () => Promise<PdfTextContentLike>;
  cleanup?: () => void;
}

interface PdfDocumentLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageLike>;
  cleanup: () => Promise<void> | void;
  destroy: () => Promise<void> | void;
}

export interface LoadedPdfDocument {
  doc: PdfDocumentLike;
  pageCount: number;
  destroy: () => Promise<void>;
}

export interface RenderedPdfPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  text: string;
}

export interface RenderedPdfDocument {
  pages: RenderedPdfPage[];
  dispose: () => Promise<void>;
}

let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function loadPdfDocument(source: Blob | ArrayBuffer): Promise<LoadedPdfDocument> {
  const pdfjs = await getPdfJs();
  const data = source instanceof Blob ? await source.arrayBuffer() : source;
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise as unknown as PdfDocumentLike;

  return {
    doc,
    pageCount: doc.numPages,
    destroy: async () => {
      await Promise.resolve(doc.cleanup());
      await Promise.resolve(doc.destroy());
    },
  };
}

export async function renderPdfPageToCanvas(
  page: PdfPageLike,
  options: { scale?: number } = {},
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: options.scale ?? DEFAULT_RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.className = 'block h-auto w-full rounded-md border bg-white shadow-sm';

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Canvas 컨텍스트를 만들 수 없습니다.');
  }

  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas;
}

export async function extractPdfPageText(page: PdfPageLike): Promise<string> {
  const content = await page.getTextContent();
  return normalizePdfPageText(content.items);
}

export async function renderPdfToCanvases(
  source: Blob | ArrayBuffer,
  options: { scale?: number } = {},
): Promise<RenderedPdfDocument> {
  const loaded = await loadPdfDocument(source);
  const pages: RenderedPdfPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= loaded.pageCount; pageNumber += 1) {
      const page = await loaded.doc.getPage(pageNumber);
      const canvas = await renderPdfPageToCanvas(page, options);
      const text = await extractPdfPageText(page);
      pages.push({ pageNumber, canvas, text });
      page.cleanup?.();
    }

    return {
      pages,
      dispose: async () => {
        pages.forEach((page) => releaseCanvas(page.canvas));
        await loaded.destroy();
      },
    };
  } catch (error) {
    pages.forEach((page) => releaseCanvas(page.canvas));
    await loaded.destroy();
    throw error;
  }
}

async function getPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string;
      return pdfjs;
    });
  }

  return pdfJsPromise;
}

function normalizePdfPageText(items: Array<{ str?: string }>) {
  return items
    .map((item) => item.str || '')
    .filter((value) => value.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
  canvas.remove();
}
