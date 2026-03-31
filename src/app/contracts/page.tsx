'use client';

import { useEffect, useState, useRef } from 'react';
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
      <td className="px-3 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">O</span>
      </td>
    );
  }
  if (value === 'X') {
    return (
      <td className="px-3 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">X</span>
      </td>
    );
  }
  return (
    <td className="px-3 py-2 text-center cursor-pointer hover:bg-primary/10 transition-colors" onClick={cycle}>
      <span className="text-[10px] text-muted-foreground">데이터없음</span>
    </td>
  );
}

/* ─── File Upload Cell ─── */
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
      <div className="space-y-1">
        {categoryFiles.map(f => (
          <div key={f.id} className="flex items-center gap-1 text-[10px]">
            <a href={`/api/contracts/files/${f.id}`} download={f.file_name}
              className="text-primary hover:underline truncate max-w-[80px]" title={f.file_name}>
              📎 {f.file_name}
            </a>
            <button onClick={() => deleteFile(f.id)} className="text-muted-foreground hover:text-destructive">✕</button>
          </div>
        ))}
        <label className="inline-flex items-center text-[9px] text-muted-foreground hover:text-primary cursor-pointer">
          + {categoryLabel}
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
  const { updateContract } = useContractStore();

  const value = contract[field];

  const handleSave = async () => {
    await updateContract(contract.id, { [field]: editValue });
    setEditing(false);
  };

  return (
    <td className="px-2 py-2 relative"
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => { if (!editing) setShowPopup(false); }}>
      <div className="text-[10px] text-foreground truncate max-w-[100px] cursor-pointer">
        {value ? value.substring(0, 20) + (value.length > 20 ? '...' : '') : <span className="text-muted-foreground">미설정</span>}
      </div>
      {showPopup && (
        <div className="absolute z-50 bottom-full left-0 mb-1 w-72 p-3 bg-card border border-border rounded-lg shadow-xl"
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
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const filtered = contracts.filter(c => {
    if (filterRegion !== 'all' && c.region !== filterRegion) return false;
    if (filterBrand !== 'all' && c.brand !== filterBrand) return false;
    return true;
  });

  const regions = [...new Set(contracts.map(c => c.region))];
  const brands = [...new Set(contracts.map(c => c.brand))];

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
              📥 IMPORT CSV/EXCEL
            </span>
          </label>
          <Button onClick={() => setNewOpen(true)} className="bg-primary/20 text-primary border border-primary/30 text-[10px] tracking-wider h-8">
            + NEW ENTITY
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">REGION:</span>
          <Select value={filterRegion} onValueChange={(v) => setFilterRegion(v || 'all')}>
            <SelectTrigger className="h-7 text-[10px] bg-background border-border w-36"><SelectValue /></SelectTrigger>
            <SelectContent className="glass border-border">
              <SelectItem value="all" className="text-[10px]">ALL</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r} className="text-[10px]">{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">BRAND:</span>
          <Select value={filterBrand} onValueChange={(v) => setFilterBrand(v || 'all')}>
            <SelectTrigger className="h-7 text-[10px] bg-background border-border w-24"><SelectValue /></SelectTrigger>
            <SelectContent className="glass border-border">
              <SelectItem value="all" className="text-[10px]">ALL</SelectItem>
              {brands.map(b => <SelectItem key={b} value={b} className="text-[10px]">{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className="text-[10px] text-muted-foreground ml-2">{filtered.length} entities</span>
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
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  {/* 기본 */}
                  <th className="px-3 py-2.5 text-left text-[10px] text-muted-foreground tracking-wider font-medium sticky left-0 bg-muted/30 z-10">리전</th>
                  <th className="px-3 py-2.5 text-left text-[10px] text-muted-foreground tracking-wider font-medium">국가</th>
                  <th className="px-3 py-2.5 text-left text-[10px] text-muted-foreground tracking-wider font-medium">법인명</th>
                  <th className="px-3 py-2.5 text-left text-[10px] text-muted-foreground tracking-wider font-medium">브랜드</th>
                  <th className="px-3 py-2.5 text-left text-[10px] text-muted-foreground tracking-wider font-medium">법인명상세</th>
                  {/* 데이터 도메인 */}
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium border-l border-border">차량</th>
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium">고객</th>
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium">판매</th>
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium">품질</th>
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium">생산</th>
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium border-l border-border">계약체결일</th>
                  {/* 기본 정보 */}
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium border-l border-border">최종계약서</th>
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium">관련문서</th>
                  <th className="px-2 py-2.5 text-center text-[9px] text-muted-foreground tracking-wider font-medium">교신내역</th>
                  {/* 실무 정보 */}
                  <th className="px-2 py-2.5 text-left text-[9px] text-muted-foreground tracking-wider font-medium border-l border-border">이전가능 목적</th>
                  <th className="px-2 py-2.5 text-left text-[9px] text-muted-foreground tracking-wider font-medium">이전가능 데이터</th>
                  {/* 삭제 */}
                  <th className="px-2 py-2.5 text-center text-[10px] text-muted-foreground tracking-wider font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([region, regionContracts]) => (
                  regionContracts.map((contract, idx) => (
                    <tr key={contract.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                      {/* Show region only on first row of group */}
                      {idx === 0 ? (
                        <td className="px-3 py-2 text-foreground font-medium sticky left-0 bg-card z-10" rowSpan={regionContracts.length}>
                          {region}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-foreground">{contract.country}</td>
                      <td className="px-3 py-2 text-primary font-medium">{contract.entity_code}</td>
                      <td className="px-3 py-2 text-foreground">{contract.brand}</td>
                      <td className="px-3 py-2 text-foreground">{contract.entity_name}</td>
                      {/* 데이터 도메인 */}
                      <DomainCell value={contract.data_domain_vehicle} contractId={contract.id} field="data_domain_vehicle" onUpdate={updateContract} />
                      <DomainCell value={contract.data_domain_customer} contractId={contract.id} field="data_domain_customer" onUpdate={updateContract} />
                      <DomainCell value={contract.data_domain_sales} contractId={contract.id} field="data_domain_sales" onUpdate={updateContract} />
                      <DomainCell value={contract.data_domain_quality} contractId={contract.id} field="data_domain_quality" onUpdate={updateContract} />
                      <DomainCell value={contract.data_domain_production} contractId={contract.id} field="data_domain_production" onUpdate={updateContract} />
                      <td className="px-2 py-2 text-center text-foreground text-[10px] border-l border-border">
                        {contract.contract_status || <span className="text-muted-foreground">—</span>}
                      </td>
                      {/* 기본 정보 */}
                      <FileCell files={contract.files || []} contractId={contract.id} category="final_contract" categoryLabel="계약서" />
                      <FileCell files={contract.files || []} contractId={contract.id} category="related_document" categoryLabel="문서" />
                      <FileCell files={contract.files || []} contractId={contract.id} category="correspondence" categoryLabel="교신" />
                      {/* 실무 정보 */}
                      <TransferInfoCell contract={contract} field="transfer_purpose" label="이전가능 목적" />
                      <TransferInfoCell contract={contract} field="transferable_data" label="이전가능 데이터" />

                      <td className="px-2 py-2 text-center">
                        {deleteConfirm === contract.id ? (
                          <button onClick={() => { deleteContract(contract.id); setDeleteConfirm(null); }}
                            className="text-[9px] text-destructive">CONFIRM?</button>
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
      )}

      {/* AI Natural Language Search */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="text-[10px] text-primary tracking-widest font-bold mb-2">AI CONTRACT SEARCH</div>
        <div className="flex gap-2">
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="자연어로 질문하세요 (예: 'A데이터를 이전가능한 법인?')"
            className="bg-background border-border text-xs flex-1" />
          <Button onClick={handleSearch} disabled={searchLoading}
            className="bg-primary/20 text-primary border border-primary/30 text-[10px] h-9 px-4">
            {searchLoading ? '검색중...' : 'SEARCH'}
          </Button>
        </div>
        {searchResult && (
          <div className="mt-3 p-3 bg-muted/20 rounded border border-border">
            <div className="markdown-preview text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{searchResult}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <NewContractDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
