import { NextRequest, NextResponse } from 'next/server';
import { generateBusinessEmailDraft } from '@/lib/ai-client';

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
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const noteContent = typeof body?.note_content === 'string' ? body.note_content : '';
  const noteTitle = typeof body?.note_title === 'string' ? body.note_title : null;
  const customPrompt = typeof body?.custom_prompt === 'string' ? body.custom_prompt : undefined;

  if (!noteContent.trim()) {
    return NextResponse.json({ error: 'note_content is required' }, { status: 400 });
  }

  try {
    const draft = await generateBusinessEmailDraft({
      noteTitle,
      noteContent: stripHtmlToText(noteContent),
      customPrompt: customPrompt?.trim() || undefined,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Business email draft failed: ${message}` }, { status: 500 });
  }
}
