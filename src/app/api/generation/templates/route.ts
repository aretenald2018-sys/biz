import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createTemplate, listTemplates } from '@/lib/generation';

export async function GET(request: NextRequest) {
  const type = new URL(request.url).searchParams.get('type') || '';
  try {
    const db = getDb();
    return NextResponse.json(listTemplates(db, type));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();
    const template = createTemplate(db, {
      type: typeof body?.type === 'string' ? body.type : '',
      name: typeof body?.name === 'string' ? body.name : '',
      content: typeof body?.content === 'string' ? body.content : '',
      is_default: body?.is_default === 1 ? 1 : 0,
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
