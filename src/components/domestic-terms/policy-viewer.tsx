'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { KDP_CATEGORY_LABELS, type KdpChunk, type KdpModal, type KdpSection } from '@/types/kdp';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'span', 'div', 'section', 'article',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'hr', 'small', 'sup', 'sub',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'colspan', 'rowspan', 'class', 'style',
    'width', 'height', 'align', 'valign', 'scope', 'title',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'meta', 'link', 'form', 'input', 'button'],
};

function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

function hasRichStructure(html: string): boolean {
  if (!html) return false;
  // 표, 리스트, 정의목록, 소제목 등 '서식이 있는 마크업'이면 리치 렌더링으로 간주
  return /<(table|thead|tbody|tfoot|tr|th|td|ul|ol|li|dl|dt|dd|h[1-6])\b/i.test(html);
}

function normalizeLookup(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeReferenceLine(value: string): string {
  return normalizeLookup(value.replace(/^[\s\-•·▶▷>]+/u, '').trim());
}

function extractModalHash(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const hashIndex = trimmed.lastIndexOf('#');
  if (hashIndex < 0 || hashIndex === trimmed.length - 1) return '';
  return trimmed.slice(hashIndex + 1).trim();
}

function isWeakAnchorSection(section: KdpSection | undefined): boolean {
  if (!section) return true;
  const heading = normalizeLookup(section.heading);
  return heading === normalizeLookup('목차') || heading.includes(normalizeLookup('알기 쉬운 개인정보처리방침'));
}

function getModalLookupKeys(modal: KdpModal): string[] {
  const keys = new Set<string>();
  [modal.label, modal.title ?? '', extractModalHash(modal.link_key)].forEach((value) => {
    const normalized = normalizeReferenceLine(value);
    if (normalized) keys.add(normalized);
  });
  return [...keys];
}

interface Props {
  sections: KdpSection[];
  modals: KdpModal[];
  chunks: KdpChunk[];
  focusChunkId: number | null;
  highlightTick: number;
  loading: boolean;
}

export function PolicyViewer({ sections, modals, chunks, focusChunkId, highlightTick, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [expandedModalIds, setExpandedModalIds] = useState<Set<number>>(() => new Set());

  const chunksBySection = useMemo(() => {
    const map = new Map<number, KdpChunk[]>();
    chunks.forEach((c) => {
      if (c.section_id != null) {
        const arr = map.get(c.section_id) ?? [];
        arr.push(c);
        map.set(c.section_id, arr);
      }
    });
    map.forEach((arr) => arr.sort((a, b) => a.ord - b.ord));
    return map;
  }, [chunks]);

  const chunksByModal = useMemo(() => {
    const map = new Map<number, KdpChunk[]>();
    chunks.forEach((c) => {
      if (c.modal_id != null) {
        const arr = map.get(c.modal_id) ?? [];
        arr.push(c);
        map.set(c.modal_id, arr);
      }
    });
    map.forEach((arr) => arr.sort((a, b) => a.ord - b.ord));
    return map;
  }, [chunks]);

  const sectionsById = useMemo(() => {
    const map = new Map<number, KdpSection>();
    sections.forEach((section) => map.set(section.id, section));
    return map;
  }, [sections]);

  const sectionSearchText = useMemo(() => {
    const map = new Map<number, string>();
    sections.forEach((section) => {
      const joinedChunks = (chunksBySection.get(section.id) ?? []).map((chunk) => chunk.text).join('\n');
      map.set(section.id, normalizeLookup([section.heading, section.text, joinedChunks].filter(Boolean).join('\n')));
    });
    return map;
  }, [chunksBySection, sections]);

  const modalDisplaySectionId = useMemo(() => {
    const map = new Map<number, number | null>();
    modals.forEach((modal) => {
      const anchored = modal.anchored_section_id != null ? sectionsById.get(modal.anchored_section_id) : undefined;
      if (anchored && !isWeakAnchorSection(anchored)) {
        map.set(modal.id, anchored.id);
        return;
      }

      const keys = getModalLookupKeys(modal).filter((key) => key.length >= 6);
      let matchedSectionId: number | null = null;
      if (keys.length > 0) {
        for (const section of sections) {
          if (isWeakAnchorSection(section)) continue;
          const haystack = sectionSearchText.get(section.id) ?? '';
          if (keys.some((key) => haystack.includes(key))) {
            matchedSectionId = section.id;
            break;
          }
        }
      }

      map.set(modal.id, matchedSectionId ?? modal.anchored_section_id ?? null);
    });
    return map;
  }, [modals, sectionSearchText, sections, sectionsById]);

  const modalLinkMapBySection = useMemo(() => {
    const map = new Map<number, Map<string, KdpModal>>();
    const collisions = new Map<number, Set<string>>();

    const markCollision = (sectionId: number, key: string) => {
      const sectionCollisions = collisions.get(sectionId) ?? new Set<string>();
      sectionCollisions.add(key);
      collisions.set(sectionId, sectionCollisions);
    };

    modals.forEach((modal) => {
      const sectionId = modalDisplaySectionId.get(modal.id);
      if (sectionId == null) return;
      const sectionMap = map.get(sectionId) ?? new Map<string, KdpModal>();
      getModalLookupKeys(modal).forEach((key) => {
        const existing = sectionMap.get(key);
        if (existing && existing.id !== modal.id) {
          markCollision(sectionId, key);
          return;
        }
        sectionMap.set(key, modal);
      });
      map.set(sectionId, sectionMap);
    });

    collisions.forEach((keys, sectionId) => {
      const sectionMap = map.get(sectionId);
      if (!sectionMap) return;
      keys.forEach((key) => sectionMap.delete(key));
    });

    return map;
  }, [modalDisplaySectionId, modals]);

  const modalIdByHash = useMemo(() => {
    const map = new Map<string, number>();
    modals.forEach((modal) => {
      const hash = normalizeReferenceLine(extractModalHash(modal.link_key));
      if (!hash) return;
      map.set(hash, modal.id);
    });
    return map;
  }, [modals]);

  const modalsBySection = useMemo(() => {
    const map = new Map<number, KdpModal[]>();
    modals.forEach((m) => {
      const key = modalDisplaySectionId.get(m.id) ?? -1;
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => a.id - b.id));
    return map;
  }, [modalDisplaySectionId, modals]);

  const expandModal = (modalId: number) => {
    setExpandedModalIds((prev) => {
      if (prev.has(modalId)) return prev;
      const next = new Set(prev);
      next.add(modalId);
      return next;
    });
  };

  const toggleModal = (modalId: number) => {
    setExpandedModalIds((prev) => {
      const next = new Set(prev);
      if (next.has(modalId)) next.delete(modalId);
      else next.add(modalId);
      return next;
    });
  };

  const openModal = (modalId: number) => {
    expandModal(modalId);
    window.setTimeout(() => {
      const card = containerRef.current?.querySelector(`[data-modal-id="${modalId}"]`) as HTMLElement | null;
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  useEffect(() => {
    if (focusChunkId == null) return;
    // 인용이 모달 내부를 가리키면 먼저 펼친다 (접힌 상태에선 앵커가 DOM에 없음)
    const chunk = chunks.find((c) => c.id === focusChunkId);
    if (chunk?.modal_id != null) {
      expandModal(chunk.modal_id);
    }
    const t = window.setTimeout(() => {
      const el = containerRef.current?.querySelector(
        `[data-chunk-id="${focusChunkId}"]`,
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setHighlightedId(focusChunkId);
      window.setTimeout(() => setHighlightedId(null), 1400);
    }, 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusChunkId, highlightTick]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const anchor = target.closest('a[href], a[data-target], a[aria-controls]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute('href') ?? '';
      const targetId = normalizeReferenceLine(
        extractModalHash(anchor.getAttribute('data-target') ?? anchor.getAttribute('aria-controls') ?? href),
      );
      if (!targetId) return;
      const modalId = modalIdByHash.get(targetId);
      if (!modalId) return;

      event.preventDefault();
      event.stopPropagation();
      openModal(modalId);
    };

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [modalIdByHash]);

  if (loading) {
    return <div style={{ color: '#929296' }}>불러오는 중…</div>;
  }

  if (sections.length === 0 && modals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-sm" style={{ color: '#929296' }}>
        <div>수집된 본문이 없습니다.</div>
        <div>상단의 [새로고침] 또는 [업로드] 또는 [수동 편집]으로 시작하세요.</div>
      </div>
    );
  }

  const orphanModals = modalsBySection.get(-1) ?? [];

  return (
    <div ref={containerRef} className="max-h-[72vh] overflow-y-auto pr-2">
      {sections.map((s) => {
        const sectionChunks = chunksBySection.get(s.id) ?? [];
        const sectionModals = modalsBySection.get(s.id) ?? [];
        const sectionModalLinks = modalLinkMapBySection.get(s.id);
        return (
          <div key={s.id} className="mb-6 scroll-mt-16" data-section-id={s.id} id={`kdp-section-${s.id}`}>
            <Heading level={s.heading_level} category={s.category}>
              {s.heading}
            </Heading>
            {sectionChunks.length === 0 && s.text && (
              <Paragraph
                data-chunk-id={`section-${s.id}`}
                highlighted={false}
                modalLinks={sectionModalLinks}
                onOpenModal={openModal}
              >
                {s.text}
              </Paragraph>
            )}
            {sectionChunks.map((c) => (
              <Paragraph
                key={c.id}
                data-chunk-id={c.id}
                highlighted={highlightedId === c.id}
                modalLinks={sectionModalLinks}
                onOpenModal={openModal}
              >
                {c.text}
              </Paragraph>
            ))}
            {sectionModals.map((m) => (
              <ModalBlock
                key={m.id}
                modal={m}
                chunks={chunksByModal.get(m.id) ?? []}
                highlightedId={highlightedId}
                expanded={expandedModalIds.has(m.id)}
                onToggle={() => toggleModal(m.id)}
              />
            ))}
          </div>
        );
      })}
      {orphanModals.length > 0 && (
        <div className="mt-8 border-t pt-4" style={{ borderColor: '#EFEFF0' }}>
          <div className="mb-2 text-xs" style={{ color: '#929296' }}>기타 모달</div>
          {orphanModals.map((m) => (
            <ModalBlock
              key={m.id}
              modal={m}
              chunks={chunksByModal.get(m.id) ?? []}
              highlightedId={highlightedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Heading({
  level,
  category,
  children,
}: {
  level: number;
  category: string;
  children: React.ReactNode;
}) {
  const fontSize = level <= 1 ? 22 : level === 2 ? 18 : level === 3 ? 15 : 13;
  return (
    <div className="mb-2 mt-3 flex items-center gap-2">
      <h3
        style={{
          fontFamily: 'HyundaiSansHeadKR, HyundaiSansTextKR, sans-serif',
          fontSize,
          fontWeight: 500,
          color: '#002C5F',
          margin: 0,
        }}
      >
        {children}
      </h3>
      <span
        className="rounded-full border px-2 py-0.5 text-[10px]"
        style={{
          borderColor: '#EFEFF0',
          color: '#929296',
          fontFamily: 'HyundaiSansTextKR, sans-serif',
        }}
      >
        {KDP_CATEGORY_LABELS[category as keyof typeof KDP_CATEGORY_LABELS] ?? category}
      </span>
    </div>
  );
}

function Paragraph({
  children,
  highlighted,
  'data-chunk-id': chunkId,
  modalLinks,
  onOpenModal,
}: {
  children: React.ReactNode;
  highlighted: boolean;
  'data-chunk-id': number | string;
  modalLinks?: Map<string, KdpModal>;
  onOpenModal?: (modalId: number) => void;
}) {
  const text = typeof children === 'string' ? children : null;
  const renderedChildren = text && modalLinks && onOpenModal
    ? text.split('\n').map((line, index) => {
        const modal = modalLinks.get(normalizeReferenceLine(line));
        const key = `${chunkId}-${index}`;
        return (
          <Fragment key={key}>
            <span style={{ display: 'block' }}>
              {modal ? (
                <button
                  type="button"
                  onClick={() => onOpenModal(modal.id)}
                  className="cursor-pointer text-left underline"
                  style={{
                    color: '#0672ED',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                  }}
                >
                  {line.trim()}
                </button>
              ) : line ? (
                line
              ) : (
                '\u00A0'
              )}
            </span>
          </Fragment>
        );
      })
    : children;

  return (
    <p
      data-chunk-id={chunkId}
      className="my-1.5 scroll-mt-24 rounded-md px-2 py-1 transition-all"
      style={{
        fontFamily: 'HyundaiSansTextKR, sans-serif',
        fontSize: 13.5,
        lineHeight: 1.75,
        color: '#121416',
        whiteSpace: 'pre-wrap',
        border: '1px solid transparent',
        background: highlighted ? '#FFF7E8' : 'transparent',
        borderColor: highlighted ? '#EC8E01' : 'transparent',
        boxShadow: highlighted ? '0 0 0 3px rgba(236,142,1,0.15)' : 'none',
      }}
    >
      {renderedChildren}
    </p>
  );
}

function ModalBlock({
  modal,
  chunks,
  highlightedId,
  expanded,
  onToggle,
}: {
  modal: KdpModal;
  chunks: KdpChunk[];
  highlightedId: number | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const sanitized = useMemo(() => sanitizeHtml(modal.html ?? ''), [modal.html]);
  const preferHtml = useMemo(() => hasRichStructure(sanitized), [sanitized]);
  const cited = chunks.some((c) => c.id === highlightedId);

  return (
    <div
      className="kdp-modal-card my-2 overflow-hidden rounded-md border transition-all"
      data-modal-id={modal.id}
      data-kdp-cited={cited ? 'true' : 'false'}
      style={{ borderColor: '#EFEFF0', background: '#FAFAFB' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left transition-colors hover:bg-[#F5F7F9]"
        style={{
          borderColor: expanded ? '#EFEFF0' : 'transparent',
          fontFamily: 'HyundaiSansTextKR, sans-serif',
          fontSize: 13,
          color: '#002C5F',
          fontWeight: 500,
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 10,
                textAlign: 'center',
                color: '#929296',
                fontSize: 11,
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            >
              ▸
            </span>
            <span>📎 {modal.label}{modal.title ? ` · ${modal.title}` : ''}</span>
          </div>
          <div className="mt-1 text-[11px]" style={{ color: '#929296', fontWeight: 400, marginLeft: 16 }}>
            {KDP_CATEGORY_LABELS[modal.category]} · {expanded ? '접기' : '펼치기'}
          </div>
        </div>
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: '#EFEFF0', color: '#929296' }}>
          {expanded ? '접기 ▴' : '펼치기 ▾'}
        </span>
      </button>
      {expanded && (
        <div className="bg-white px-4 py-3">
          {/* 인용 앵커 — 원본 HTML 렌더링 시에도 data-chunk-id 로 스크롤 가능하게 */}
          {chunks.map((c) => (
            <span
              key={`anchor-${c.id}`}
              data-chunk-id={c.id}
              aria-hidden
              style={{ display: 'block', height: 0, overflow: 'hidden' }}
            />
          ))}

          {preferHtml && !showRaw ? (
            <div
              className="kdp-rich"
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          ) : chunks.length === 0 ? (
            <Paragraph data-chunk-id={`modal-${modal.id}`} highlighted={false}>
              {modal.text}
            </Paragraph>
          ) : (
            chunks.map((c) => (
              <Paragraph
                key={c.id}
                data-chunk-id={c.id}
                highlighted={highlightedId === c.id}
              >
                {c.text}
              </Paragraph>
            ))
          )}

          {preferHtml && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-[11px] underline"
                style={{ color: '#929296', fontFamily: 'HyundaiSansTextKR, sans-serif' }}
              >
                {showRaw ? '원본 서식으로 보기' : '청크 텍스트로 보기(근거 하이라이트)'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
