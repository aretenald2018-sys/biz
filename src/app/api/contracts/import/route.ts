import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as XLSX from 'xlsx';

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
  if (value === null || value === undefined) return 'null';
  const trimmed = String(value).trim().toUpperCase();
  if (trimmed === 'O') return 'O';
  if (trimmed === 'X') return 'X';
  if (trimmed === 'NULL' || trimmed === '' || trimmed === '-' || trimmed === 'N/A') return 'null';
  return 'null';
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

// Merge multi-row headers: e.g. row1 = ["","","","","","데이터 도메인","","","",""], row2 = ["리전","국가","법인명","브랜드","법인명상세","차량","고객","판매","품질","생산"]
// For cells where row1 has a group label (like "데이터 도메인") and row2 has sub-labels, try both combined and individual.
function mergeHeaderRows(row1: string[], row2: string[]): string[] {
  const maxLen = Math.max(row1.length, row2.length);
  const merged: string[] = [];
  for (let i = 0; i < maxLen; i++) {
    const top = String(row1[i] ?? '').trim();
    const bot = String(row2[i] ?? '').trim();
    if (top && bot) {
      // Try bottom first (more specific), then combined
      merged.push(bot || `${top} ${bot}`);
    } else {
      merged.push(bot || top);
    }
  }
  return merged;
}

// Find the header row(s) in an array of rows — supports 1-row and 2-row headers
function findHeaderRow(rows: string[][]): { headerIndex: number; mapping: (string | null)[] } | null {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    // Try single row first
    const mapping = rows[i].map((h) => matchHeader(String(h)));
    const matched = mapping.filter((m) => m !== null).length;
    if (matched >= 5 && mapping.includes('entity_code')) {
      return { headerIndex: i, mapping };
    }

    // Try merging with next row (2-row header)
    if (i + 1 < rows.length) {
      const merged = mergeHeaderRows(rows[i], rows[i + 1]);
      const mergedMapping = merged.map((h) => matchHeader(h));
      const mergedMatched = mergedMapping.filter((m) => m !== null).length;
      if (mergedMatched >= 5 && mergedMapping.includes('entity_code')) {
        return { headerIndex: i + 1, mapping: mergedMapping };
      }
    }
  }

  // Fallback: accept fewer matches (2+) for simple files
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const mapping = rows[i].map((h) => matchHeader(String(h)));
    const matched = mapping.filter((m) => m !== null).length;
    if (matched >= 2 && mapping.includes('entity_code')) {
      return { headerIndex: i, mapping };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  let rows: string[][];

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    // Binary Excel parsing with SheetJS
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Convert to array of arrays, raw values (no formatting), defval keeps empty cells
    const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
    });
    rows = rawRows.map((row) => row.map((cell) => String(cell ?? '').trim()));
  } else if (fileName.endsWith('.csv')) {
    const text = await file.text();
    rows = parseDelimited(text, ',');
  } else if (fileName.endsWith('.tsv')) {
    const text = await file.text();
    rows = parseDelimited(text, '\t');
  } else {
    return NextResponse.json(
      { error: 'Unsupported file format. Use .xlsx, .xls, .csv, or .tsv.' },
      { status: 400 }
    );
  }

  if (rows.length < 2) {
    return NextResponse.json({ error: 'File must have a header row and at least one data row' }, { status: 400 });
  }

  // Smart header detection: scan first 5 rows
  const headerResult = findHeaderRow(rows);
  if (!headerResult) {
    return NextResponse.json(
      { error: 'Could not find a valid header row with entity_code (법인명) column' },
      { status: 400 }
    );
  }

  const { headerIndex, mapping: columnMapping } = headerResult;

  // Track which fields are present
  const presentFields = new Set(columnMapping.filter((f): f is string => f !== null));

  const DOMAIN_FIELDS = ['data_domain_vehicle', 'data_domain_customer', 'data_domain_sales', 'data_domain_quality', 'data_domain_production'];
  const TEXT_FIELDS = ['region', 'country', 'brand', 'entity_name', 'contract_status', 'transfer_purpose', 'transferable_data'];

  const findByEntityCode = db.prepare('SELECT * FROM contracts WHERE entity_code = ?');

  let imported = 0;
  let skipped = 0;
  const dataRows = rows.slice(headerIndex + 1);

  const runImport = db.transaction(() => {
    for (const row of dataRows) {
      const record: Record<string, string> = {};
      for (let i = 0; i < columnMapping.length; i++) {
        const field = columnMapping[i];
        if (field && i < row.length) {
          record[field] = String(row[i] ?? '');
        }
      }

      if (!record.entity_code || !record.entity_code.trim()) {
        skipped++;
        continue;
      }

      const entityCode = record.entity_code.trim();
      const existing = findByEntityCode.get(entityCode) as Record<string, string> | undefined;

      if (existing) {
        const setClauses: string[] = [];
        const values: (string | null)[] = [];

        for (const f of TEXT_FIELDS) {
          if (presentFields.has(f) && record[f] !== undefined) {
            setClauses.push(`${f} = ?`);
            values.push(record[f] || '');
          }
        }
        for (const f of DOMAIN_FIELDS) {
          if (presentFields.has(f) && record[f] !== undefined) {
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
        db.prepare(`
          INSERT INTO contracts (
            region, country, entity_code, brand, entity_name,
            data_domain_vehicle, data_domain_customer, data_domain_sales,
            data_domain_quality, data_domain_production, contract_status,
            transfer_purpose, transferable_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          record.contract_status || null,
          record.transfer_purpose || null,
          record.transferable_data || null
        );
      }
      imported++;
    }
  });

  runImport();

  return NextResponse.json({ imported, skipped, columns: [...presentFields] });
}
