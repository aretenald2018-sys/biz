import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const versions = db.prepare(
    'SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version_number DESC'
  ).all(id);

  // Attach files per version
  const getFiles = db.prepare(
    'SELECT * FROM contract_files WHERE version_id = ? ORDER BY created_at DESC'
  );

  const versionsWithFiles = (versions as { id: string }[]).map(v => ({
    ...v,
    files: getFiles.all(v.id),
  }));

  return NextResponse.json(versionsWithFiles);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const { change_reason, transfer_purpose, transferable_data, effective_date, added_domains, status } = body;

  // Get next version number
  const maxVer = db.prepare(
    'SELECT MAX(version_number) as m FROM contract_versions WHERE contract_id = ?'
  ).get(id) as { m: number | null };
  const nextVer = (maxVer?.m ?? 0) + 1;

  const stmt = db.prepare(`
    INSERT INTO contract_versions (contract_id, version_number, change_reason, transfer_purpose, transferable_data, effective_date, added_domains, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const domainsJson = added_domains ? JSON.stringify(added_domains) : null;
  const result = stmt.run(id, nextVer, change_reason || null, transfer_purpose || null, transferable_data || null, effective_date || null, domainsJson, status || 'pending');

  // Update main contract with latest version data + activity timestamp
  const updates: string[] = ["last_activity_at = datetime('now','localtime')", "updated_at = datetime('now','localtime')"];
  const values: unknown[] = [];

  if (transfer_purpose !== undefined) { updates.push('transfer_purpose = ?'); values.push(transfer_purpose); }
  if (transferable_data !== undefined) { updates.push('transferable_data = ?'); values.push(transferable_data); }

  values.push(id);
  db.prepare(`UPDATE contracts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const version = db.prepare('SELECT * FROM contract_versions WHERE rowid = ?').get(result.lastInsertRowid);
  return NextResponse.json(version, { status: 201 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  const db = getDb();
  const body = await request.json();
  const { version_id, status, added_domains, change_reason, transfer_purpose, transferable_data, effective_date } = body;

  if (!version_id) return NextResponse.json({ error: 'version_id required' }, { status: 400 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (added_domains !== undefined) { fields.push('added_domains = ?'); values.push(JSON.stringify(added_domains)); }
  if (change_reason !== undefined) { fields.push('change_reason = ?'); values.push(change_reason); }
  if (transfer_purpose !== undefined) { fields.push('transfer_purpose = ?'); values.push(transfer_purpose); }
  if (transferable_data !== undefined) { fields.push('transferable_data = ?'); values.push(transferable_data); }
  if (effective_date !== undefined) { fields.push('effective_date = ?'); values.push(effective_date); }

  if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });

  fields.push("updated_at = datetime('now','localtime')");
  values.push(version_id);
  db.prepare(`UPDATE contract_versions SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // If completed, update parent contract domains
  if (status === 'completed') {
    const ver = db.prepare('SELECT * FROM contract_versions WHERE id = ?').get(version_id) as { added_domains: string | null } | undefined;
    if (ver?.added_domains) {
      const domains: string[] = JSON.parse(ver.added_domains);
      const domainMap: Record<string, string> = {
        vehicle: 'data_domain_vehicle', customer: 'data_domain_customer',
        sales: 'data_domain_sales', quality: 'data_domain_quality', production: 'data_domain_production',
      };
      for (const d of domains) {
        const col = domainMap[d];
        if (col) db.prepare(`UPDATE contracts SET ${col} = 'O', updated_at = datetime('now','localtime') WHERE id = ?`).run(contractId);
      }
    }
  }

  const updated = db.prepare('SELECT * FROM contract_versions WHERE id = ?').get(version_id);
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('version_id');

  if (!versionId) {
    return NextResponse.json({ error: 'version_id required' }, { status: 400 });
  }

  db.prepare('DELETE FROM contract_versions WHERE id = ?').run(versionId);
  return NextResponse.json({ success: true });
}
