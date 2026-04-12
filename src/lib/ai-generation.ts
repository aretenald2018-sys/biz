import Anthropic from '@anthropic-ai/sdk';
import type { GenerationType } from '@/types/generation';

interface GenerateInput {
  type: GenerationType;
  ticketTitle: string;
  templateContent: string;
  bestPractices: Array<{ title: string; content: string }>;
  notes: Array<{ title: string; content: string; updated_at: string }>;
  emails: Array<{ subject: string | null; sender_name: string | null; body_text: string | null; sent_date: string | null }>;
  rangeLabel?: string;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildContext(input: GenerateInput) {
  const emailContext = input.emails.slice(0, 60).map((item, index) => (
    `--- Email ${index + 1} ---\nDate: ${item.sent_date || 'Unknown'}\nFrom: ${item.sender_name || 'Unknown'}\nSubject: ${item.subject || '(No Subject)'}\n${item.body_text || '(No Content)'}`
  )).join('\n\n');

  const noteContext = input.notes.slice(0, 60).map((note, index) => (
    `--- Note ${index + 1} ---\nTitle: ${note.title}\nUpdated: ${note.updated_at}\n${stripHtmlToText(note.content || '') || '(No Content)'}`
  )).join('\n\n');

  const bestPracticeContext = input.bestPractices.length > 0
    ? input.bestPractices.map((item, index) => `${index + 1}. ${item.title}\n${item.content}`).join('\n\n')
    : '없음';

  return { emailContext, noteContext, bestPracticeContext };
}

function buildSystemPrompt(input: GenerateInput) {
  const common = [
    '당신은 한국어 비즈니스 문서 작성 전문가다.',
    '출력은 마크다운만 반환한다.',
    '사실 기반으로만 작성하고, 근거 없는 추측은 금지한다.',
    `템플릿 구조를 반드시 따른다:\n${input.templateContent || '(템플릿 없음)'}`,
    `Best Practice 참고:\n${input.bestPractices.length > 0 ? '있음' : '없음'}`,
  ].join('\n\n');

  if (input.type === 'weekly_report') {
    return `${common}\n\n주간보고 스타일로 간결하게 작성한다. 항목별 핵심을 불릿으로 요약한다.`;
  }
  return `${common}\n\n두레이 보고용 문서로 작성한다. 임원 보고용 A4 1장 분량(약 700~1200자)을 목표로 한다.`;
}

async function generateWithClaude(systemPrompt: string, userPrompt: string) {
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2400,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.text || '';
}

async function generateWithGemini(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      }),
    },
  );
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generate(input: GenerateInput) {
  const provider = process.env.AI_PROVIDER || 'claude';
  const { emailContext, noteContext, bestPracticeContext } = buildContext(input);
  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = [
    `티켓: ${input.ticketTitle}`,
    input.rangeLabel ? `기간: ${input.rangeLabel}` : null,
    '아래 내용을 참고해 문서를 작성하라.',
    `Best Practices:\n${bestPracticeContext}`,
    `Notes:\n${noteContext || '(없음)'}`,
    `Emails:\n${emailContext || '(없음)'}`,
  ].filter(Boolean).join('\n\n');

  if (provider === 'gemini') {
    return generateWithGemini(systemPrompt, userPrompt);
  }
  return generateWithClaude(systemPrompt, userPrompt);
}

export async function generateWeeklyReport(input: Omit<GenerateInput, 'type'>) {
  return generate({ ...input, type: 'weekly_report' });
}

export async function generateDoorayReport(input: Omit<GenerateInput, 'type'>) {
  return generate({ ...input, type: 'dooray' });
}

