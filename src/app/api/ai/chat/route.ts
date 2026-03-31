import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  const { email_context, messages } = await request.json();
  const provider = process.env.AI_PROVIDER || 'claude';

  const systemPrompt = `You are an email analysis assistant. You have access to the following email:

Subject: ${email_context.subject || '(No Subject)'}
From: ${email_context.sender || 'Unknown'}
Date: ${email_context.date || 'Unknown'}

Email Body:
${email_context.body || '(No content)'}

Answer questions about this email in Korean. Be concise and helpful. When first asked for analysis, provide:
1. 요약 (Summary)
2. 주요 포인트 (Key Points)
3. 필요한 조치사항 (Action Items)
For follow-up questions, answer based on the email content.`;

  try {
    if (provider === 'claude') {
      const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
      const apiMessages = messages.map((m: {role: string; content: string}) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: apiMessages,
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return NextResponse.json({ response: textBlock?.text || 'No response generated.' });
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      const lastMessage = messages[messages.length - 1];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${lastMessage.content}` }] }],
          }),
        }
      );
      const data = await res.json();
      return NextResponse.json({ response: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.' });
    }

    return NextResponse.json({ response: 'AI provider not configured.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ response: `AI error: ${msg}` }, { status: 500 });
  }
}
