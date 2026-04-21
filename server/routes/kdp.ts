import { Hono } from 'hono';
import { getDb } from '@/lib/db';
import type {
  KdpBrand,
  KdpCategory,
  KdpModalInput,
  KdpRefreshResult,
  KdpSectionInput,
} from '@/types/kdp';
import { KDP_BRANDS, KDP_CATEGORIES, KDP_SOURCE_URLS } from '@/types/kdp';
import { diffTexts } from '../lib/terms-diff';
import {
  deleteModal,
  deletePolicy,
  deletePolicyData,
  deleteQaLog,
  deleteSection,
  ensureKdpBootstrap,
  getCurrentPolicy,
  getDiffFull,
  getPolicyById,
  getPolicyPlainText,
  getQaLog,
  insertChunks,
  insertDiff,
  insertModals,
  insertPolicy,
  insertQaLog,
  insertSections,
  listChunks,
  listChunksByIds,
  listDiffs,
  listModals,
  listQaLogs,
  listSections,
  markOtherPoliciesStale,
  setQaStarred,
  updateModal,
  updateSection,
} from '../lib/kdp-db';
import { classifyCategory, slugify, splitIntoChunks } from '../lib/kdp-chunker';
import {
  fetchPolicyHtml,
  isSuspiciouslyEmpty,
  parseHtmlToPolicy,
  type ParsedPolicy,
} from '../lib/kdp-crawler';
import { askQuestion } from '../lib/kdp-qa';

const kdpRoutes = new Hono();

function db() {
  const database = getDb();
  ensureKdpBootstrap(database);
  return database;
}

function isBrand(b: unknown): b is KdpBrand {
  return typeof b === 'string' && (KDP_BRANDS as string[]).includes(b);
}

function normalizeCategory(input: unknown): KdpCategory {
  if (typeof input === 'string' && (KDP_CATEGORIES as string[]).includes(input)) {
    return input as KdpCategory;
  }
  return 'other';
}

kdpRoutes.get('/api/kdp/brands', (c) => {
  return c.json(
    KDP_BRANDS.map((brand) => ({
      brand,
      source_url: KDP_SOURCE_URLS[brand],
    })),
  );
});

kdpRoutes.get('/api/kdp/policies/:brand', (c) => {
  const brand = c.req.param('brand');
  if (!isBrand(brand)) return c.json({ error: 'invalid brand' }, 400);
  const database = db();
  const policy = getCurrentPolicy(database, brand);
  if (!policy) return c.json({ policy: null, sections: [], modals: [], chunks: [] });
  return c.json({
    policy,
    sections: listSections(database, policy.id),
    modals: listModals(database, policy.id),
    chunks: listChunks(database, policy.id),
  });
});

kdpRoutes.post('/api/kdp/policies/:brand/refresh', async (c) => {
  const brand = c.req.param('brand');
  if (!isBrand(brand)) return c.json({ error: 'invalid brand' }, 400);
  const url = KDP_SOURCE_URLS[brand];
  const fetched = await fetchPolicyHtml(url);
  if (!fetched.ok || !fetched.html) {
    const result: KdpRefreshResult = {
      ok: false,
      reason: 'network',
      message: fetched.error ?? `HTTP ${fetched.status ?? '?'}`,
    };
    return c.json(result, 422);
  }
  let parsed: ParsedPolicy;
  try {
    parsed = parseHtmlToPolicy(fetched.html, brand);
  } catch (err) {
    const result: KdpRefreshResult = {
      ok: false,
      reason: 'parse_error',
      message: err instanceof Error ? err.message : String(err),
    };
    return c.json(result, 422);
  }
  if (isSuspiciouslyEmpty(parsed)) {
    const result: KdpRefreshResult = {
      ok: false,
      reason: 'empty_body',
      message:
        '사이트 본문을 자동으로 읽지 못했습니다(SPA 가능성). "수동 업로드"로 HTML 파일을 올려주세요.',
    };
    return c.json(result, 422);
  }
  const database = db();
  const prev = getCurrentPolicy(database, brand);
  const policy = persistParsedPolicy(database, brand, url, 'fetch', parsed, fetched.html);
  if (prev && prev.version_hash !== policy.version_hash) {
    const prevText = getPolicyPlainText(database, prev.id);
    const { diff, summary } = buildDiff(prevText, parsed.plain_text);
    insertDiff(database, brand, prev.id, policy.id, summary, diff);
  }
  return c.json({ ok: true, policy } satisfies KdpRefreshResult);
});

kdpRoutes.post('/api/kdp/policies/:brand/import', async (c) => {
  const brand = c.req.param('brand');
  if (!isBrand(brand)) return c.json({ error: 'invalid brand' }, 400);
  const body = await c.req.json<{ html?: string; url?: string }>().catch(() => ({}));
  const html = typeof body.html === 'string' ? body.html : '';
  if (!html.trim()) return c.json({ error: 'html 필수' }, 400);
  const url = body.url || KDP_SOURCE_URLS[brand];
  let parsed: ParsedPolicy;
  try {
    parsed = parseHtmlToPolicy(html, brand);
  } catch (err) {
    return c.json(
      { ok: false, reason: 'parse_error', message: err instanceof Error ? err.message : String(err) },
      422,
    );
  }
  const database = db();
  const prev = getCurrentPolicy(database, brand);
  const policy = persistParsedPolicy(database, brand, url, 'manual', parsed, html);
  if (prev && prev.version_hash !== policy.version_hash) {
    const prevText = getPolicyPlainText(database, prev.id);
    const { diff, summary } = buildDiff(prevText, parsed.plain_text);
    insertDiff(database, brand, prev.id, policy.id, summary, diff);
  }
  return c.json({ ok: true, policy });
});

kdpRoutes.delete('/api/kdp/policies/:brand', (c) => {
  const brand = c.req.param('brand');
  if (!isBrand(brand)) return c.json({ error: 'invalid brand' }, 400);
  const database = db();
  const policy = getCurrentPolicy(database, brand);
  if (!policy) return c.json({ ok: true });
  deletePolicyData(database, policy.id);
  deletePolicy(database, policy.id);
  return c.json({ ok: true });
});

// ---- Manual CRUD on sections / modals / chunks ----
kdpRoutes.post('/api/kdp/policies/:brand/create-empty', (c) => {
  const brand = c.req.param('brand');
  if (!isBrand(brand)) return c.json({ error: 'invalid brand' }, 400);
  const database = db();
  const existing = getCurrentPolicy(database, brand);
  if (existing) return c.json({ policy: existing });
  const now = new Date().toISOString();
  const id = insertPolicy(database, {
    brand,
    source_url: KDP_SOURCE_URLS[brand],
    source_mode: 'manual',
    title: `${brand === 'hyundai' ? '현대' : '기아'} 개인정보처리방침 (수동)`,
    version_hash: `manual-${now}`,
    plain_text: '',
    raw_html: null,
  });
  markOtherPoliciesStale(database, brand, id);
  const policy = getPolicyById(database, id);
  return c.json({ policy });
});

kdpRoutes.post('/api/kdp/sections', async (c) => {
  const body = await c.req.json<{ policy_id: number; input: KdpSectionInput }>().catch(() => ({} as any));
  const policyId = Number(body.policy_id);
  if (!policyId || !body.input) return c.json({ error: 'policy_id, input 필수' }, 400);
  const database = db();
  const policy = getPolicyById(database, policyId);
  if (!policy) return c.json({ error: 'policy not found' }, 404);
  const input = body.input;
  const category = normalizeCategory(input.category ?? classifyCategory(input.text ?? '', input.heading));
  const orderIdx = typeof input.order_idx === 'number' ? input.order_idx : Date.now() % 100000;
  const ids = insertSections(database, policyId, [
    {
      parent_id: input.parent_id ?? null,
      order_idx: orderIdx,
      heading_level: input.heading_level ?? 2,
      heading: input.heading,
      anchor_slug: input.anchor_slug || slugify(input.heading, `sec-${orderIdx}`),
      path_text: input.heading,
      category,
      text: input.text ?? '',
    },
  ]);
  const sectionId = ids[0];
  rechunkSection(database, policyId, sectionId, input.text ?? '', category, input.heading);
  refreshPolicyPlainTextAndHash(database, policyId);
  return c.json({ id: sectionId });
});

kdpRoutes.put('/api/kdp/sections/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Partial<KdpSectionInput>>().catch(() => ({} as any));
  const database = db();
  const current = database
    .prepare('SELECT * FROM kdp_sections WHERE id = ?')
    .get(id) as { policy_id: number; heading: string; text: string } | undefined;
  if (!current) return c.json({ error: 'section not found' }, 404);
  const next = updateSection(database, id, {
    parent_id: body.parent_id ?? undefined,
    order_idx: typeof body.order_idx === 'number' ? body.order_idx : undefined,
    heading_level: typeof body.heading_level === 'number' ? body.heading_level : undefined,
    heading: body.heading,
    anchor_slug: body.anchor_slug ?? undefined,
    path_text: body.heading ?? undefined,
    category: body.category ? normalizeCategory(body.category) : undefined,
    text: body.text,
  });
  if (next) {
    rechunkSection(database, current.policy_id, id, next.text, next.category, next.heading);
    refreshPolicyPlainTextAndHash(database, current.policy_id);
  }
  return c.json({ ok: true });
});

kdpRoutes.delete('/api/kdp/sections/:id', (c) => {
  const id = Number(c.req.param('id'));
  const database = db();
  const current = database
    .prepare('SELECT policy_id FROM kdp_sections WHERE id = ?')
    .get(id) as { policy_id: number } | undefined;
  if (!current) return c.json({ ok: true });
  deleteSection(database, id);
  refreshPolicyPlainTextAndHash(database, current.policy_id);
  return c.json({ ok: true });
});

kdpRoutes.post('/api/kdp/modals', async (c) => {
  const body = await c.req.json<{ policy_id: number; input: KdpModalInput }>().catch(() => ({} as any));
  const policyId = Number(body.policy_id);
  if (!policyId || !body.input) return c.json({ error: 'policy_id, input 필수' }, 400);
  const database = db();
  const policy = getPolicyById(database, policyId);
  if (!policy) return c.json({ error: 'policy not found' }, 404);
  const input = body.input;
  const category = normalizeCategory(input.category ?? classifyCategory(input.text ?? '', input.label));
  const ids = insertModals(database, policyId, [
    {
      link_key: input.link_key,
      label: input.label,
      title: input.title ?? null,
      html: input.html ?? '',
      text: input.text ?? '',
      anchored_section_id: input.anchored_section_id ?? null,
      category,
    },
  ]);
  const modalId = ids[0];
  rechunkModal(database, policyId, modalId, input.text ?? '', category, input.label, input.title ?? null);
  refreshPolicyPlainTextAndHash(database, policyId);
  return c.json({ id: modalId });
});

kdpRoutes.put('/api/kdp/modals/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Partial<KdpModalInput>>().catch(() => ({} as any));
  const database = db();
  const current = database
    .prepare('SELECT * FROM kdp_modals WHERE id = ?')
    .get(id) as { policy_id: number; label: string; title: string | null } | undefined;
  if (!current) return c.json({ error: 'modal not found' }, 404);
  const next = updateModal(database, id, {
    link_key: body.link_key,
    label: body.label,
    title: body.title ?? undefined,
    html: body.html,
    text: body.text,
    anchored_section_id: body.anchored_section_id ?? undefined,
    category: body.category ? normalizeCategory(body.category) : undefined,
  });
  if (next) {
    rechunkModal(
      database,
      current.policy_id,
      id,
      next.text,
      next.category,
      next.label,
      next.title,
    );
    refreshPolicyPlainTextAndHash(database, current.policy_id);
  }
  return c.json({ ok: true });
});

kdpRoutes.delete('/api/kdp/modals/:id', (c) => {
  const id = Number(c.req.param('id'));
  const database = db();
  const current = database
    .prepare('SELECT policy_id FROM kdp_modals WHERE id = ?')
    .get(id) as { policy_id: number } | undefined;
  if (!current) return c.json({ ok: true });
  deleteModal(database, id);
  refreshPolicyPlainTextAndHash(database, current.policy_id);
  return c.json({ ok: true });
});

kdpRoutes.get('/api/kdp/chunks', (c) => {
  const ids = (c.req.query('ids') ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return c.json([]);
  const database = db();
  return c.json(listChunksByIds(database, ids));
});

// ---- Q&A ----
kdpRoutes.post('/api/kdp/ask', async (c) => {
  const body = await c.req.json<{ brand?: string; question?: string; category?: string | null }>().catch(
    () => ({}),
  );
  const brand = body.brand;
  if (!isBrand(brand)) return c.json({ error: 'invalid brand' }, 400);
  const question = (body.question ?? '').trim();
  if (!question) return c.json({ error: '질문이 비어있습니다.' }, 400);
  const category: KdpCategory | null =
    body.category && (KDP_CATEGORIES as string[]).includes(body.category)
      ? (body.category as KdpCategory)
      : null;

  const database = db();
  const result = await askQuestion(database, brand, question, category);
  if (!result.ok) {
    return c.json({ error: result.error ?? '답변 생성 실패' }, 422);
  }
  const logId = insertQaLog(database, {
    policy_id: result.policy_id,
    brand,
    question,
    answer: result.answer,
    citations: result.citations,
    model: result.model,
    category,
  });
  return c.json({
    answer: result.answer,
    citations: result.citations,
    model: result.model,
    log_id: logId,
  });
});

kdpRoutes.get('/api/kdp/qa-logs/:brand', (c) => {
  const brand = c.req.param('brand');
  if (!isBrand(brand)) return c.json({ error: 'invalid brand' }, 400);
  const database = db();
  return c.json(listQaLogs(database, brand));
});

kdpRoutes.get('/api/kdp/qa-logs/item/:id', (c) => {
  const id = Number(c.req.param('id'));
  const log = getQaLog(db(), id);
  if (!log) return c.json({ error: 'not found' }, 404);
  return c.json(log);
});

kdpRoutes.patch('/api/kdp/qa-logs/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ starred?: boolean }>().catch(() => ({}));
  if (typeof body.starred !== 'boolean') return c.json({ error: 'starred 필수' }, 400);
  setQaStarred(db(), id, body.starred);
  return c.json({ ok: true });
});

kdpRoutes.delete('/api/kdp/qa-logs/:id', (c) => {
  const id = Number(c.req.param('id'));
  deleteQaLog(db(), id);
  return c.json({ ok: true });
});

// ---- Diffs ----
kdpRoutes.get('/api/kdp/diffs/:brand', (c) => {
  const brand = c.req.param('brand');
  if (!isBrand(brand)) return c.json({ error: 'invalid brand' }, 400);
  return c.json(listDiffs(db(), brand));
});

kdpRoutes.get('/api/kdp/diffs/item/:id', (c) => {
  const id = Number(c.req.param('id'));
  const full = getDiffFull(db(), id);
  if (full === null) return c.json({ error: 'not found' }, 404);
  return c.json({ id, full_diff: full });
});

export default kdpRoutes;

// ---------- helpers ----------

function persistParsedPolicy(
  database: ReturnType<typeof getDb>,
  brand: KdpBrand,
  url: string,
  mode: 'fetch' | 'manual',
  parsed: ParsedPolicy,
  rawHtml: string,
) {
  ensureKdpBootstrap(database);
  const id = insertPolicy(database, {
    brand,
    source_url: url,
    source_mode: mode,
    title: parsed.title ?? null,
    version_hash: parsed.version_hash,
    plain_text: parsed.plain_text,
    raw_html: Buffer.from(rawHtml, 'utf8'),
  });
  markOtherPoliciesStale(database, brand, id);
  const sectionIds = insertSections(
    database,
    id,
    parsed.sections.map((s) => ({
      parent_id: s.parent_idx !== null ? null : null,
      order_idx: s.order_idx,
      heading_level: s.heading_level,
      heading: s.heading,
      anchor_slug: s.anchor_slug,
      path_text: s.path_text,
      category: s.category,
      text: s.text,
    })),
  );
  // fix parent_ids using index mapping
  parsed.sections.forEach((s, idx) => {
    if (s.parent_idx !== null && sectionIds[s.parent_idx] !== undefined) {
      database.prepare('UPDATE kdp_sections SET parent_id = ? WHERE id = ?').run(sectionIds[s.parent_idx], sectionIds[idx]);
    }
  });
  const modalIds = insertModals(
    database,
    id,
    parsed.modals.map((m) => ({
      link_key: m.link_key,
      label: m.label,
      title: m.title,
      html: m.html,
      text: m.text,
      anchored_section_id: m.anchored_section_idx !== null ? sectionIds[m.anchored_section_idx] ?? null : null,
      category: m.category,
    })),
  );
  insertChunks(
    database,
    id,
    parsed.chunks.map((c) => ({
      section_id: c.section_idx !== null ? sectionIds[c.section_idx] ?? null : null,
      modal_id: c.modal_idx !== null ? modalIds[c.modal_idx] ?? null : null,
      ord: c.ord,
      text: c.text,
      category: c.category,
      heading_path: c.heading_path,
    })),
  );
  return getPolicyById(database, id)!;
}

function buildDiff(prev: string, next: string): { diff: string; summary: { added: number; removed: number; changed: number } } {
  const ops = diffTexts(prev, next);
  let added = 0;
  let removed = 0;
  const pieces: string[] = [];
  for (const op of ops) {
    if (op.kind === 'insert') {
      added += op.text.length;
      pieces.push(`+ ${op.text}`);
    } else if (op.kind === 'delete') {
      removed += op.text.length;
      pieces.push(`- ${op.text}`);
    }
  }
  const changed = Math.min(added, removed);
  return { diff: pieces.join('\n'), summary: { added, removed, changed } };
}

function rechunkSection(
  database: ReturnType<typeof getDb>,
  policyId: number,
  sectionId: number,
  text: string,
  category: KdpCategory,
  heading: string,
) {
  database.prepare('DELETE FROM kdp_chunks WHERE section_id = ?').run(sectionId);
  const parts = splitIntoChunks(text, 600);
  const rows = parts.map((t, i) => ({
    section_id: sectionId,
    modal_id: null,
    ord: Date.now() * 10 + i,
    text: t,
    category,
    heading_path: heading,
  }));
  if (rows.length) insertChunks(database, policyId, rows);
}

function rechunkModal(
  database: ReturnType<typeof getDb>,
  policyId: number,
  modalId: number,
  text: string,
  category: KdpCategory,
  label: string,
  title: string | null,
) {
  database.prepare('DELETE FROM kdp_chunks WHERE modal_id = ?').run(modalId);
  const parts = splitIntoChunks(text, 600);
  const rows = parts.map((t, i) => ({
    section_id: null,
    modal_id: modalId,
    ord: Date.now() * 10 + i,
    text: t,
    category,
    heading_path: `[모달] ${label}${title ? ' > ' + title : ''}`,
  }));
  if (rows.length) insertChunks(database, policyId, rows);
}

function refreshPolicyPlainTextAndHash(database: ReturnType<typeof getDb>, policyId: number) {
  const sections = listSections(database, policyId);
  const modals = listModals(database, policyId);
  const pieces: string[] = [];
  for (const s of sections) {
    pieces.push(`## ${s.heading}`);
    if (s.text) pieces.push(s.text);
  }
  for (const m of modals) {
    pieces.push(`[모달:${m.label}${m.title ? ' / ' + m.title : ''}] ${m.text}`);
  }
  const plain = pieces.join('\n\n');
  const crypto = require('node:crypto') as typeof import('node:crypto');
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  database
    .prepare('UPDATE kdp_policies SET plain_text = ?, version_hash = ? WHERE id = ?')
    .run(plain, hash, policyId);
}
