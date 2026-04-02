'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useContractStore } from '@/stores/contract-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Contract, ContractFile, ContractVersion, DataDomainValue, CreateContractInput } from '@/types/contract';

/* ─── File extension → Hyundai DS style chip ─── */
function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, { bg: string; fg: string; label: string }> = {
    pdf:  { bg: '#FDEDEF', fg: '#E81F2C', label: 'PDF' },
    doc:  { bg: '#EDF2FF', fg: '#002C5F', label: 'DOC' },
    docx: { bg: '#EDF2FF', fg: '#002C5F', label: 'DOC' },
    xls:  { bg: '#E8F5E9', fg: '#1D7044', label: 'XLS' },
    xlsx: { bg: '#E8F5E9', fg: '#1D7044', label: 'XLS' },
    csv:  { bg: '#E8F5E9', fg: '#1D7044', label: 'CSV' },
    ppt:  { bg: '#FFF3E0', fg: '#D04423', label: 'PPT' },
    pptx: { bg: '#FFF3E0', fg: '#D04423', label: 'PPT' },
    zip:  { bg: '#FFF8E1', fg: '#EC8E01', label: 'ZIP' },
    rar:  { bg: '#FFF8E1', fg: '#EC8E01', label: 'RAR' },
    jpg:  { bg: '#F3E5F5', fg: '#7B3FA0', label: 'JPG' },
    jpeg: { bg: '#F3E5F5', fg: '#7B3FA0', label: 'JPG' },
    png:  { bg: '#F3E5F5', fg: '#7B3FA0', label: 'PNG' },
    txt:  { bg: '#FAFAFB', fg: '#69696E', label: 'TXT' },
    msg:  { bg: '#E3F2FD', fg: '#0672ED', label: 'MSG' },
    eml:  { bg: '#E3F2FD', fg: '#0672ED', label: 'EML' },
    hwp:  { bg: '#E0F7FA', fg: '#00809E', label: 'HWP' },
    hwpx: { bg: '#E0F7FA', fg: '#00809E', label: 'HWP' },
  };
  const config = iconMap[ext] || { bg: '#FAFAFB', fg: '#69696E', label: ext.toUpperCase().slice(0, 3) || 'FILE' };
  return (
    <span className="inline-flex items-center justify-center rounded shrink-0"
      style={{ backgroundColor: config.bg, color: config.fg, fontSize: '9px', fontWeight: 600, padding: '2px 6px', lineHeight: 1, letterSpacing: '0.03em' }}
      title={fileName}>
      {config.label}
    </span>
  );
}

/* ─── Data Domain Cell — with pending state support ─── */
function DomainCell({ value, contractId, field, onUpdate, pending }: {
  value: DataDomainValue;
  contractId: string;
  field: string;
  onUpdate: (id: string, data: Record<string, string>) => void;
  pending?: boolean;
}) {
  const cycle = () => {
    const next: Record<DataDomainValue, DataDomainValue> = { 'O': 'X', 'X': 'null', 'null': 'O' };
    onUpdate(contractId, { [field]: next[value] });
  };

  // Pending: cell pulses + half-filled circle
  if (pending && value !== 'O') {
    return (
      <td className="px-2 py-2 text-center cursor-pointer" onClick={cycle}
        style={{ animation: 'domain-pulse 0.8s ease-in-out infinite' }}>
        <svg className="w-4 h-4 mx-auto" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="#00AAD2" strokeWidth="1.2" strokeDasharray="3 2" />
          <path d="M5 8.2L7.2 10.4L11 5.6" stroke="#00AAD2" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        </svg>
      </td>
    );
  }

  if (value === 'O') {
    return (
      <td className="px-2 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
        <svg className="w-4 h-4 mx-auto" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" fill="#002C5F" />
          <path d="M5 8.2L7.2 10.4L11 5.6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </td>
    );
  }
  if (value === 'X') {
    return (
      <td className="px-2 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
        <svg className="w-4 h-4 mx-auto" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="#B2B6BD" strokeWidth="1.2" />
        </svg>
      </td>
    );
  }
  return (
    <td className="px-2 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
      <svg className="w-4 h-4 mx-auto" viewBox="0 0 16 16" fill="none" opacity="0.3">
        <line x1="5" y1="8" x2="11" y2="8" stroke="#929296" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </td>
  );
}

const DOMAIN_FIELDS = [
  { key: 'vehicle', label: '차량', field: 'data_domain_vehicle' },
  { key: 'customer', label: '고객', field: 'data_domain_customer' },
  { key: 'sales', label: '판매', field: 'data_domain_sales' },
  { key: 'quality', label: '품질', field: 'data_domain_quality' },
  { key: 'production', label: '생산', field: 'data_domain_production' },
] as const;

/* ─── File Upload Cell (icon-based) ─── */
function FileCell({ files, contractId, category, categoryLabel, completedVersionFiles }: {
  files: ContractFile[];
  contractId: string;
  category: 'final_contract' | 'related_document' | 'correspondence';
  categoryLabel: string;
  completedVersionFiles?: { file: ContractFile; versionNumber: number }[];
}) {
  const { uploadFile, deleteFile } = useContractStore();
  const fileRef = useRef<HTMLInputElement>(null);
  // Original files (no version_id)
  const originalFiles = files.filter(f => f.file_category === category && !f.version_id);
  // Completed version files for this category
  const versionFiles = (completedVersionFiles || []).filter(vf => vf.file.file_category === category);

  return (
    <td className="px-2 py-2">
      <div className="flex items-center gap-1 flex-wrap">
        {originalFiles.map(f => (
          <div key={f.id} className="relative group inline-flex">
            <a href={`/api/contracts/files/${f.id}`} download={f.file_name}
              title={`${f.file_name} (원본)`} className="hover:opacity-70 transition-opacity">
              <span className="inline-flex flex-col items-center">
                <FileIcon fileName={f.file_name} />
                <span className="text-[7px] text-muted-foreground leading-none mt-0.5">원본</span>
              </span>
            </a>
            <button onClick={() => deleteFile(f.id)}
              className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3 h-3 rounded-full bg-destructive text-white text-[7px] leading-none">✕</button>
          </div>
        ))}
        {versionFiles.map(vf => (
          <div key={vf.file.id} className="relative group inline-flex">
            <a href={`/api/contracts/files/${vf.file.id}`} download={vf.file.file_name}
              title={`${vf.file.file_name} (v${vf.versionNumber})`} className="hover:opacity-70 transition-opacity">
              <span className="inline-flex flex-col items-center">
                <FileIcon fileName={vf.file.file_name} />
                <span className="text-[7px] text-muted-foreground leading-none mt-0.5">v{vf.versionNumber}</span>
              </span>
            </a>
          </div>
        ))}
        <label className="inline-flex items-center justify-center w-5 h-5 rounded border border-dashed border-border text-[10px] text-muted-foreground hover:text-primary hover:border-primary cursor-pointer transition-colors" title={`${categoryLabel} 추가`}>
          +
          <input ref={fileRef} type="file" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) { await uploadFile(contractId, category, file); }
            if (fileRef.current) fileRef.current.value = '';
          }} />
        </label>
      </div>
    </td>
  );
}

/* ─── Transfer Info Popup ─── */
function TransferInfoCell({ contract, field, label }: {
  contract: Contract;
  field: 'transfer_purpose' | 'transferable_data';
  label: string;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [popupAbove, setPopupAbove] = useState(true);
  const cellRef = useRef<HTMLTableCellElement>(null);
  const { updateContract } = useContractStore();

  const value = contract[field];

  const handleSave = async () => {
    await updateContract(contract.id, { [field]: editValue });
    setEditing(false);
  };

  const handleMouseEnter = () => {
    // Check if there's enough space above; if not, show below
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      setPopupAbove(rect.top > 220);
    }
    setShowPopup(true);
  };

  return (
    <td ref={cellRef} className="px-2 py-2 relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { if (!editing) setShowPopup(false); }}>
      <div className="text-[10px] text-foreground truncate max-w-[100px] cursor-pointer">
        {value ? value.substring(0, 20) + (value.length > 20 ? '...' : '') : <span className="text-muted-foreground">미설정</span>}
      </div>
      {showPopup && (
        <div className={`absolute z-50 left-0 w-72 p-3 bg-card border border-border rounded-lg shadow-xl ${
          popupAbove ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
          onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] text-primary tracking-wider font-bold mb-2">{label}</div>
          {editing ? (
            <div className="space-y-2">
              <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={4}
                className="bg-background border-border text-xs resize-none text-foreground" autoFocus />
              <div className="flex gap-1">
                <Button onClick={handleSave} className="text-[10px] h-6 px-2 bg-primary/20 text-primary border border-primary/30">SAVE</Button>
                <Button onClick={() => setEditing(false)} variant="ghost" className="text-[10px] h-6 px-2">CANCEL</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-xs text-foreground whitespace-pre-wrap mb-2">
                {value || '데이터 없음. 최종계약서 PDF를 업로드하면 자동으로 추출됩니다.'}
              </div>
              <button onClick={() => { setEditing(true); setEditValue(value || ''); }}
                className="text-[9px] text-primary hover:underline">EDIT</button>
            </>
          )}
        </div>
      )}
    </td>
  );
}

/* ─── Checkbox Filter Dropdown ─── */
function CheckboxFilter({ label, options, selected, onChange, labelMap }: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  labelMap?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allSelected = selected.size === 0; // empty = all
  const toggleAll = () => onChange(new Set());
  const toggleOne = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val); else next.add(val);
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1 text-[10px] tracking-wider rounded border transition-colors ${
          !allSelected ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground border-border hover:text-foreground'
        }`}>
        {label} {!allSelected && `(${selected.size})`} <span className="text-[8px]">▼</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[140px] max-h-[250px] overflow-y-auto bg-card border border-border rounded-lg shadow-xl p-1.5">
          <label className="flex items-center gap-2 px-2 py-1 text-[10px] text-foreground cursor-pointer hover:bg-muted/30 rounded">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3 h-3" />
            ALL
          </label>
          <div className="border-t border-border my-1" />
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-2 py-1 text-[10px] text-foreground cursor-pointer hover:bg-muted/30 rounded">
              <input type="checkbox" checked={allSelected || selected.has(opt)} onChange={() => toggleOne(opt)} className="w-3 h-3" />
              {labelMap?.[opt] || opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Domain Filter (O/X/데이터없음) ─── */
const DOMAIN_LABELS: Record<string, string> = { 'O': 'O (있음)', 'X': 'X (없음)', 'null': '데이터없음' };
function DomainFilter({ label, selected, onChange }: {
  label: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return <CheckboxFilter label={label} options={['O', 'X', 'null']} selected={selected} onChange={onChange} labelMap={DOMAIN_LABELS} />;
}

/* ─── Column resize context for multi-select + localStorage persistence ─── */
const COL_WIDTHS_KEY = 'bizsys-contract-col-widths';

function loadSavedWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COL_WIDTHS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveWidths(widths: Record<string, number>) {
  try { localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(widths)); } catch {}
}

const ColumnResizeContext = React.createContext<{
  selected: Set<string>;
  toggleSelect: (name: string, shift: boolean) => void;
  dragSelect: (name: string) => void;
  startDragSelect: (name: string) => void;
  endDragSelect: () => void;
  isDragging: boolean;
  applyResizeDelta: (delta: number) => void;
  autoFitCol: (name: string) => void;
  registerCol: (name: string, setWidth: (w: number | undefined) => void, getWidth: () => number, minW: number, thEl: HTMLTableCellElement | null) => void;
  savedWidths: Record<string, number>;
  persistWidth: (name: string, w: number) => void;
}>({
  selected: new Set(),
  toggleSelect: () => {},
  dragSelect: () => {},
  startDragSelect: () => {},
  endDragSelect: () => {},
  isDragging: false,
  applyResizeDelta: () => {},
  autoFitCol: () => {},
  registerCol: () => {},
  savedWidths: {},
  persistWidth: () => {},
});

function ColumnResizeProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const colsRef = useRef<Map<string, { setWidth: (w: number | undefined) => void; getWidth: () => number; minW: number; thEl: HTMLTableCellElement | null }>>(new Map());
  const [savedWidths, setSavedWidths] = useState<Record<string, number>>({});

  useEffect(() => { setSavedWidths(loadSavedWidths()); }, []);

  const toggleSelect = useCallback((name: string, shift: boolean) => {
    setSelected(prev => {
      const next = new Set(shift ? prev : []);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  // Drag select: mouse down on one header, drag across others
  const startDragSelect = useCallback((name: string) => {
    setIsDragging(true);
    setSelected(new Set([name]));
  }, []);

  const dragSelect = useCallback((name: string) => {
    if (!isDragging) return;
    setSelected(prev => { const next = new Set(prev); next.add(name); return next; });
  }, [isDragging]);

  const endDragSelect = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Listen for global mouseup to end drag
  useEffect(() => {
    const handler = () => { if (isDragging) setIsDragging(false); };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [isDragging]);

  const persistWidth = useCallback((name: string, w: number) => {
    setSavedWidths(prev => {
      const next = { ...prev, [name]: w };
      saveWidths(next);
      return next;
    });
  }, []);

  const applyResizeDelta = useCallback((delta: number) => {
    selected.forEach(name => {
      const col = colsRef.current.get(name);
      if (col) {
        const newW = Math.max(col.minW, col.getWidth() + delta);
        col.setWidth(newW);
        persistWidth(name, newW);
      }
    });
  }, [selected, persistWidth]);

  // Auto-fit: measure max content width in column, shrink to fit
  const autoFitCol = useCallback((name: string) => {
    const col = colsRef.current.get(name);
    if (!col || !col.thEl) return;
    const table = col.thEl.closest('table');
    if (!table) return;
    const colIndex = Array.from(col.thEl.parentElement!.children).indexOf(col.thEl);
    let maxW = col.minW;
    // Measure all cells in this column
    table.querySelectorAll('tbody tr').forEach(row => {
      const cell = row.children[colIndex] as HTMLElement;
      if (cell) {
        // Temporarily set width to auto to measure natural width
        const text = cell.textContent || '';
        maxW = Math.max(maxW, Math.min(text.length * 8 + 24, 300));
      }
    });
    // Also measure header text
    const headerText = col.thEl.textContent || '';
    maxW = Math.max(maxW, headerText.length * 8 + 32);
    col.setWidth(maxW);
    persistWidth(name, maxW);

    // If multiple selected, auto-fit all
    if (selected.has(name) && selected.size > 1) {
      selected.forEach(n => {
        if (n !== name) {
          const c = colsRef.current.get(n);
          if (c && c.thEl) {
            const t = c.thEl.closest('table');
            if (!t) return;
            const ci = Array.from(c.thEl.parentElement!.children).indexOf(c.thEl);
            let mw = c.minW;
            t.querySelectorAll('tbody tr').forEach(row => {
              const cell = row.children[ci] as HTMLElement;
              if (cell) mw = Math.max(mw, Math.min((cell.textContent || '').length * 8 + 24, 300));
            });
            mw = Math.max(mw, (c.thEl.textContent || '').length * 8 + 32);
            c.setWidth(mw);
            persistWidth(n, mw);
          }
        }
      });
    }
  }, [selected, persistWidth]);

  const registerCol = useCallback((name: string, setWidth: (w: number | undefined) => void, getWidth: () => number, minW: number, thEl: HTMLTableCellElement | null) => {
    colsRef.current.set(name, { setWidth, getWidth, minW, thEl });
  }, []);

  return (
    <ColumnResizeContext.Provider value={{ selected, toggleSelect, dragSelect, startDragSelect, endDragSelect, isDragging, applyResizeDelta, autoFitCol, registerCol, savedWidths, persistWidth }}>
      {children}
    </ColumnResizeContext.Provider>
  );
}

/* ─── Resizable Column Header ─── */
function ResizableTh({ children, className, minWidth = 40, colName }: {
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
  colName: string;
}) {
  const { selected, toggleSelect, dragSelect, startDragSelect, endDragSelect, isDragging, applyResizeDelta, autoFitCol, registerCol, savedWidths, persistWidth } = React.useContext(ColumnResizeContext);
  const [width, setWidth] = useState<number | undefined>(savedWidths[colName] || undefined);
  const thRef = useRef<HTMLTableCellElement>(null);
  const startX = useRef(0);
  const startW = useRef(0);
  const isSelected = selected.has(colName);

  useEffect(() => {
    if (savedWidths[colName]) setWidth(savedWidths[colName]);
  }, [savedWidths, colName]);

  useEffect(() => {
    registerCol(colName, setWidth, () => thRef.current?.offsetWidth || 80, minWidth, thRef.current);
  }, [colName, minWidth, registerCol]);

  // Resize handle: drag to resize, double-click to auto-fit
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startW.current = thRef.current?.offsetWidth || 80;

    const resizeMultiple = isSelected && selected.size > 1;

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX.current;
      if (resizeMultiple) {
        applyResizeDelta(diff);
        startX.current = ev.clientX;
      } else {
        setWidth(Math.max(minWidth, startW.current + diff));
      }
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (!resizeMultiple && thRef.current) {
        persistWidth(colName, thRef.current.offsetWidth);
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [minWidth, isSelected, selected.size, applyResizeDelta, colName, persistWidth]);

  // Double-click on resize handle: auto-fit to content
  const onResizeDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    autoFitCol(colName);
  }, [colName, autoFitCol]);

  // Header mousedown: start drag-select
  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      toggleSelect(colName, true);
    } else {
      startDragSelect(colName);
    }
  }, [colName, toggleSelect, startDragSelect]);

  // Header mouseenter during drag: extend selection
  const onHeaderMouseEnter = useCallback(() => {
    if (isDragging) {
      dragSelect(colName);
    }
  }, [colName, isDragging, dragSelect]);

  return (
    <th ref={thRef} className={`${className} select-none`}
      style={width ? { width, minWidth } : undefined}
      onMouseDown={onHeaderMouseDown}
      onMouseEnter={onHeaderMouseEnter}
      onMouseUp={endDragSelect}>
      <div className="flex items-center justify-between gap-1 cursor-default">
        <span className={`truncate ${isSelected ? 'text-primary font-bold' : ''}`}>{children}</span>
        <div
          onMouseDown={onResizeMouseDown}
          onDoubleClick={onResizeDoubleClick}
          className={`w-2 h-full min-h-[16px] cursor-col-resize rounded flex-shrink-0 transition-colors ${
            isSelected ? 'bg-primary/60 hover:bg-primary' : 'bg-transparent hover:bg-primary/40'
          }`} />
      </div>
    </th>
  );
}

/* ─── New Contract Dialog ─── */
function NewContractDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { createContract } = useContractStore();
  const [form, setForm] = useState<CreateContractInput>({
    region: '', country: '', entity_code: '', brand: '현대', entity_name: '',
  });

  const handleCreate = async () => {
    if (!form.region || !form.country || !form.entity_code || !form.entity_name) return;
    await createContract(form);
    onOpenChange(false);
    setForm({ region: '', country: '', entity_code: '', brand: '현대', entity_name: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary text-sm tracking-wider">NEW CONTRACT ENTITY</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider">REGION</label>
            <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v || '' })}>
              <SelectTrigger className="bg-background border-border text-xs"><SelectValue placeholder="Select region" /></SelectTrigger>
              <SelectContent className="glass border-border">
                {['North America', 'South America', 'Europe', 'Asia Pacific', 'Middle East/Africa'].map(r => (
                  <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider">COUNTRY</label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="bg-background border-border text-xs" placeholder="e.g., the United States" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground tracking-wider">ENTITY CODE (법인명)</label>
              <Input value={form.entity_code} onChange={(e) => setForm({ ...form, entity_code: e.target.value })}
                className="bg-background border-border text-xs" placeholder="e.g., HMA" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground tracking-wider">BRAND (브랜드)</label>
              <Select value={form.brand} onValueChange={(v) => setForm({ ...form, brand: v || '현대' })}>
                <SelectTrigger className="bg-background border-border text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="glass border-border">
                  <SelectItem value="현대" className="text-xs">현대</SelectItem>
                  <SelectItem value="기아" className="text-xs">기아</SelectItem>
                  <SelectItem value="제네시스" className="text-xs">제네시스</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground tracking-wider">ENTITY NAME (법인명상세)</label>
            <Input value={form.entity_name} onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
              className="bg-background border-border text-xs" placeholder="e.g., 현대미국" />
          </div>
          <Button onClick={handleCreate} className="w-full bg-primary/20 text-primary border border-primary/30 text-xs">
            CREATE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Contracts Page ─── */
export default function ContractsPage() {
  const {
    contracts, versions, loading, searchQuery, searchResult, searchLoading,
    fetchContracts, updateContract, deleteContract, importCSV,
    searchContracts, setSearchQuery, fetchVersions, createVersion, updateVersion,
  } = useContractStore();

  const [newOpen, setNewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [addingVersion, setAddingVersion] = useState<string | null>(null);
  const [versionForm, setVersionForm] = useState({ change_reason: '', transfer_purpose: '', transferable_data: '', effective_date: '', added_domains: [] as string[] });
  const importRef = useRef<HTMLInputElement>(null);

  const toggleRowExpand = (contractId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(contractId)) { next.delete(contractId); } else { next.add(contractId); fetchVersions(contractId); }
      return next;
    });
  };

  const handleCreateVersion = async (contractId: string) => {
    await createVersion(contractId, versionForm);
    setAddingVersion(null);
    setVersionForm({ change_reason: '', transfer_purpose: '', transferable_data: '', effective_date: '', added_domains: [] });
  };

  // Get pending domains for a contract (from in-progress versions)
  const getPendingDomains = (contractId: string): Set<string> => {
    const vers = versions[contractId] || [];
    const pending = new Set<string>();
    vers.forEach(v => {
      if (v.status === 'pending' && v.added_domains) {
        try {
          const domains: string[] = typeof v.added_domains === 'string' ? JSON.parse(v.added_domains) : v.added_domains;
          domains.forEach(d => pending.add(d));
        } catch {}
      }
    });
    return pending;
  };

  // Check if contract has any pending version
  const hasPendingVersion = (contractId: string): boolean => {
    return (versions[contractId] || []).some(v => v.status === 'pending');
  };

  // Check if contract was active in last 6 months
  const isRecentlyActive = (contract: Contract) => {
    const activity = contract.last_activity_at || contract.updated_at;
    if (!activity) return false;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return new Date(activity) > sixMonthsAgo;
  };

  // Checkbox filters — empty Set means "all selected"
  const [filterRegions, setFilterRegions] = useState<Set<string>>(new Set());
  const [filterCountries, setFilterCountries] = useState<Set<string>>(new Set());
  const [filterBrands, setFilterBrands] = useState<Set<string>>(new Set());
  const [filterVehicle, setFilterVehicle] = useState<Set<string>>(new Set());
  const [filterCustomer, setFilterCustomer] = useState<Set<string>>(new Set());
  const [filterSales, setFilterSales] = useState<Set<string>>(new Set());
  const [filterQuality, setFilterQuality] = useState<Set<string>>(new Set());
  const [filterProduction, setFilterProduction] = useState<Set<string>>(new Set());

  const [statFilter, setStatFilter] = useState<'started' | 'not-started' | 'secured' | 'not-secured' | null>(null);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);
  // Fetch versions for all contracts to show completed files in main row
  useEffect(() => { contracts.forEach(c => fetchVersions(c.id)); }, [contracts, fetchVersions]);

  const passesFilter = (value: string, filterSet: Set<string>) =>
    filterSet.size === 0 || filterSet.has(value);

  const filtered = contracts.filter(c => {
    if (!passesFilter(c.region, filterRegions)) return false;
    if (!passesFilter(c.country, filterCountries)) return false;
    if (!passesFilter(c.brand, filterBrands)) return false;
    if (!passesFilter(c.data_domain_vehicle, filterVehicle)) return false;
    if (!passesFilter(c.data_domain_customer, filterCustomer)) return false;
    if (!passesFilter(c.data_domain_sales, filterSales)) return false;
    if (!passesFilter(c.data_domain_quality, filterQuality)) return false;
    if (!passesFilter(c.data_domain_production, filterProduction)) return false;
    return true;
  });

  const statFilteredContracts = statFilter ? filtered.filter(c => {
    if (statFilter === 'started') return domains.some(d => c[d] === 'O');
    if (statFilter === 'not-started') return !domains.some(d => c[d] === 'O');
    if (statFilter === 'secured') return !domains.some(d => c[d] === 'X');
    if (statFilter === 'not-secured') return domains.some(d => c[d] === 'X');
    return true;
  }) : null;
  const displayContracts = statFilteredContracts || filtered;

  const regions = [...new Set(contracts.map(c => c.region))].sort();
  const countries = [...new Set(contracts.map(c => c.country))].sort();
  const brands = [...new Set(contracts.map(c => c.brand))].sort();

  // Group by region for display — use displayContracts (stat filter applied)
  const grouped: Record<string, Contract[]> = {};
  for (const c of displayContracts) {
    if (!grouped[c.region]) grouped[c.region] = [];
    grouped[c.region].push(c);
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importCSV(file);
    if (importRef.current) importRef.current.value = '';
  };

  const handleSearch = () => {
    if (searchQuery.trim()) searchContracts(searchQuery);
  };

  const hasActiveFilters = filterRegions.size > 0 || filterCountries.size > 0 || filterBrands.size > 0 ||
    filterVehicle.size > 0 || filterCustomer.size > 0 || filterSales.size > 0 || filterQuality.size > 0 || filterProduction.size > 0;

  const clearAllFilters = () => {
    setFilterRegions(new Set()); setFilterCountries(new Set()); setFilterBrands(new Set());
    setFilterVehicle(new Set()); setFilterCustomer(new Set()); setFilterSales(new Set());
    setFilterQuality(new Set()); setFilterProduction(new Set());
  };

  const thBase = "px-2 py-2.5 text-left text-[9px] text-muted-foreground tracking-wider font-medium";

  // Stats
  const totalContracts = contracts.length;
  const domains = ['data_domain_vehicle', 'data_domain_customer', 'data_domain_sales', 'data_domain_quality', 'data_domain_production'] as const;
  const startedCount = contracts.filter(c => domains.some(d => c[d] === 'O')).length;
  const startedPct = totalContracts > 0 ? Math.round((startedCount / totalContracts) * 100) : 0;
  const fullySecuredCount = contracts.filter(c => !domains.some(d => c[d] === 'X')).length;
  const fullySecuredPct = totalContracts > 0 ? Math.round((fullySecuredCount / totalContracts) * 100) : 0;

  // Stat labels — editable via localStorage
  const STAT_LABELS_KEY = 'bizsys-stat-labels';
  const defaultLabels = {
    leftTitle: '데이터 이전 계약 마련율',
    leftDesc: '1개 이상 도메인 체결 법인',
    rightTitle: '데이터 이전 근거 완전 확보',
    rightDesc: '전 도메인 체결 완료 법인',
    doneWord: '체결',
    notDoneWord: '미체결',
  };
  const [statLabels, setStatLabels] = useState(defaultLabels);
  const [editingStatLabels, setEditingStatLabels] = useState(false);
  const [statLabelDraft, setStatLabelDraft] = useState(defaultLabels);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STAT_LABELS_KEY);
      if (saved) setStatLabels(JSON.parse(saved));
    } catch {}
  }, []);

  const saveStatLabels = () => {
    setStatLabels(statLabelDraft);
    localStorage.setItem(STAT_LABELS_KEY, JSON.stringify(statLabelDraft));
    setEditingStatLabels(false);
  };

  // statFilter moved up before filtered

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-wider">CONTRACTS</h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-0.5">계약 현황 관리 대시보드</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input ref={importRef} type="file" accept=".csv,.xlsx,.xls,.tsv" className="hidden" onChange={handleImport} />
            <span className="inline-flex items-center px-3 py-1.5 text-[10px] tracking-wider bg-muted/30 text-foreground border border-border rounded hover:bg-muted/50 transition-colors cursor-pointer">
              📥 IMPORT
            </span>
          </label>
          <Button onClick={() => setNewOpen(true)} className="bg-primary/20 text-primary border border-primary/30 text-[10px] tracking-wider h-8">
            + NEW
          </Button>
        </div>
      </div>

      {/* Stats */}
      {totalContracts > 0 && (
        <div className="space-y-2">
          {editingStatLabels ? (
            <div className="rounded border border-border bg-card p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input value={statLabelDraft.leftTitle} onChange={e => setStatLabelDraft({ ...statLabelDraft, leftTitle: e.target.value })}
                  placeholder="좌측 제목" className="bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground" />
                <input value={statLabelDraft.rightTitle} onChange={e => setStatLabelDraft({ ...statLabelDraft, rightTitle: e.target.value })}
                  placeholder="우측 제목" className="bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground" />
                <div className="flex gap-1">
                  <input value={statLabelDraft.doneWord} onChange={e => setStatLabelDraft({ ...statLabelDraft, doneWord: e.target.value })}
                    placeholder="완료 워딩" className="bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground w-1/2" />
                  <input value={statLabelDraft.notDoneWord} onChange={e => setStatLabelDraft({ ...statLabelDraft, notDoneWord: e.target.value })}
                    placeholder="미완 워딩" className="bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground w-1/2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={statLabelDraft.leftDesc} onChange={e => setStatLabelDraft({ ...statLabelDraft, leftDesc: e.target.value })}
                  placeholder="좌측 설명" className="bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground" />
                <input value={statLabelDraft.rightDesc} onChange={e => setStatLabelDraft({ ...statLabelDraft, rightDesc: e.target.value })}
                  placeholder="우측 설명" className="bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground" />
              </div>
              <div className="flex gap-1">
                <button onClick={saveStatLabels} className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground">저장</button>
                <button onClick={() => setEditingStatLabels(false)} className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground">취소</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              {/* Left stat: 마련율 */}
              <div className="flex-1 rounded border border-border bg-card p-3 flex items-center gap-3">
                <div className="text-2xl font-bold text-primary">{startedPct}%</div>
                <div>
                  <div className="text-[11px] text-foreground font-medium">{statLabels.leftTitle}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {totalContracts}개 법인 중{' '}
                    <button onClick={() => setStatFilter(statFilter === 'started' ? null : 'started')}
                      className={`font-medium cursor-pointer hover:underline ${statFilter === 'started' ? 'text-primary underline' : 'text-foreground'}`}>
                      {startedCount}개 {statLabels.doneWord}
                    </button>
                    {', '}
                    <button onClick={() => setStatFilter(statFilter === 'not-started' ? null : 'not-started')}
                      className={`font-medium cursor-pointer hover:underline ${statFilter === 'not-started' ? 'text-primary underline' : 'text-foreground'}`}>
                      {totalContracts - startedCount}개 {statLabels.notDoneWord}
                    </button>
                  </div>
                </div>
                <div className="ml-auto w-24 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${startedPct}%` }} />
                </div>
              </div>
              {/* Right stat: 완전 확보 */}
              <div className="flex-1 rounded border border-border bg-card p-3 flex items-center gap-3">
                <div className="text-2xl font-bold" style={{ color: '#00809E' }}>{fullySecuredPct}%</div>
                <div>
                  <div className="text-[11px] text-foreground font-medium">{statLabels.rightTitle}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {totalContracts}개 법인 중{' '}
                    <button onClick={() => setStatFilter(statFilter === 'secured' ? null : 'secured')}
                      className={`font-medium cursor-pointer hover:underline ${statFilter === 'secured' ? 'text-primary underline' : 'text-foreground'}`}>
                      {fullySecuredCount}개 {statLabels.doneWord}
                    </button>
                    {', '}
                    <button onClick={() => setStatFilter(statFilter === 'not-secured' ? null : 'not-secured')}
                      className={`font-medium cursor-pointer hover:underline ${statFilter === 'not-secured' ? 'text-primary underline' : 'text-foreground'}`}>
                      {totalContracts - fullySecuredCount}개 {statLabels.notDoneWord}
                    </button>
                  </div>
                </div>
                <div className="ml-auto w-24 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${fullySecuredPct}%`, backgroundColor: '#00809E' }} />
                </div>
              </div>
              {/* Edit button */}
              <button onClick={() => { setEditingStatLabels(true); setStatLabelDraft(statLabels); }}
                className="self-start text-[9px] text-muted-foreground hover:text-foreground px-1 py-1 shrink-0">✎</button>
            </div>
          )}
          {/* Active stat filter indicator */}
          {statFilter && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground">필터 적용 중:</span>
              <span className="text-primary font-medium">
                {statFilter === 'started' && `${statLabels.doneWord} ${startedCount}개 법인`}
                {statFilter === 'not-started' && `${statLabels.notDoneWord} ${totalContracts - startedCount}개 법인`}
                {statFilter === 'secured' && `완전 확보 ${fullySecuredCount}개 법인`}
                {statFilter === 'not-secured' && `미비 ${totalContracts - fullySecuredCount}개 법인`}
              </span>
              <button onClick={() => setStatFilter(null)} className="text-muted-foreground hover:text-foreground">✕ 해제</button>
            </div>
          )}
        </div>
      )}

      {/* AI Search */}
      <div className="flex gap-2 items-start">
        <div className="flex-1 relative">
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="계약 데이터 검색 (예: 'A데이터 이전 가능한 법인은?', '유럽 지역 계약 현황')"
            className="bg-background border-border text-xs h-9 pl-8" />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs">🔍</span>
        </div>
        <Button onClick={handleSearch} disabled={searchLoading}
          className="bg-primary/20 text-primary border border-primary/30 text-[10px] h-9 px-4 shrink-0">
          {searchLoading ? '검색중...' : 'AI SEARCH'}
        </Button>
      </div>
      {searchResult && (
        <div className="p-3 bg-muted/10 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-primary tracking-widest font-bold">SEARCH RESULT</span>
            <button onClick={() => useContractStore.setState({ searchResult: null })} className="text-[9px] text-muted-foreground hover:text-foreground">CLOSE</button>
          </div>
          <div className="markdown-preview text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{searchResult}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Checkbox Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] text-muted-foreground tracking-widest">FILTERS:</span>
        <CheckboxFilter label="리전" options={regions} selected={filterRegions} onChange={setFilterRegions} />
        <CheckboxFilter label="국가" options={countries} selected={filterCountries} onChange={setFilterCountries} />
        <CheckboxFilter label="브랜드" options={brands} selected={filterBrands} onChange={setFilterBrands} />
        <span className="w-px h-4 bg-border" />
        <DomainFilter label="차량" selected={filterVehicle} onChange={setFilterVehicle} />
        <DomainFilter label="고객" selected={filterCustomer} onChange={setFilterCustomer} />
        <DomainFilter label="판매" selected={filterSales} onChange={setFilterSales} />
        <DomainFilter label="품질" selected={filterQuality} onChange={setFilterQuality} />
        <DomainFilter label="생산" selected={filterProduction} onChange={setFilterProduction} />
        <span className="w-px h-4 bg-border" />
        <span className="text-[10px] text-muted-foreground">{displayContracts.length}/{contracts.length}</span>
        {hasActiveFilters && (
          <button onClick={clearAllFilters} className="text-[9px] text-primary hover:underline">CLEAR</button>
        )}
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="text-center py-12 text-primary text-xs tracking-widest animate-pulse">LOADING CONTRACT DATA...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground text-xs tracking-wider">NO CONTRACT DATA</p>
          <p className="text-[10px] text-muted-foreground mt-1">CSV/Excel 파일을 Import하거나 수동으로 추가하세요</p>
        </div>
      ) : (
        <ColumnResizeProvider>
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] table-fixed" style={{ minWidth: '1200px' }}>
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <ResizableTh colName="region" className={`${thBase} sticky left-0 bg-muted/30 z-10`} minWidth={80}>리전</ResizableTh>
                  <ResizableTh colName="country" className={thBase} minWidth={70}>국가</ResizableTh>
                  <ResizableTh colName="entity_code" className={thBase} minWidth={50}>법인명</ResizableTh>
                  <ResizableTh colName="brand" className={thBase} minWidth={40}>브랜드</ResizableTh>
                  <ResizableTh colName="entity_name" className={thBase} minWidth={70}>법인명상세</ResizableTh>
                  <ResizableTh colName="vehicle" className={`${thBase} text-center border-l border-border`} minWidth={40}>차량</ResizableTh>
                  <ResizableTh colName="customer" className={`${thBase} text-center`} minWidth={40}>고객</ResizableTh>
                  <ResizableTh colName="sales" className={`${thBase} text-center`} minWidth={40}>판매</ResizableTh>
                  <ResizableTh colName="quality" className={`${thBase} text-center`} minWidth={40}>품질</ResizableTh>
                  <ResizableTh colName="production" className={`${thBase} text-center`} minWidth={40}>생산</ResizableTh>
                  <ResizableTh colName="contract_date" className={`${thBase} text-center border-l border-border`} minWidth={60}>계약체결일</ResizableTh>
                  <ResizableTh colName="final_contract" className={`${thBase} text-center border-l border-border`} minWidth={60}>최종계약서</ResizableTh>
                  <ResizableTh colName="related_doc" className={`${thBase} text-center`} minWidth={60}>관련문서</ResizableTh>
                  <ResizableTh colName="correspondence" className={`${thBase} text-center`} minWidth={60}>교신내역</ResizableTh>
                  <ResizableTh colName="transfer_purpose" className={`${thBase} border-l border-border`} minWidth={80}>이전목적 (전문)</ResizableTh>
                  <ResizableTh colName="transferable_data" className={thBase} minWidth={80}>이전데이터 (전문)</ResizableTh>
                  <th className={`${thBase} text-center`} style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([region, regionContracts]) => {
                  // Count total rows including expanded versions for rowSpan
                  let regionRowCount = regionContracts.length;
                  regionContracts.forEach(c => {
                    if (expandedRows.has(c.id)) {
                      regionRowCount += (versions[c.id]?.length || 0) + 1; // +1 for add button row
                    }
                  });

                  let regionRowRendered = 0;
                  return regionContracts.map((contract, idx) => {
                    const isExpanded = expandedRows.has(contract.id);
                    const contractVersions = versions[contract.id] || [];
                    const active = isRecentlyActive(contract);
                    const rows = [];

                    // Main row
                    rows.push(
                      <tr key={contract.id}
                        className={`border-b hover:bg-muted/10 transition-colors cursor-pointer ${active ? 'relative' : ''}`}
                        style={{ borderColor: hasPendingVersion(contract.id) ? '#00AAD2' : undefined, borderStyle: hasPendingVersion(contract.id) ? 'dashed' : undefined }}
                        onClick={() => toggleRowExpand(contract.id)}>
                        {idx === 0 ? (
                          <td className="px-2 py-2 text-foreground font-medium sticky left-0 bg-card z-10 text-[11px]" rowSpan={regionRowCount}>
                            {region}
                          </td>
                        ) : null}
                        <td className="px-2 py-2 text-foreground text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {/* Activity indicator — 6 month bar */}
                            {active && <div className="w-[3px] h-4 rounded-full bg-primary shrink-0" title="최근 6개월 이내 작업" />}
                            {/* Expand arrow */}
                            <span className="text-[9px] text-muted-foreground shrink-0">{isExpanded ? '▾' : '▸'}</span>
                            {contract.country}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-primary font-medium text-[11px]">{contract.entity_code}</td>
                        <td className="px-2 py-2 text-foreground text-[11px]">{contract.brand}</td>
                        <td className="px-2 py-2 text-foreground text-[11px]">{contract.entity_name}</td>
                        {(() => { const pd = getPendingDomains(contract.id); return (<>
                        <DomainCell value={contract.data_domain_vehicle} contractId={contract.id} field="data_domain_vehicle" onUpdate={updateContract} pending={pd.has('vehicle')} />
                        <DomainCell value={contract.data_domain_customer} contractId={contract.id} field="data_domain_customer" onUpdate={updateContract} pending={pd.has('customer')} />
                        <DomainCell value={contract.data_domain_sales} contractId={contract.id} field="data_domain_sales" onUpdate={updateContract} pending={pd.has('sales')} />
                        <DomainCell value={contract.data_domain_quality} contractId={contract.id} field="data_domain_quality" onUpdate={updateContract} pending={pd.has('quality')} />
                        <DomainCell value={contract.data_domain_production} contractId={contract.id} field="data_domain_production" onUpdate={updateContract} pending={pd.has('production')} />
                        </>); })()}
                        <td className="px-2 py-2 text-center text-foreground text-[10px] border-l border-border">
                          {contract.contract_status || <span className="text-muted-foreground">—</span>}
                        </td>
                        {(() => {
                          // Collect files from completed versions
                          const completedVers = (versions[contract.id] || []).filter(v => v.status === 'completed');
                          const completedVerFiles = completedVers.flatMap(v => (v.files || []).map(f => ({ file: f, versionNumber: v.version_number })));
                          return (<>
                            <FileCell files={contract.files || []} contractId={contract.id} category="final_contract" categoryLabel="계약서" completedVersionFiles={completedVerFiles} />
                            <FileCell files={contract.files || []} contractId={contract.id} category="related_document" categoryLabel="문서" completedVersionFiles={completedVerFiles} />
                            <FileCell files={contract.files || []} contractId={contract.id} category="correspondence" categoryLabel="교신" completedVersionFiles={completedVerFiles} />
                          </>);
                        })()}
                        <TransferInfoCell contract={contract} field="transfer_purpose" label="이전목적 전문 (계약서 원문)" />
                        <TransferInfoCell contract={contract} field="transferable_data" label="이전데이터 전문 (계약서 원문)" />
                        <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {deleteConfirm === contract.id ? (
                            <button onClick={() => { deleteContract(contract.id); setDeleteConfirm(null); }}
                              className="text-[9px] text-destructive">?</button>
                          ) : (
                            <button onClick={() => { setDeleteConfirm(contract.id); setTimeout(() => setDeleteConfirm(null), 3000); }}
                              className="text-[9px] text-muted-foreground hover:text-destructive">✕</button>
                          )}
                        </td>
                      </tr>
                    );

                    // Version rows (if expanded)
                    if (isExpanded) {
                      contractVersions.forEach(ver => {
                        const verDomains: string[] = ver.added_domains ? (typeof ver.added_domains === 'string' ? JSON.parse(ver.added_domains) : ver.added_domains) : [];
                        const isPending = ver.status === 'pending';
                        const isVerSelected = expandedRows.has(`ver-${ver.id}`);
                        const isEditingVer = addingVersion === `edit-${ver.id}`;
                        const chipBg = 'rgba(0,44,95,0.05)';
                        const chipColor = '#3A3A3C';

                        // Comma-joined domain label
                        const domainLabel = verDomains.map(d => DOMAIN_FIELDS.find(f => f.key === d)?.label || d).join(', ');

                        rows.push(
                          <tr key={`ver-${ver.id}`}
                            className={`border-b border-border cursor-pointer hover:bg-muted/10 transition-colors ${isVerSelected ? 'bg-muted/10' : 'bg-muted/5'}`}
                            style={isPending ? { borderLeft: '3px solid #00AAD2' } : undefined}
                            onClick={(e) => { e.stopPropagation(); setExpandedRows(prev => { const n = new Set(prev); const k = `ver-${ver.id}`; n.has(k) ? n.delete(k) : n.add(k); return n; }); }}>
                            <td colSpan={17} className="px-2 py-3 text-[11px]">
                              <div className="pl-6 space-y-1">
                                {/* Row 1: badge + date + reason + chips + files — all one line */}
                                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium shrink-0 ${isPending ? 'border border-dashed' : 'bg-primary/10 text-primary'}`}
                                    style={isPending ? { borderColor: '#00AAD2', color: '#00AAD2' } : undefined}>
                                    v{ver.version_number}{isPending ? ' 진행중' : ''}
                                  </span>
                                  <span className="text-muted-foreground shrink-0">{ver.effective_date || ver.created_at?.split(' ')[0]}</span>
                                  {ver.change_reason && <span className="text-foreground/70 truncate max-w-[180px]">{ver.change_reason}</span>}
                                  {domainLabel && (
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <span className="text-[10px] text-muted-foreground">카테고리</span>
                                      <span className="px-2 py-0.5 rounded" style={{ backgroundColor: chipBg, color: chipColor }}>{domainLabel}</span>
                                    </span>
                                  )}
                                  {ver.transfer_purpose && (
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <span className="text-[10px] text-muted-foreground">목적</span>
                                      <span className="px-2 py-0.5 rounded" style={{ backgroundColor: chipBg, color: chipColor }}>{ver.transfer_purpose}</span>
                                    </span>
                                  )}
                                  {ver.transferable_data && (
                                    <span className="inline-flex items-center gap-1 shrink-0">
                                      <span className="text-[10px] text-muted-foreground">데이터</span>
                                      <span className="px-2 py-0.5 rounded" style={{ backgroundColor: chipBg, color: chipColor }}>{ver.transferable_data}</span>
                                    </span>
                                  )}
                                  {ver.files && ver.files.length > 0 && ver.files.map(f => (
                                    <a key={f.id} href={`/api/contracts/files/${f.id}`} download={f.file_name}
                                      className="hover:opacity-70 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <FileIcon fileName={f.file_name} />
                                    </a>
                                  ))}
                                  <label className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer transition-colors shrink-0" onClick={(e) => e.stopPropagation()}>
                                    + 파일
                                    <input type="file" className="hidden" onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const fd = new FormData();
                                      fd.append('file', file);
                                      fd.append('category', 'final_contract');
                                      fd.append('version_id', ver.id);
                                      await fetch(`/api/contracts/${contract.id}/files`, { method: 'POST', body: fd });
                                      fetchVersions(contract.id);
                                      e.target.value = '';
                                    }} />
                                  </label>
                                </div>

                                {/* Row 2: actions — right-aligned */}
                                {!isEditingVer && (
                                  <div className="flex items-center gap-0 justify-end" onClick={(e) => e.stopPropagation()}>
                                    {isPending && (<>
                                      <button onClick={() => {
                                        if (confirm('이 버전을 확정하시겠습니까? 확정 후 해당 도메인이 O로 갱신됩니다.')) {
                                          updateVersion(contract.id, ver.id, { status: 'completed' });
                                        }
                                      }}
                                        className="text-[10px] text-primary font-medium hover:underline px-1.5 py-0.5">확정</button>
                                      <span className="text-[10px] text-muted-foreground/30 px-0.5">|</span>
                                    </>)}
                                    <button onClick={() => {
                                      setAddingVersion(`edit-${ver.id}`);
                                      setVersionForm({ change_reason: ver.change_reason || '', transfer_purpose: ver.transfer_purpose || '', transferable_data: ver.transferable_data || '', effective_date: ver.effective_date || '', added_domains: verDomains });
                                    }}
                                      className="text-[10px] text-muted-foreground hover:text-foreground hover:underline px-1.5 py-0.5">수정</button>
                                    <span className="text-[10px] text-muted-foreground/30 px-0.5">|</span>
                                    <button onClick={() => {
                                      if (confirm('이 버전을 삭제하시겠습니까?') && confirm('삭제된 데이터는 복구할 수 없습니다. 정말 삭제하시겠습니까?')) {
                                        fetch(`/api/contracts/${contract.id}/versions?version_id=${ver.id}`, { method: 'DELETE' }).then(() => { fetchVersions(contract.id); fetchContracts(); });
                                      }
                                    }}
                                      className="text-[10px] text-muted-foreground hover:text-destructive hover:underline px-1.5 py-0.5">삭제</button>
                                  </div>
                                )}

                                {/* Inline edit form — appears below content when editing */}
                                {isEditingVer && (
                                  <div className="pt-2 mt-2 border-t border-border space-y-2 max-w-xl" onClick={(e) => e.stopPropagation()}>
                                    <div className="grid grid-cols-2 gap-2">
                                      <input value={versionForm.change_reason} onChange={(e) => setVersionForm({ ...versionForm, change_reason: e.target.value })}
                                        placeholder="변경 사유" className="bg-background border border-border rounded px-2 py-1.5 text-[11px] text-foreground" />
                                      <input value={versionForm.effective_date} onChange={(e) => setVersionForm({ ...versionForm, effective_date: e.target.value })}
                                        placeholder="시행일 (YYYY-MM-DD)" className="bg-background border border-border rounded px-2 py-1.5 text-[11px] text-foreground" />
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <span className="text-[10px] text-muted-foreground">추가 카테고리</span>
                                      {[...DOMAIN_FIELDS, { key: 'etc', label: '기타', field: '' }].map(d => (
                                        <label key={d.key} className="flex items-center gap-1 cursor-pointer">
                                          <input type="checkbox" checked={versionForm.added_domains.includes(d.key)}
                                            onChange={(e) => setVersionForm({ ...versionForm, added_domains: e.target.checked ? [...versionForm.added_domains, d.key] : versionForm.added_domains.filter(x => x !== d.key) })}
                                            className="w-3 h-3 rounded accent-primary" />
                                          <span className="text-[11px]">{d.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                    <input value={versionForm.transfer_purpose} onChange={(e) => setVersionForm({ ...versionForm, transfer_purpose: e.target.value })}
                                      placeholder="이전목적 요약" className="w-full bg-background border border-border rounded px-2 py-1.5 text-[11px] text-foreground" />
                                    <input value={versionForm.transferable_data} onChange={(e) => setVersionForm({ ...versionForm, transferable_data: e.target.value })}
                                      placeholder="이전데이터 요약" className="w-full bg-background border border-border rounded px-2 py-1.5 text-[11px] text-foreground" />
                                    <div className="flex gap-2">
                                      <button onClick={async () => {
                                        await fetch(`/api/contracts/${contract.id}/versions`, {
                                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ version_id: ver.id, ...versionForm, added_domains: versionForm.added_domains }),
                                        });
                                        fetchVersions(contract.id); fetchContracts();
                                        setAddingVersion(null);
                                        setVersionForm({ change_reason: '', transfer_purpose: '', transferable_data: '', effective_date: '', added_domains: [] });
                                      }}
                                        className="text-[11px] px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 font-medium">저장</button>
                                      <button onClick={() => setAddingVersion(null)}
                                        className="text-[11px] px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-muted/30 font-medium">취소</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });

                      // Add version button row
                      rows.push(
                        <tr key={`add-ver-${contract.id}`} className="border-b border-border bg-muted/5">
                          <td colSpan={17} className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                            {addingVersion === contract.id ? (
                              <div className="pl-6 py-2 space-y-2 max-w-xl">
                                <div className="grid grid-cols-2 gap-2">
                                  <input value={versionForm.change_reason} onChange={(e) => setVersionForm({ ...versionForm, change_reason: e.target.value })}
                                    placeholder="변경 사유" className="bg-background border border-border rounded px-2 py-1 text-[10px] text-foreground" />
                                  <input value={versionForm.effective_date} onChange={(e) => setVersionForm({ ...versionForm, effective_date: e.target.value })}
                                    placeholder="시행일 (YYYY-MM-DD)" className="bg-background border border-border rounded px-2 py-1 text-[10px] text-foreground" />
                                </div>
                                {/* Domain checkboxes */}
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] text-muted-foreground">추가 데이터:</span>
                                  {[...DOMAIN_FIELDS, { key: 'etc', label: '기타', field: '' }].map(d => (
                                    <label key={d.key} className="flex items-center gap-1 cursor-pointer">
                                      <input type="checkbox" checked={versionForm.added_domains.includes(d.key)}
                                        onChange={(e) => {
                                          const next = e.target.checked
                                            ? [...versionForm.added_domains, d.key]
                                            : versionForm.added_domains.filter(x => x !== d.key);
                                          setVersionForm({ ...versionForm, added_domains: next });
                                        }}
                                        className="w-3 h-3 rounded border-border accent-primary" />
                                      <span className="text-[10px] text-foreground">{d.label}</span>
                                    </label>
                                  ))}
                                </div>
                                <input value={versionForm.transfer_purpose} onChange={(e) => setVersionForm({ ...versionForm, transfer_purpose: e.target.value })}
                                  placeholder="이전목적 요약 (예: 고객 마케팅 분석)" className="w-full bg-background border border-border rounded px-2 py-1 text-[10px] text-foreground" />
                                <input value={versionForm.transferable_data} onChange={(e) => setVersionForm({ ...versionForm, transferable_data: e.target.value })}
                                  placeholder="이전데이터 요약 (예: 고객명, 연락처, 구매이력)" className="w-full bg-background border border-border rounded px-2 py-1 text-[10px] text-foreground" />
                                <div className="flex gap-1">
                                  <Button onClick={() => handleCreateVersion(contract.id)} className="text-[10px] h-6 px-2 bg-primary/20 text-primary border border-primary/30">저장</Button>
                                  <Button onClick={() => setAddingVersion(null)} variant="ghost" className="text-[10px] h-6 px-2 text-muted-foreground">취소</Button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setAddingVersion(contract.id)}
                                className="pl-6 text-[9px] text-muted-foreground hover:text-primary transition-colors py-1">
                                + 수정계약 추가
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    return rows;
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
        </ColumnResizeProvider>
      )}

      <NewContractDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
