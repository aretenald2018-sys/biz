import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const contractIds = [...new Set(searchParams.getAll('id').filter(Boolean))];

  if (contractIds.length === 0) {
    return NextResponse.json({});
  }

  const placeholders = contractIds.map(() => '?').join(', ');
  const versions = db.prepare(
    `SELECT * FROM contract_versions WHERE contract_id IN (${placeholders}) ORDER BY contract_id, version_number DESC`
  ).all(...contractIds) as Array<{ id: string; contract_id: string }>;

  const versionIds = versions.map((version) => version.id);
  let filesByVersionId = new Map<string, unknown[]>();

  if (versionIds.length > 0) {
    const filePlaceholders = versionIds.map(() => '?').join(', ');
    const files = db.prepare(
      `SELECT * FROM contract_files WHERE version_id IN (${filePlaceholders}) ORDER BY created_at DESC`
    ).all(...versionIds) as Array<{ version_id: string | null }>;

    filesByVersionId = files.reduce((map, file) => {
      if (!file.version_id) return map;
      const list = map.get(file.version_id) || [];
      list.push(file);
      map.set(file.version_id, list);
      return map;
    }, new Map<string, unknown[]>());
  }

  const grouped = contractIds.reduce<Record<string, unknown[]>>((acc, contractId) => {
    acc[contractId] = [];
    return acc;
  }, {});

  versions.forEach((version) => {
    grouped[version.contract_id].push({
      ...version,
      files: filesByVersionId.get(version.id) || [],
    });
  });

  return NextResponse.json(grouped);
}
