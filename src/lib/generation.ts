import Database from 'better-sqlite3';
import type { GenerationBestPractice, GenerationTemplate, GenerationType } from '@/types/generation';

function assertType(type: string): GenerationType {
  if (type === 'weekly_report' || type === 'dooray') return type;
  throw new Error('Invalid generation type');
}

export function listTemplates(db: Database.Database, type: string): GenerationTemplate[] {
  const validatedType = assertType(type);
  return db.prepare(`
    SELECT id, type, name, content, is_default, created_at, updated_at
    FROM generation_templates
    WHERE type = ?
    ORDER BY is_default DESC, updated_at DESC, created_at DESC
  `).all(validatedType) as GenerationTemplate[];
}

export function createTemplate(
  db: Database.Database,
  input: { type: string; name: string; content?: string; is_default?: number },
): GenerationTemplate {
  const type = assertType(input.type);
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Template name is required');
  const content = typeof input.content === 'string' ? input.content : '';
  const isDefault = input.is_default === 1 ? 1 : 0;

  const tx = db.transaction(() => {
    if (isDefault) {
      db.prepare(`UPDATE generation_templates SET is_default = 0, updated_at = datetime('now','localtime') WHERE type = ?`).run(type);
    }
    const result = db.prepare(`
      INSERT INTO generation_templates (type, name, content, is_default)
      VALUES (?, ?, ?, ?)
    `).run(type, name, content, isDefault);

    return db.prepare(`
      SELECT id, type, name, content, is_default, created_at, updated_at
      FROM generation_templates
      WHERE rowid = ?
    `).get(result.lastInsertRowid) as GenerationTemplate;
  });

  return tx();
}

export function updateTemplate(
  db: Database.Database,
  id: string,
  input: { name?: string; content?: string; is_default?: number },
): GenerationTemplate {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof input.name === 'string') {
    const name = input.name.trim();
    if (!name) throw new Error('Template name is required');
    fields.push('name = ?');
    values.push(name);
  }
  if (typeof input.content === 'string') {
    fields.push('content = ?');
    values.push(input.content);
  }

  const row = db.prepare('SELECT id, type FROM generation_templates WHERE id = ?').get(id) as { id: string; type: GenerationType } | undefined;
  if (!row) throw new Error('Template not found');

  const tx = db.transaction(() => {
    if (input.is_default === 1) {
      db.prepare(`UPDATE generation_templates SET is_default = 0, updated_at = datetime('now','localtime') WHERE type = ?`).run(row.type);
      fields.push('is_default = 1');
    } else if (input.is_default === 0) {
      fields.push('is_default = 0');
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push("updated_at = datetime('now','localtime')");
    values.push(id);

    db.prepare(`UPDATE generation_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return db.prepare(`
      SELECT id, type, name, content, is_default, created_at, updated_at
      FROM generation_templates
      WHERE id = ?
    `).get(id) as GenerationTemplate;
  });

  return tx();
}

export function deleteTemplate(db: Database.Database, id: string) {
  const row = db.prepare('SELECT id, is_default FROM generation_templates WHERE id = ?').get(id) as { id: string; is_default: number } | undefined;
  if (!row) throw new Error('Template not found');
  if (row.is_default) throw new Error('기본 템플릿은 삭제할 수 없습니다.');
  db.prepare('DELETE FROM generation_templates WHERE id = ?').run(id);
}

export function listBestPractices(db: Database.Database, type: string): GenerationBestPractice[] {
  const validatedType = assertType(type);
  return db.prepare(`
    SELECT id, type, title, content, created_at
    FROM generation_best_practices
    WHERE type = ?
    ORDER BY created_at DESC
  `).all(validatedType) as GenerationBestPractice[];
}

export function createBestPractice(
  db: Database.Database,
  input: { type: string; title: string; content?: string },
): GenerationBestPractice {
  const type = assertType(input.type);
  const title = String(input.title || '').trim();
  if (!title) throw new Error('Best practice title is required');
  const content = typeof input.content === 'string' ? input.content : '';
  const result = db.prepare(`
    INSERT INTO generation_best_practices (type, title, content)
    VALUES (?, ?, ?)
  `).run(type, title, content);
  return db.prepare(`
    SELECT id, type, title, content, created_at
    FROM generation_best_practices
    WHERE rowid = ?
  `).get(result.lastInsertRowid) as GenerationBestPractice;
}

export function updateBestPractice(
  db: Database.Database,
  id: string,
  input: { title?: string; content?: string },
): GenerationBestPractice {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (typeof input.title === 'string') {
    const title = input.title.trim();
    if (!title) throw new Error('Best practice title is required');
    fields.push('title = ?');
    values.push(title);
  }
  if (typeof input.content === 'string') {
    fields.push('content = ?');
    values.push(input.content);
  }
  if (fields.length === 0) throw new Error('No fields to update');

  values.push(id);
  const result = db.prepare(`UPDATE generation_best_practices SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  if (result.changes === 0) throw new Error('Best practice not found');

  return db.prepare(`
    SELECT id, type, title, content, created_at
    FROM generation_best_practices
    WHERE id = ?
  `).get(id) as GenerationBestPractice;
}

export function deleteBestPractice(db: Database.Database, id: string) {
  const result = db.prepare('DELETE FROM generation_best_practices WHERE id = ?').run(id);
  if (result.changes === 0) throw new Error('Best practice not found');
}

