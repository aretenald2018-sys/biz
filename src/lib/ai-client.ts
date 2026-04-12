import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_BUSINESS_EMAIL_PROMPT } from './business-email-prompt';

export async function generateSummary(emails: { subject: string | null; sender_name: string | null; body_text: string | null; sent_date: string | null }[]): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'claude';

  const emailContext = emails
    .map((e, i) => `--- Email ${i + 1} ---\nDate: ${e.sent_date || 'Unknown'}\nFrom: ${e.sender_name || 'Unknown'}\nSubject: ${e.subject || '(No Subject)'}\n\n${e.body_text || '(No Content)'}`)
    .join('\n\n');

  const systemPrompt = `You are an executive briefing assistant. Analyze the provided email chain and produce a concise Korean-language summary for executive reporting. Structure your response in markdown with these sections:

## 경위 (Background)
Brief timeline of the communication.

## 주요 쟁점 (Key Issues)
Bullet points of the main discussion points and disagreements.

## 현재 상태 (Current Status)
Where things stand now.

## 후속 조치 (Next Actions)
Required follow-up actions.

Keep the summary professional and factual. Write in Korean.`;

  if (provider === 'claude') {
    const client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `다음 이메일 체인을 분석하여 임원 보고용 요약을 작성해주세요:\n\n${emailContext}` },
      ],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'Summary generation failed.';
  }

  // Gemini fallback
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n다음 이메일 체인을 분석하여 임원 보고용 요약을 작성해주세요:\n\n${emailContext}` }] }],
        }),
      }
    );

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Summary generation failed.';
  }

  return 'AI provider not configured. Set AI_PROVIDER in .env';
}

export async function generateBusinessEmailDraft(input: {
  noteTitle?: string | null;
  noteContent: string;
  customPrompt?: string;
}): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'claude';
  const context = [
    input.noteTitle ? `Note Title: ${input.noteTitle}` : null,
    `Note Content:\n${input.noteContent}`,
  ].filter(Boolean).join('\n\n');

  const systemPrompt = input.customPrompt || DEFAULT_BUSINESS_EMAIL_PROMPT;

  if (provider === 'claude') {
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: context },
      ],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.text || 'Business email draft generation failed.';
  }

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${context}` }] }],
        }),
      }
    );

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Business email draft generation failed.';
  }

  return 'AI provider not configured. Set AI_PROVIDER in .env';
}

export { DEFAULT_BUSINESS_EMAIL_PROMPT } from './business-email-prompt';
