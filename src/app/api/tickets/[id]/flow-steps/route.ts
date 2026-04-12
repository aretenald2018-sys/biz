import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const emailIds = [...new Set(searchParams.getAll('email_id').filter(Boolean))];

  if (emailIds.length === 0) {
    return NextResponse.json({});
  }

  const db = getDb();
  const placeholders = emailIds.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT efs.*
    FROM email_flow_steps efs
    INNER JOIN emails e ON e.id = efs.email_id
    WHERE e.ticket_id = ? AND efs.email_id IN (${placeholders})
    ORDER BY efs.email_id ASC, efs.step_order ASC
  `).all(id, ...emailIds) as Array<Record<string, unknown> & { email_id: string }>;

  const grouped = Object.fromEntries(emailIds.map((emailId) => [emailId, [] as typeof rows]));
  for (const row of rows) {
    grouped[row.email_id].push(row);
  }

  return NextResponse.json(grouped);
}
