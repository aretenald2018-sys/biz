import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { deleteTemplate, updateTemplate } from '@/lib/generation';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const db = getDb();
    const template = updateTemplate(db, id, {
      name: typeof body?.name === 'string' ? body.name : undefined,
      content: typeof body?.content === 'string' ? body.content : undefined,
      is_default: typeof body?.is_default === 'number' ? body.is_default : undefined,
    });
    return NextResponse.json(template);
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
    deleteTemplate(db, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

