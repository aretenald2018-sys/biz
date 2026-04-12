import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { deleteBestPractice, updateBestPractice } from '@/lib/generation';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();
    const item = updateBestPractice(db, id, {
      title: typeof body?.title === 'string' ? body.title : undefined,
      content: typeof body?.content === 'string' ? body.content : undefined,
    });
    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const db = getDb();
    deleteBestPractice(db, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

