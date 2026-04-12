import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const MAX_OCR_FILE_BYTES = 8 * 1024 * 1024;

type ContractFileRow = {
  file_blob: Uint8Array | ArrayBuffer;
  file_type: string;
};

function toBinaryView(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  return null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  // Find the latest final_contract PDF
  const file = db.prepare(
    'SELECT * FROM contract_files WHERE contract_id = ? AND file_category = ? ORDER BY created_at DESC LIMIT 1'
  ).get(id, 'final_contract') as ContractFileRow | undefined;

  if (!file) {
    return NextResponse.json({ error: 'No final contract file found. Upload a PDF first.' }, { status: 404 });
  }

  const provider = process.env.AI_PROVIDER || 'claude';

  try {
    let extractedText = '';

    // Try to use Claude Vision API for PDF analysis
    if (provider === 'claude') {
      const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
      const fileBytes = toBinaryView(file.file_blob);

      if (!fileBytes) {
        return NextResponse.json({ error: 'Stored contract file is not a supported binary format.' }, { status: 500 });
      }

      if (fileBytes.byteLength > MAX_OCR_FILE_BYTES) {
        return NextResponse.json({
          error: 'OCR file is too large. Please upload a PDF smaller than 8MB.',
        }, { status: 413 });
      }

      // Reuse the existing binary buffer when possible to avoid an extra Blob -> Buffer copy.
      const base64 = Buffer
        .from(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength)
        .toString('base64');
      const isPdf = file.file_type === 'application/pdf';

      const contentBlock = isPdf
        ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
        : { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: base64 } };

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `이 계약서 문서를 분석하여 다음 정보를 추출해주세요:

1. **이전가능 목적**: 데이터 이전의 목적 (예: 품질 개선, 고객 서비스, 마케팅 등)
2. **이전가능 데이터**: 이전 가능한 데이터의 종류 (예: 차량 정보, 고객 정보, 판매 데이터 등)

JSON 형식으로 반환해주세요:
{"transfer_purpose": "...", "transferable_data": "..."}

정보를 찾을 수 없는 경우 해당 필드를 빈 문자열로 설정하세요.`,
            },
          ],
        }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      extractedText = textBlock?.text || '';
    }

    // Parse JSON from response
    const jsonMatch = extractedText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      db.prepare(
        "UPDATE contracts SET transfer_purpose = ?, transferable_data = ?, updated_at = datetime('now','localtime') WHERE id = ?"
      ).run(parsed.transfer_purpose || '', parsed.transferable_data || '', id);

      return NextResponse.json({
        transfer_purpose: parsed.transfer_purpose,
        transferable_data: parsed.transferable_data,
      });
    }

    return NextResponse.json({ error: 'Could not extract data from document' }, { status: 500 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `OCR failed: ${msg}` }, { status: 500 });
  }
}
