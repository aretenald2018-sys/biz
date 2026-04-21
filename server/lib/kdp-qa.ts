import Anthropic from '@anthropic-ai/sdk';
import type Database from 'better-sqlite3';
import type { KdpBrand, KdpCategory, KdpCitation, KdpChunk } from '@/types/kdp';
import { KDP_CATEGORY_LABELS } from '@/types/kdp';
import { extractKeywords } from './kdp-chunker';
import { getCurrentPolicy, listChunks, searchChunks } from './kdp-db';

const MODEL = 'claude-sonnet-4-6';
const MAX_CONTEXT_CHUNKS = 12;

export interface AskResult {
  ok: boolean;
  error?: string;
  answer: string;
  citations: KdpCitation[];
  model: string;
  policy_id: number;
  chosen_chunks: KdpChunk[];
}

export async function askQuestion(
  db: Database.Database,
  brand: KdpBrand,
  question: string,
  category: KdpCategory | null,
): Promise<AskResult> {
  const policy = getCurrentPolicy(db, brand);
  if (!policy) {
    return {
      ok: false,
      error: '해당 브랜드의 정책이 아직 수집되지 않았습니다.',
      answer: '',
      citations: [],
      model: MODEL,
      policy_id: 0,
      chosen_chunks: [],
    };
  }

  const keywords = extractKeywords(question);
  let candidates = searchChunks(db, policy.id, keywords, category, 40);
  if (candidates.length === 0) {
    // fallback: category-only, then all
    if (category) {
      candidates = searchChunks(db, policy.id, [], category, 40);
    }
    if (candidates.length === 0) {
      candidates = listChunks(db, policy.id).slice(0, 40);
    }
  }

  const scored = rankChunks(candidates, keywords, category);
  const top = scored.slice(0, MAX_CONTEXT_CHUNKS);

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    const fallback = top.slice(0, 3);
    return {
      ok: true,
      answer:
        `[AI 비활성: CLAUDE_API_KEY 미설정] 아래 조항이 질문과 관련 있어 보입니다. ` +
        fallback.map((c) => `[#${c.id}]`).join(' '),
      citations: fallback.map((c) => ({
        chunk_id: c.id,
        excerpt: c.text.slice(0, 180),
        confidence: 0.3,
      })),
      model: 'heuristic-fallback',
      policy_id: policy.id,
      chosen_chunks: fallback,
    };
  }

  const systemPrompt = buildSystemPrompt(brand, category);
  const userPrompt = buildUserPrompt(question, top);

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '';
    const parsed = parseClaudeJson(raw, top);
    return {
      ok: true,
      answer: parsed.answer,
      citations: parsed.citations,
      model: MODEL,
      policy_id: policy.id,
      chosen_chunks: top,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: message,
      answer: '',
      citations: [],
      model: MODEL,
      policy_id: policy.id,
      chosen_chunks: top,
    };
  }
}

function rankChunks(chunks: KdpChunk[], keywords: string[], category: KdpCategory | null): KdpChunk[] {
  return [...chunks]
    .map((c) => {
      let score = 0;
      const lower = c.text.toLowerCase();
      keywords.forEach((kw) => {
        if (!kw) return;
        const hits = lower.split(kw.toLowerCase()).length - 1;
        score += hits * 2;
      });
      if (category && c.category === category) score += 5;
      if (c.heading_path) {
        const headLower = c.heading_path.toLowerCase();
        keywords.forEach((kw) => {
          if (headLower.includes(kw.toLowerCase())) score += 3;
        });
      }
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

function buildSystemPrompt(brand: KdpBrand, category: KdpCategory | null): string {
  const brandName = brand === 'hyundai' ? '현대자동차' : '기아';
  const catStr = category ? `\n- 카테고리 필터: ${KDP_CATEGORY_LABELS[category]}` : '';
  return `당신은 ${brandName} 개인정보처리방침 전문가입니다.
아래에 제공되는 조항(chunk)만 근거로 한국어로 답변하세요. 다른 지식이나 추측은 사용하지 마세요.
답변 규칙:
- 조항에 명시되지 않은 내용은 "해당 방침에 명시되지 않음"이라고 답하세요.
- 모든 핵심 문장 끝에 [#chunk_id] 형식으로 근거를 표기하세요(예: [#12]).
- 답변은 3~6문장 이내로 간결히.
- 최종 응답은 반드시 아래 JSON 포맷만 반환하세요(다른 텍스트 금지):
{
  "answer": "…사용자에게 보여줄 한국어 답변(각 문장 끝 [#id] 포함)…",
  "citations": [
    {"chunk_id": 12, "excerpt": "해당 조항에서 인용한 20~80자", "confidence": 0.9}
  ]
}${catStr}`;
}

function buildUserPrompt(question: string, chunks: KdpChunk[]): string {
  const ctx = chunks
    .map(
      (c) => `[#${c.id}] (${c.heading_path ?? '본문'})\n${c.text}`,
    )
    .join('\n\n---\n\n');
  return `질문: ${question}\n\n--- 근거 조항 ---\n\n${ctx}\n\n위 조항만 근거로 답하세요. JSON으로만 응답.`;
}

function parseClaudeJson(
  raw: string,
  chunks: KdpChunk[],
): { answer: string; citations: KdpCitation[] } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const validIds = new Set(chunks.map((c) => c.id));
  if (!jsonMatch) {
    return {
      answer: raw.trim() || '답변을 생성하지 못했습니다.',
      citations: chunks.slice(0, 3).map((c) => ({ chunk_id: c.id, excerpt: c.text.slice(0, 160) })),
    };
  }
  try {
    const obj = JSON.parse(jsonMatch[0]);
    const answer = typeof obj.answer === 'string' ? obj.answer : '';
    const cits = Array.isArray(obj.citations) ? obj.citations : [];
    const citations: KdpCitation[] = [];
    for (const cit of cits) {
      const id = Number(cit?.chunk_id);
      if (!Number.isFinite(id) || !validIds.has(id)) continue;
      citations.push({
        chunk_id: id,
        excerpt: typeof cit.excerpt === 'string' ? cit.excerpt.slice(0, 240) : '',
        confidence:
          typeof cit.confidence === 'number' && Number.isFinite(cit.confidence) ? cit.confidence : null,
      });
    }
    // Also extract [#id] mentions from the answer and dedupe into citations
    const mentioned = Array.from(answer.matchAll(/\[#(\d+)\]/g)).map((m) => Number(m[1]));
    for (const id of mentioned) {
      if (!validIds.has(id)) continue;
      if (citations.some((c) => c.chunk_id === id)) continue;
      const chunk = chunks.find((c) => c.id === id);
      citations.push({
        chunk_id: id,
        excerpt: chunk ? chunk.text.slice(0, 160) : '',
        confidence: null,
      });
    }
    return { answer: answer || raw.trim(), citations };
  } catch {
    return {
      answer: raw.trim(),
      citations: chunks.slice(0, 3).map((c) => ({ chunk_id: c.id, excerpt: c.text.slice(0, 160) })),
    };
  }
}
