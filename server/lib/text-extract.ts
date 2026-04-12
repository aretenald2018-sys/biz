import mammoth from 'mammoth';
import { extractTextFromPdfViaClaude, ClaudeOcrTooLargeError } from '@/lib/ocr-claude';

export type ExtractionSource = 'docx' | 'pdf-text' | 'pdf-ocr' | 'pdf-override';

export interface ExtractionResult {
  text: string;
  source: ExtractionSource;
  warnings: string[];
}

const PDF_TEXT_MIN_CHARS = 50;
const PDF_TEXT_MIN_PER_PAGE = 20;

function inferKind(filename: string, mimeType: string | null): 'docx' | 'pdf' | 'unknown' {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'docx';
  }
  return 'unknown';
}

export async function extractTextForDiff(
  buffer: Buffer,
  filename: string,
  mimeType: string | null,
  options: { overrideText?: string | null } = {},
): Promise<ExtractionResult> {
  if (options.overrideText && options.overrideText.trim().length > 0) {
    return { text: options.overrideText, source: 'pdf-override', warnings: [] };
  }

  const kind = inferKind(filename, mimeType);

  if (kind === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value ?? '', source: 'docx', warnings: [] };
  }

  if (kind === 'pdf') {
    return extractFromPdf(buffer);
  }

  throw new Error(`지원하지 않는 파일 형식입니다: ${filename}`);
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const warnings: string[] = [];

  try {
    const layered = await extractPdfTextLayer(buffer);
    const trimmedLength = layered.text.replace(/\s+/g, '').length;
    const perPage = layered.pageCount > 0 ? trimmedLength / layered.pageCount : 0;

    if (trimmedLength >= PDF_TEXT_MIN_CHARS && perPage >= PDF_TEXT_MIN_PER_PAGE) {
      return { text: layered.text, source: 'pdf-text', warnings };
    }

    warnings.push('PDF 텍스트층이 없거나 너무 적어서 Claude OCR로 처리했습니다.');
  } catch (error) {
    warnings.push(`PDF 텍스트층 추출 실패, OCR로 대체: ${error instanceof Error ? error.message : error}`);
  }

  try {
    const ocrText = await extractTextFromPdfViaClaude(buffer);
    return { text: ocrText, source: 'pdf-ocr', warnings };
  } catch (error) {
    if (error instanceof ClaudeOcrTooLargeError) {
      throw new Error(
        'PDF가 8MB를 초과해 자동 OCR이 불가합니다. 업로드 카드의 "로컬 OCR 실행" 버튼으로 처리해주세요.',
      );
    }
    throw error;
  }
}

async function extractPdfTextLayer(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const loadingTask = pdfjs.getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter((s) => s.length > 0);
    pageTexts.push(items.join(' '));
  }

  await doc.cleanup();
  await doc.destroy();

  return {
    text: pageTexts.join('\n\n').trim(),
    pageCount,
  };
}
