import Anthropic from '@anthropic-ai/sdk';

export const MAX_CLAUDE_OCR_BYTES = 8 * 1024 * 1024;

export class ClaudeOcrTooLargeError extends Error {
  constructor(bytes: number) {
    super(`파일이 너무 커서 Claude OCR로 처리할 수 없습니다 (${Math.round(bytes / 1024 / 1024)}MB > 8MB).`);
    this.name = 'ClaudeOcrTooLargeError';
  }
}

function getClient() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Claude API key가 설정되어 있지 않습니다. (CLAUDE_API_KEY)');
  }
  return new Anthropic({ apiKey });
}

export async function extractTextFromPdfViaClaude(buffer: Buffer): Promise<string> {
  if (buffer.byteLength > MAX_CLAUDE_OCR_BYTES) {
    throw new ClaudeOcrTooLargeError(buffer.byteLength);
  }

  const client = getClient();
  const base64 = buffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text:
              '이 PDF의 모든 텍스트를 위에서 아래로, 왼쪽에서 오른쪽으로 순서대로 추출해주세요.' +
              ' 한국어/영어/숫자/기호 모두 원문 그대로 유지하고, 단락 구분은 개행으로 표현하세요.' +
              ' 해설·요약·제목 같은 메타 설명 없이 추출된 본문 텍스트만 반환해주세요.',
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return text;
}

export async function extractContractFieldsViaClaude(
  buffer: Buffer,
  mediaType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
): Promise<{ transfer_purpose: string; transferable_data: string }> {
  if (buffer.byteLength > MAX_CLAUDE_OCR_BYTES) {
    throw new ClaudeOcrTooLargeError(buffer.byteLength);
  }

  const client = getClient();
  const base64 = buffer.toString('base64');

  const contentBlock = mediaType === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64 } };

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
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
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const extracted = textBlock && 'text' in textBlock ? textBlock.text : '';
  const jsonMatch = extracted.match(/\{[\s\S]*?\}/);

  if (!jsonMatch) {
    return { transfer_purpose: '', transferable_data: '' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { transfer_purpose?: string; transferable_data?: string };
    return {
      transfer_purpose: parsed.transfer_purpose || '',
      transferable_data: parsed.transferable_data || '',
    };
  } catch {
    return { transfer_purpose: '', transferable_data: '' };
  }
}
