import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const contracts = db.prepare(
    'SELECT * FROM contracts ORDER BY region, country, entity_code'
  ).all() as Array<{ id: string }>;

  const getFiles = db.prepare(
    'SELECT id, contract_id, file_category, file_name, file_type, file_size, created_at FROM contract_files WHERE contract_id = ?'
  );

  const contractsWithFiles = contracts.map((contract) => ({
    ...contract,
    files: getFiles.all(contract.id),
  }));

  return NextResponse.json({ contracts: contractsWithFiles });
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();

  const {
    region,
    country,
    entity_code,
    brand,
    entity_name,
    data_domain_vehicle,
    data_domain_customer,
    data_domain_sales,
    data_domain_quality,
    data_domain_production,
    contract_status,
    transfer_purpose,
    transferable_data,
  } = body;

  if (!region || !country || !entity_code || !brand || !entity_name) {
    return NextResponse.json(
      { error: 'region, country, entity_code, brand, entity_name are required' },
      { status: 400 }
    );
  }

  const stmt = db.prepare(`
    INSERT INTO contracts (
      region, country, entity_code, brand, entity_name,
      data_domain_vehicle, data_domain_customer, data_domain_sales,
      data_domain_quality, data_domain_production,
      contract_status, transfer_purpose, transferable_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    region,
    country,
    entity_code,
    brand,
    entity_name,
    data_domain_vehicle || 'null',
    data_domain_customer || 'null',
    data_domain_sales || 'null',
    data_domain_quality || 'null',
    data_domain_production || 'null',
    contract_status || null,
    transfer_purpose || null,
    transferable_data || null
  );

  const contract = db.prepare('SELECT * FROM contracts WHERE rowid = ?').get(result.lastInsertRowid);

  return NextResponse.json({ contract }, { status: 201 });
}
