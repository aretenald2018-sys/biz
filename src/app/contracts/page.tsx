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
import type { Contract, ContractFile, DataDomainValue, CreateContractInput } from '@/types/contract';

/* ─── File extension → icon with label ─── */
function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, { bg: string; text: string; label: string }> = {
    pdf:  { bg: '#E81F2C', text: '#FFFFFF', label: 'PDF' },
    doc:  { bg: '#002C5F', text: '#FFFFFF', label: 'DOC' },
    docx: { bg: '#002C5F', text: '#FFFFFF', label: 'DOCX' },
    xls:  { bg: '#1D7044', text: '#FFFFFF', label: 'XLS' },
    xlsx: { bg: '#1D7044', text: '#FFFFFF', label: 'XLSX' },
    csv:  { bg: '#1D7044', text: '#FFFFFF', label: 'CSV' },
    ppt:  { bg: '#D04423', text: '#FFFFFF', label: 'PPT' },
    pptx: { bg: '#D04423', text: '#FFFFFF', label: 'PPTX' },
    zip:  { bg: '#EC8E01', text: '#FFFFFF', label: 'ZIP' },
    rar:  { bg: '#EC8E01', text: '#FFFFFF', label: 'RAR' },
    jpg:  { bg: '#7B3FA0', text: '#FFFFFF', label: 'JPG' },
    jpeg: { bg: '#7B3FA0', text: '#FFFFFF', label: 'JPEG' },
    png:  { bg: '#7B3FA0', text: '#FFFFFF', label: 'PNG' },
    txt:  { bg: '#69696E', text: '#FFFFFF', label: 'TXT' },
    msg:  { bg: '#0672ED', text: '#FFFFFF', label: 'MSG' },
    eml:  { bg: '#0672ED', text: '#FFFFFF', label: 'EML' },
    hwp:  { bg: '#00AAD2', text: '#FFFFFF', label: 'HWP' },
    hwpx: { bg: '#00AAD2', text: '#FFFFFF', label: 'HWPX' },
  };
  const config = iconMap[ext] || { bg: '#929296', text: '#FFFFFF', label: ext.toUpperCase().slice(0, 4) || 'FILE' };
  return (
    <span className="inline-flex items-center justify-center rounded-sm text-[8px] font-bold leading-none shrink-0"
      style={{ backgroundColor: config.bg, color: config.text, width: '32px', height: '18px', letterSpacing: '0.02em' }}
      title={fileName}>
      {config.label}
    </span>
  );
}

/* ─── Data Domain Cell ─── */
function DomainCell({ value, contractId, field, onUpdate }: {
  value: DataDomainValue;
  contractId: string;
  field: string;
  onUpdate: (id: string, data: Record<string, string>) => void;
}) {
  const cycle = () => {
    const next: Record<DataDomainValue, DataDomainValue> = { 'O': 'X', 'X': 'null', 'null': 'O' };
    onUpdate(contractId, { [field]: next[value] });
  };

  if (value === 'O') {
    return (
      <td className="px-2 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
        <span className="text-xs font-bold text-foreground">O</span>
      </td>
    );
  }
  if (value === 'X') {
    return (
      <td className="px-2 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
        <span className="text-xs font-bold text-foreground">X</span>
      </td>
    );
  }
  return (
    <td className="px-2 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
      <span className="text-[10px] text-muted-foreground">데이터없음</span>
    </td>
  );
}

/* ─── File Upload Cell (icon-based) ─── */
function FileCell({ files, contractId, category, categoryLabel }: {
  files: ContractFile[];
  contractId: string;
  category: 'final_contract' | 'related_document' | 'correspondence';
  categoryLabel: string;
}) {
  const { uploadFile, deleteFile } = useContractStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const categoryFiles = files.filter(f => f.file_category === category);

  return (
    <td className="px-2 py-2">
      <div className="flex items-center gap-1 flex-wrap">
        {categoryFiles.map(f => (
          <div key={f.id} className="relative group inline-flex">
            <a href={`/api/contracts/files/${f.id}`} download={f.file_name}
              title={f.file_name} className="hover:opacity-70 transition-opacity">
              <FileIcon fileName={f.file_name} />
            </a>
            <button onClick={() => deleteFile(f.id)}
              className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3 h-3 rounded-full bg-destructive text-white text-[7px] leading-none">✕</button>
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
  applyResizeDelta: (delta: number) => void;
  registerCol: (name: string, setWidth: (w: number | undefined) => void, getWidth: () => number, minW: number) => void;
  savedWidths: Record<string, number>;
  persistWidth: (name: string, w: number) => void;
}>({
  selected: new Set(),
  toggleSelect: () => {},
  applyResizeDelta: () => {},
  registerCol: () => {},
  savedWidths: {},
  persistWidth: () => {},
});

function ColumnResizeProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const colsRef = useRef<Map<string, { setWidth: (w: number | undefined) => void; getWidth: () => number; minW: number }>>(new Map());
  const [savedWidths, setSavedWidths] = useState<Record<string, number>>({});

  useEffect(() => { setSavedWidths(loadSavedWidths()); }, []);

  const toggleSelect = useCallback((name: string, shift: boolean) => {
    setSelected(prev => {
      const next = new Set(shift ? prev : []);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

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

  const registerCol = useCallback((name: string, setWidth: (w: number | undefined) => void, getWidth: () => number, minW: number) => {
    colsRef.current.set(name, { setWidth, getWidth, minW });
  }, []);

  return (
    <ColumnResizeContext.Provider value={{ selected, toggleSelect, applyResizeDelta, registerCol, savedWidths, persistWidth }}>
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
  const { selected, toggleSelect, applyResizeDelta, registerCol, savedWidths, persistWidth } = React.useContext(ColumnResizeContext);
  const [width, setWidth] = useState<number | undefined>(savedWidths[colName] || undefined);
  const thRef = useRef<HTMLTableCellElement>(null);
  const startX = useRef(0);
  const startW = useRef(0);
  const isSelected = selected.has(colName);

  // Restore saved width on mount
  useEffect(() => {
    if (savedWidths[colName]) setWidth(savedWidths[colName]);
  }, [savedWidths, colName]);

  useEffect(() => {
    registerCol(colName, setWidth, () => thRef.current?.offsetWidth || 80, minWidth);
  }, [colName, minWidth, registerCol]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
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
      // Persist single column resize
      if (!resizeMultiple && thRef.current) {
        persistWidth(colName, thRef.current.offsetWidth);
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [minWidth, isSelected, selected.size, applyResizeDelta, colName, persistWidth]);

  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    // Only toggle select on direct header text click, not resize handle
    toggleSelect(colName, e.shiftKey);
  }, [colName, toggleSelect]);

  return (
    <th ref={thRef} className={`${className} cursor-pointer select-none`}
      style={width ? { width, minWidth } : undefined}
      onMouseDown={handleHeaderClick}>
      <div className="flex items-center justify-between gap-1">
        <span className={`truncate ${isSelected ? 'text-primary font-bold' : ''}`}>{children}</span>
        <div onMouseDown={onMouseDown}
          className={`w-1.5 h-full min-h-[16px] cursor-col-resize rounded flex-shrink-0 transition-colors ${
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
    contracts, loading, searchQuery, searchResult, searchLoading,
    fetchContracts, updateContract, deleteContract, importCSV,
    searchContracts, setSearchQuery,
  } = useContractStore();

  const [newOpen, setNewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Checkbox filters — empty Set means "all selected"
  const [filterRegions, setFilterRegions] = useState<Set<string>>(new Set());
  const [filterCountries, setFilterCountries] = useState<Set<string>>(new Set());
  const [filterBrands, setFilterBrands] = useState<Set<string>>(new Set());
  const [filterVehicle, setFilterVehicle] = useState<Set<string>>(new Set());
  const [filterCustomer, setFilterCustomer] = useState<Set<string>>(new Set());
  const [filterSales, setFilterSales] = useState<Set<string>>(new Set());
  const [filterQuality, setFilterQuality] = useState<Set<string>>(new Set());
  const [filterProduction, setFilterProduction] = useState<Set<string>>(new Set());

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

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

  const regions = [...new Set(contracts.map(c => c.region))].sort();
  const countries = [...new Set(contracts.map(c => c.country))].sort();
  const brands = [...new Set(contracts.map(c => c.brand))].sort();

  // Group by region for display
  const grouped: Record<string, Contract[]> = {};
  for (const c of filtered) {
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
        <span className="text-[10px] text-muted-foreground">{filtered.length}/{contracts.length}</span>
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
                  <ResizableTh colName="transfer_purpose" className={`${thBase} border-l border-border`} minWidth={80}>이전가능 목적</ResizableTh>
                  <ResizableTh colName="transferable_data" className={thBase} minWidth={80}>이전가능 데이터</ResizableTh>
                  <th className={`${thBase} text-center`} style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([region, regionContracts]) => (
                  regionContracts.map((contract, idx) => (
                    <tr key={contract.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                      {idx === 0 ? (
                        <td className="px-2 py-2 text-foreground font-medium sticky left-0 bg-card z-10 text-[11px]" rowSpan={regionContracts.length}>
                          {region}
                        </td>
                      ) : null}
                      <td className="px-2 py-2 text-foreground text-[11px]">{contract.country}</td>
                      <td className="px-2 py-2 text-primary font-medium text-[11px]">{contract.entity_code}</td>
                      <td className="px-2 py-2 text-foreground text-[11px]">{contract.brand}</td>
                      <td className="px-2 py-2 text-foreground text-[11px]">{contract.entity_name}</td>
                      <DomainCell value={contract.data_domain_vehicle} contractId={contract.id} field="data_domain_vehicle" onUpdate={updateContract} />
                      <DomainCell value={contract.data_domain_customer} contractId={contract.id} field="data_domain_customer" onUpdate={updateContract} />
                      <DomainCell value={contract.data_domain_sales} contractId={contract.id} field="data_domain_sales" onUpdate={updateContract} />
                      <DomainCell value={contract.data_domain_quality} contractId={contract.id} field="data_domain_quality" onUpdate={updateContract} />
                      <DomainCell value={contract.data_domain_production} contractId={contract.id} field="data_domain_production" onUpdate={updateContract} />
                      <td className="px-2 py-2 text-center text-foreground text-[10px] border-l border-border">
                        {contract.contract_status || <span className="text-muted-foreground">—</span>}
                      </td>
                      <FileCell files={contract.files || []} contractId={contract.id} category="final_contract" categoryLabel="계약서" />
                      <FileCell files={contract.files || []} contractId={contract.id} category="related_document" categoryLabel="문서" />
                      <FileCell files={contract.files || []} contractId={contract.id} category="correspondence" categoryLabel="교신" />
                      <TransferInfoCell contract={contract} field="transfer_purpose" label="이전가능 목적" />
                      <TransferInfoCell contract={contract} field="transferable_data" label="이전가능 데이터" />
                      <td className="px-1 py-2 text-center">
                        {deleteConfirm === contract.id ? (
                          <button onClick={() => { deleteContract(contract.id); setDeleteConfirm(null); }}
                            className="text-[9px] text-destructive">?</button>
                        ) : (
                          <button onClick={() => { setDeleteConfirm(contract.id); setTimeout(() => setDeleteConfirm(null), 3000); }}
                            className="text-[9px] text-muted-foreground hover:text-destructive">✕</button>
                        )}
                      </td>
                    </tr>
                  ))
                ))}
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
