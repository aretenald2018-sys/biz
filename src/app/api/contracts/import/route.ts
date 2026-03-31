import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Flexible header matching: multiple aliases per field
const HEADER_ALIASES: [string[], string][] = [
  [['리전', 'region', '리젼', '지역'], 'region'],
  [['국가', 'country', '나라'], 'country'],
  [['법인명', 'entity_code', 'entity', 'code', '법인코드'], 'entity_code'],
  [['브랜드', 'brand', '브랜드명'], 'brand'],
  [['법인명상세', 'entity_name', 'name', '법인명 상세', '상세명'], 'entity_name'],
  [['차량', 'vehicle', 'data_domain_vehicle'], 'data_domain_vehicle'],
  [['고객', 'customer', 'data_domain_customer'], 'data_domain_customer'],
  [['판매', 'sales', 'data_domain_sales'], 'data_domain_sales'],
  [['품질', 'quality', 'data_domain_quality'], 'data_domain_quality'],
  [['생산', 'production', 'data_domain_production'], 'data_domain_production'],
  [['계약체결일', 'contract_status', '계약일', '체결일', '계약 체결일'], 'contract_status'],
  [['이전가능목적', '이전가능 목적', 'transfer_purpose', '이전목적'], 'transfer_purpose'],
  [['이전가능데이터', '이전가능 데이터', 'transferable_data', '이전데이터'], 'transferable_data'],
];

function matchHeader(header: string): string | null {
  const h = header.trim().toLowerCase().replace(/\s+/g, '');
  for (const [aliases, field] of HEADER_ALIASES) {
    for (const alias of aliases) {
      if (alias.toLowerCase().replace(/\s+/g, '') === h) return field;
    }
  }
  return null;
}

function normalizeDomainValue(value: string | undefined | null): string {
  if (!value) return 'null';
  const trimmed = value.trim().toUpperCase();
  if (trimmed === 'O') return 'O';
  if (trimmed === 'X') return 'X';
  return 'null';
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const text = await file.text();

  let rows: string[][];

  if (fileName.endsWith('.csv')) {
    rows = parseDelimited(text, ',');
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.tsv')) {
    // Excel copy-paste creates TSV, also handle .tsv files
    rows = parseDelimited(text, '\t');
  } else {
    return NextResponse.json(
      { error: 'Unsupported file format. Use CSV, TSV, or tab-delimited text.' },
      { status: 400 }
    );
  }

  if (rows.length < 2) {
    return NextResponse.json({ error: 'File must have a header row and at least one data row' }, { status: 400 });
  }

  const headerRow = rows[0];
  const columnMapping: (string | null)[] = headerRow.map((header) => matchHeader(header));

  const entityCodeIndex = columnMapping.indexOf('entity_code');
  if (entityCodeIndex === -1) {
    return NextResponse.json(
      { error: 'Missing required column: entity_code (법인명)' },
      { status: 400 }
    );
  }

  // Track which fields are present in the CSV
  const presentFields = new Set(columnMapping.filter((f): f is string => f !== null));

  const DOMAIN_FIELDS = ['data_domain_vehicle', 'data_domain_customer', 'data_domain_sales', 'data_domain_quality', 'data_domain_production'];
  const TEXT_FIELDS = ['region', 'country', 'brand', 'entity_name', 'contract_status', 'transfer_purpose', 'transferable_data'];

  const findByEntityCode = db.prepare('SELECT * FROM contracts WHERE entity_code = ?');

  let imported = 0;
  const dataRows = rows.slice(1);

  const runImport = db.transaction(() => {
    for (const row of dataRows) {
      const record: Record<string, string> = {};
      for (let i = 0; i < columnMapping.length; i++) {
        const field = columnMapping[i];
        if (field && i < row.length) {
          record[field] = row[i];
        }
      }

      if (!record.entity_code || !record.entity_code.trim()) continue;

      const entityCode = record.entity_code.trim();
      const existing = findByEntityCode.get(entityCode) as Record<string, string> | undefined;

      if (existing) {
        // Only update fields that are present in the CSV — leave others untouched
        const setClauses: string[] = [];
        const values: (string | null)[] = [];

        for (const f of TEXT_FIELDS) {
          if (presentFields.has(f)) {
            setClauses.push(`${f} = ?`);
            values.push(record[f] || '');
          }
        }
        for (const f of DOMAIN_FIELDS) {
          if (presentFields.has(f)) {
            setClauses.push(`${f} = ?`);
            values.push(normalizeDomainValue(record[f]));
          }
        }

        if (setClauses.length > 0) {
          setClauses.push("updated_at = datetime('now','localtime')");
          values.push(entityCode);
          db.prepare(`UPDATE contracts SET ${setClauses.join(', ')} WHERE entity_code = ?`).run(...values);
        }
      } else {
        // Insert: use defaults for missing fields
        db.prepare(`
          INSERT INTO contracts (
            region, country, entity_code, brand, entity_name,
            data_domain_vehicle, data_domain_customer, data_domain_sales,
            data_domain_quality, data_domain_production, contract_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.region || '',
          record.country || '',
          entityCode,
          record.brand || '',
          record.entity_name || '',
          normalizeDomainValue(record.data_domain_vehicle),
          normalizeDomainValue(record.data_domain_customer),
          normalizeDomainValue(record.data_domain_sales),
          normalizeDomainValue(record.data_domain_quality),
          normalizeDomainValue(record.data_domain_production),
          record.contract_status || null
        );
      }
      imported++;
    }
  });

  runImport();

  return NextResponse.json({ imported });
}
