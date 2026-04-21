'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  KDP_CATEGORIES,
  KDP_CATEGORY_LABELS,
  type KdpBrand,
  type KdpCategory,
  type KdpModal,
  type KdpPolicy,
  type KdpSection,
} from '@/types/kdp';

interface Props {
  open: boolean;
  onClose: () => void;
  brand: KdpBrand;
  policy: KdpPolicy | null;
  sections: KdpSection[];
  modals: KdpModal[];
  onReload: () => Promise<void> | void;
}

type Mode = 'sections' | 'modals';

export function ManualEditDialog({ open, onClose, brand, policy, sections, modals, onReload }: Props) {
  const [mode, setMode] = useState<Mode>('sections');
  const [editingSection, setEditingSection] = useState<KdpSection | null>(null);
  const [editingModal, setEditingModal] = useState<KdpModal | null>(null);
  const [creating, setCreating] = useState(false);
  const [policyId, setPolicyId] = useState<number | null>(policy?.id ?? null);

  useEffect(() => {
    setPolicyId(policy?.id ?? null);
  }, [policy?.id]);

  if (!open) return null;

  const ensurePolicy = async (): Promise<number | null> => {
    if (policyId) return policyId;
    const res = await fetch(`/api/kdp/policies/${brand}/create-empty`, { method: 'POST' });
    const data = await res.json();
    const id = data?.policy?.id ?? null;
    if (id) {
      setPolicyId(id);
      await onReload();
    }
    return id;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(18,20,22,0.38)' }}
      onClick={onClose}
    >
      <div
        className="w-[min(1040px,96vw)] max-h-[94vh] overflow-hidden rounded-lg border bg-white shadow-xl"
        style={{ borderColor: '#EFEFF0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: '#EFEFF0' }}>
          <div style={{ fontFamily: 'HyundaiSansHeadKR, HyundaiSansTextKR, sans-serif', color: '#002C5F', fontSize: 16, fontWeight: 500 }}>
            수동 편집 — {brand === 'hyundai' ? '현대' : '기아'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant={mode === 'sections' ? 'default' : 'outline'} size="sm" onClick={() => setMode('sections')}>
              섹션 {sections.length}
            </Button>
            <Button variant={mode === 'modals' ? 'default' : 'outline'} size="sm" onClick={() => setMode('modals')}>
              모달 {modals.length}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
          </div>
        </div>

        {!policyId ? (
          <div className="p-8 text-center">
            <div className="mb-4 text-sm" style={{ color: '#535356' }}>
              아직 이 브랜드의 정책 레코드가 없습니다. 수동으로 비어있는 정책을 만들고 섹션/모달을 직접 추가할 수 있습니다.
            </div>
            <Button onClick={ensurePolicy}>빈 정책 만들기</Button>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(280px,360px)_1fr]" style={{ maxHeight: 'calc(94vh - 64px)' }}>
            <div className="overflow-y-auto border-r p-3" style={{ borderColor: '#EFEFF0' }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs tracking-[0.16em]" style={{ color: '#929296', fontFamily: 'HyundaiSansTextKR, sans-serif' }}>
                  {mode === 'sections' ? '섹션' : '모달'} 목록
                </div>
                <Button
                  size="xs"
                  onClick={() => {
                    setCreating(true);
                    if (mode === 'sections') setEditingSection(null);
                    else setEditingModal(null);
                  }}
                >
                  + 추가
                </Button>
              </div>
              {mode === 'sections' ? (
                <SectionList
                  items={sections}
                  selected={editingSection?.id ?? null}
                  onSelect={(s) => {
                    setEditingSection(s);
                    setCreating(false);
                  }}
                />
              ) : (
                <ModalList
                  items={modals}
                  selected={editingModal?.id ?? null}
                  onSelect={(m) => {
                    setEditingModal(m);
                    setCreating(false);
                  }}
                />
              )}
            </div>
            <div className="overflow-y-auto p-5">
              {mode === 'sections' ? (
                <SectionEditor
                  key={creating ? 'new' : editingSection?.id ?? 'empty'}
                  policyId={policyId}
                  section={creating ? null : editingSection}
                  creating={creating}
                  onSaved={async () => {
                    setCreating(false);
                    await onReload();
                  }}
                  onDeleted={async () => {
                    setEditingSection(null);
                    setCreating(false);
                    await onReload();
                  }}
                />
              ) : (
                <ModalEditor
                  key={creating ? 'new' : editingModal?.id ?? 'empty'}
                  policyId={policyId}
                  sections={sections}
                  modal={creating ? null : editingModal}
                  creating={creating}
                  onSaved={async () => {
                    setCreating(false);
                    await onReload();
                  }}
                  onDeleted={async () => {
                    setEditingModal(null);
                    setCreating(false);
                    await onReload();
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionList({
  items,
  selected,
  onSelect,
}: {
  items: KdpSection[];
  selected: number | null;
  onSelect: (s: KdpSection) => void;
}) {
  if (items.length === 0) {
    return <div className="py-6 text-center text-xs" style={{ color: '#929296' }}>섹션이 없습니다.</div>;
  }
  return (
    <ul className="space-y-1">
      {items.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onSelect(s)}
            className="w-full rounded-md border px-2 py-2 text-left text-xs"
            style={{
              borderColor: selected === s.id ? '#002C5F' : '#EFEFF0',
              background: selected === s.id ? '#F5F7F9' : '#FFFFFF',
              fontFamily: 'HyundaiSansTextKR, sans-serif',
              paddingLeft: 8 + (s.heading_level - 1) * 6,
            }}
          >
            <div style={{ color: '#121416', fontWeight: 500 }}>
              H{s.heading_level} {s.heading}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: '#929296' }}>
              {KDP_CATEGORY_LABELS[s.category]} · {s.text.length}자
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ModalList({
  items,
  selected,
  onSelect,
}: {
  items: KdpModal[];
  selected: number | null;
  onSelect: (m: KdpModal) => void;
}) {
  if (items.length === 0) {
    return <div className="py-6 text-center text-xs" style={{ color: '#929296' }}>모달이 없습니다.</div>;
  }
  return (
    <ul className="space-y-1">
      {items.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => onSelect(m)}
            className="w-full rounded-md border px-2 py-2 text-left text-xs"
            style={{
              borderColor: selected === m.id ? '#002C5F' : '#EFEFF0',
              background: selected === m.id ? '#F5F7F9' : '#FFFFFF',
              fontFamily: 'HyundaiSansTextKR, sans-serif',
            }}
          >
            <div style={{ color: '#121416', fontWeight: 500 }}>{m.label}</div>
            <div className="mt-0.5 text-[11px]" style={{ color: '#929296' }}>
              {KDP_CATEGORY_LABELS[m.category]} · {m.text.length}자
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SectionEditor({
  policyId,
  section,
  creating,
  onSaved,
  onDeleted,
}: {
  policyId: number;
  section: KdpSection | null;
  creating: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [heading, setHeading] = useState(section?.heading ?? '');
  const [level, setLevel] = useState<number>(section?.heading_level ?? 2);
  const [category, setCategory] = useState<KdpCategory>(section?.category ?? 'other');
  const [text, setText] = useState(section?.text ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeading(section?.heading ?? '');
    setLevel(section?.heading_level ?? 2);
    setCategory(section?.category ?? 'other');
    setText(section?.text ?? '');
  }, [section?.id, creating]);

  const isEditing = section != null && !creating;

  const save = async () => {
    if (!heading.trim()) return;
    setBusy(true);
    try {
      if (isEditing) {
        await fetch(`/api/kdp/sections/${section!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ heading, heading_level: level, category, text }),
        });
      } else {
        await fetch('/api/kdp/sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            policy_id: policyId,
            input: { heading, heading_level: level, category, text },
          }),
        });
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!section) return;
    if (!confirm('이 섹션을 삭제하시겠어요?')) return;
    setBusy(true);
    try {
      await fetch(`/api/kdp/sections/${section.id}`, { method: 'DELETE' });
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  if (!creating && !section) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: '#929296' }}>
        좌측에서 섹션을 선택하거나 [+ 추가]를 눌러 새 섹션을 만드세요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div style={{ fontFamily: 'HyundaiSansHeadKR, HyundaiSansTextKR, sans-serif', color: '#002C5F', fontSize: 15, fontWeight: 500 }}>
        {isEditing ? `섹션 편집 #${section!.id}` : '새 섹션'}
      </div>
      <Field label="제목">
        <input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={{ borderColor: '#EFEFF0' }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="레벨 (H1~H6)">
          <input
            type="number"
            min={1}
            max={6}
            value={level}
            onChange={(e) => setLevel(Math.max(1, Math.min(6, Number(e.target.value) || 2)))}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#EFEFF0' }}
          />
        </Field>
        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as KdpCategory)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#EFEFF0', background: '#FFFFFF' }}
          >
            {KDP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {KDP_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="본문">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          className="w-full resize-y rounded-md border px-3 py-2 text-sm outline-none"
          style={{ borderColor: '#EFEFF0', background: '#FAFAFB', fontFamily: 'HyundaiSansTextKR, sans-serif' }}
        />
      </Field>
      <div className="flex justify-between">
        {isEditing ? (
          <Button variant="destructive" onClick={remove} disabled={busy}>삭제</Button>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={busy || !heading.trim()}>
          {busy ? '저장 중…' : isEditing ? '저장' : '추가'}
        </Button>
      </div>
    </div>
  );
}

function ModalEditor({
  policyId,
  sections,
  modal,
  creating,
  onSaved,
  onDeleted,
}: {
  policyId: number;
  sections: KdpSection[];
  modal: KdpModal | null;
  creating: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [label, setLabel] = useState(modal?.label ?? '');
  const [title, setTitle] = useState(modal?.title ?? '');
  const [linkKey, setLinkKey] = useState(modal?.link_key ?? '');
  const [text, setText] = useState(modal?.text ?? '');
  const [html, setHtml] = useState(modal?.html ?? '');
  const [category, setCategory] = useState<KdpCategory>(modal?.category ?? 'other');
  const [anchoredSectionId, setAnchoredSectionId] = useState<number | null>(modal?.anchored_section_id ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLabel(modal?.label ?? '');
    setTitle(modal?.title ?? '');
    setLinkKey(modal?.link_key ?? '');
    setText(modal?.text ?? '');
    setHtml(modal?.html ?? '');
    setCategory(modal?.category ?? 'other');
    setAnchoredSectionId(modal?.anchored_section_id ?? null);
  }, [modal?.id, creating]);

  const isEditing = modal != null && !creating;

  const sectionOptions = useMemo(
    () => [{ id: 0, label: '(연결 없음)' }, ...sections.map((s) => ({ id: s.id, label: `H${s.heading_level} ${s.heading}` }))],
    [sections],
  );

  const save = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      if (isEditing) {
        await fetch(`/api/kdp/modals/${modal!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label,
            title,
            link_key: linkKey || `manual-${modal!.id}`,
            text,
            html,
            category,
            anchored_section_id: anchoredSectionId || null,
          }),
        });
      } else {
        await fetch('/api/kdp/modals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            policy_id: policyId,
            input: {
              label,
              title,
              link_key: linkKey || `manual-${Date.now()}`,
              text,
              html,
              category,
              anchored_section_id: anchoredSectionId || null,
            },
          }),
        });
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!modal) return;
    if (!confirm('이 모달을 삭제하시겠어요?')) return;
    setBusy(true);
    try {
      await fetch(`/api/kdp/modals/${modal.id}`, { method: 'DELETE' });
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  if (!creating && !modal) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: '#929296' }}>
        좌측에서 모달을 선택하거나 [+ 추가]를 눌러 새 모달을 만드세요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div style={{ fontFamily: 'HyundaiSansHeadKR, HyundaiSansTextKR, sans-serif', color: '#002C5F', fontSize: 15, fontWeight: 500 }}>
        {isEditing ? `모달 편집 #${modal!.id}` : '새 모달'}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="트리거 라벨">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#EFEFF0' }}
          />
        </Field>
        <Field label="모달 제목(선택)">
          <input
            value={title ?? ''}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#EFEFF0' }}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="link_key (식별자)">
          <input
            value={linkKey}
            onChange={(e) => setLinkKey(e.target.value)}
            placeholder="예: #modal-third-party"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#EFEFF0' }}
          />
        </Field>
        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as KdpCategory)}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#EFEFF0', background: '#FFFFFF' }}
          >
            {KDP_CATEGORIES.map((c) => (
              <option key={c} value={c}>{KDP_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="연결 섹션">
        <select
          value={anchoredSectionId ?? 0}
          onChange={(e) => setAnchoredSectionId(Number(e.target.value) || null)}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={{ borderColor: '#EFEFF0', background: '#FFFFFF' }}
        >
          {sectionOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="본문 텍스트">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="w-full resize-y rounded-md border px-3 py-2 text-sm outline-none"
          style={{ borderColor: '#EFEFF0', background: '#FAFAFB', fontFamily: 'HyundaiSansTextKR, sans-serif' }}
        />
      </Field>
      <Field label="HTML(선택)">
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={6}
          className="w-full resize-y rounded-md border px-3 py-2 text-[12px] font-mono outline-none"
          style={{ borderColor: '#EFEFF0', background: '#FAFAFB' }}
        />
      </Field>
      <div className="flex justify-between">
        {isEditing ? (
          <Button variant="destructive" onClick={remove} disabled={busy}>삭제</Button>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={busy || !label.trim()}>
          {busy ? '저장 중…' : isEditing ? '저장' : '추가'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs" style={{ color: '#535356', fontFamily: 'HyundaiSansTextKR, sans-serif' }}>
        {label}
      </span>
      {children}
    </label>
  );
}
