import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const files = db.prepare(
    'SELECT id, contract_id, file_category, file_name, file_type, file_size, created_at FROM contract_files WHERE contract_id = ?'
  ).all(id);

  return NextResponse.json({ contract: { ...(contract as object), files } });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const existing = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  const allowedFields = [
    'region', 'country', 'entity_code', 'brand', 'entity_name',
    'data_domain_vehicle', 'data_domain_customer', 'data_domain_sales',
    'data_domain_quality', 'data_domain_production',
    'contract_status', 'transfer_purpose', 'transferable_data',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now','localtime')");
  values.push(id);

  db.prepare(`UPDATE contracts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);

  return NextResponse.json({ contract: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  db.prepare('DELETE FROM contracts WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
