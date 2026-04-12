import { getDb } from '../src/lib/db';

const db = getDb();

const tickets = [
  { title: 'GDPR 검토', description: 'EU/Germany 이전 계약 검토', status: '검토중' },
  { title: '인도 현지화', description: 'Asia/India 대응 항목 정리', status: '진행중' },
  { title: '터키 갱신', description: 'EU/Turkey 갱신 협의', status: '신규' },
  { title: '브라질 LGPD', description: 'SA/Brazil 법무 검토', status: '보류' },
];

const schedules = [
  { title: 'GDPR 킥오프', start_date: '2026-04-14', end_date: '2026-04-21', color: '#002C5F', ticketTitle: 'GDPR 검토' },
  { title: '인도 문서 수집', start_date: '2026-04-17', end_date: '2026-04-28', color: '#00AAD2', ticketTitle: '인도 현지화' },
  { title: '터키 갱신 미팅', start_date: '2026-04-24', end_date: '2026-04-30', color: '#EC8E01', ticketTitle: '터키 갱신' },
  { title: '독립 일정', start_date: '2026-05-02', end_date: '2026-05-07', color: '#0672ED', ticketTitle: null },
];

const contracts = [
  ['EU', 'Germany', 'DE01', '현대', 'EU/Germany'],
  ['Asia', 'India', 'IN01', '현대', 'Asia/India'],
  ['EU', 'Turkey', 'TR01', '현대', 'EU/Turkey'],
  ['SA', 'Brazil', 'BR01', '현대', 'SA/Brazil'],
];

const kanbanCategories = [
  { name: '백로그', color: '#0672ED' },
  { name: '진행중', color: '#00AAD2' },
  { name: '검토', color: '#EC8E01' },
  { name: '완료', color: '#002C5F' },
];

db.prepare('DELETE FROM kanban_cards').run();
db.prepare('DELETE FROM kanban_categories').run();
db.prepare('DELETE FROM schedules').run();
db.prepare('DELETE FROM contract_files').run();
db.prepare('DELETE FROM contracts').run();
db.prepare('DELETE FROM emails').run();
db.prepare('DELETE FROM tickets').run();

const insertTicket = db.prepare(`
  INSERT INTO tickets (title, description, status)
  VALUES (?, ?, ?)
`);
const insertSchedule = db.prepare(`
  INSERT INTO schedules (title, start_date, end_date, ticket_id, color)
  VALUES (?, ?, ?, ?, ?)
`);
const insertContract = db.prepare(`
  INSERT INTO contracts (region, country, entity_code, brand, entity_name)
  VALUES (?, ?, ?, ?, ?)
`);
const insertCategory = db.prepare(`
  INSERT INTO kanban_categories (name, color, position)
  VALUES (?, ?, ?)
`);
const insertCard = db.prepare(`
  INSERT INTO kanban_cards (category_id, title, description, position, ticket_id)
  VALUES (?, ?, ?, ?, ?)
`);

const ticketIds = new Map<string, string>();
for (const ticket of tickets) {
  const result = insertTicket.run(ticket.title, ticket.description, ticket.status);
  const row = db.prepare('SELECT id FROM tickets WHERE rowid = ?').get(result.lastInsertRowid) as { id: string };
  ticketIds.set(ticket.title, row.id);
}

for (const schedule of schedules) {
  insertSchedule.run(
    schedule.title,
    schedule.start_date,
    schedule.end_date,
    schedule.ticketTitle ? ticketIds.get(schedule.ticketTitle) ?? null : null,
    schedule.color
  );
}

for (const contract of contracts) {
  insertContract.run(...contract);
}

const categoryIds: string[] = [];
kanbanCategories.forEach((category, index) => {
  const result = insertCategory.run(category.name, category.color, index);
  const row = db.prepare('SELECT id FROM kanban_categories WHERE rowid = ?').get(result.lastInsertRowid) as { id: string };
  categoryIds.push(row.id);
});

const cardSeed = [
  ['GDPR 검토', '법무 검토 시작', 0],
  ['인도 현지화', '필수 문서 취합', 1],
  ['터키 갱신', '갱신안 검토 대기', 2],
  ['브라질 LGPD', '최종 확인 완료', 3],
] as const;

cardSeed.forEach(([ticketTitle, description, index]) => {
  insertCard.run(
    categoryIds[index],
    ticketTitle,
    description,
    0,
    ticketIds.get(ticketTitle) ?? null
  );
});

console.log('Dummy data seeded.');
