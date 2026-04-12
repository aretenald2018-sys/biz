import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createBestPractice, listBestPractices } from '@/lib/generation';

export async function GET(request: NextRequest) {
  const type = new URL(request.url).searchParams.get('type') || '';
  try {
    const db = getDb();
    return NextResponse.json(listBestPractices(db, type));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();
    const item = createBestPractice(db, {
      type: typeof body?.type === 'string' ? body.type : '',
      title: typeof body?.title === 'string' ? body.title : '',
      content: typeof body?.content === 'string' ? body.content : '',
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
