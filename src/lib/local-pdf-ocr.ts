import { createWorker } from 'tesseract.js';
import { loadPdfDocument, renderPdfPageToCanvas } from '@/lib/pdf-renderer';

export interface LocalOcrProgress {
  status: string;
  progress: number;
}

const RENDER_SCALE = 2;

export async function runLocalPdfOcr(
  pdfBlob: Blob,
  onProgress: (progress: LocalOcrProgress) => void,
): Promise<string> {
  onProgress({ status: 'PDF 로딩 준비 중', progress: 0.02 });

  const loaded = await loadPdfDocument(pdfBlob);
  const { doc, pageCount } = loaded;

  onProgress({ status: `${pageCount}페이지 감지 · OCR 준비 중`, progress: 0.08 });

  const worker = await createWorker(['kor', 'eng'], 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        // Remaining progress scaled within 0.15 ~ 1.0 by page
        // Actual page-scoped progress is handled in the loop below
      }
    },
  });

  try {
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      const basePct = 0.08 + ((pageNum - 1) / pageCount) * 0.9;
      onProgress({ status: `페이지 ${pageNum}/${pageCount} 렌더링`, progress: basePct });

      const page = await doc.getPage(pageNum);
      const canvas = await renderPdfPageToCanvas(page, { scale: RENDER_SCALE });

      onProgress({ status: `페이지 ${pageNum}/${pageCount} OCR`, progress: basePct + (0.9 / pageCount) * 0.3 });

      const { data } = await worker.recognize(canvas);
      pageTexts.push(data.text);

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup?.();
    }

    onProgress({ status: '완료', progress: 1 });
    return pageTexts.join('\n\n').trim();
  } finally {
    await worker.terminate();
    await loaded.destroy();
  }
}
