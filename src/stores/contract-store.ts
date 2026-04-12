import { create } from 'zustand';
import type { Contract, ContractVersion, CreateContractInput, UpdateContractInput } from '@/types/contract';

interface ContractStore {
  contracts: Contract[];
  versions: Record<string, ContractVersion[]>;
  loading: boolean;
  searchQuery: string;
  searchResult: string | null;
  searchLoading: boolean;

  fetchContracts: () => Promise<void>;
  createContract: (input: CreateContractInput) => Promise<Contract>;
  updateContract: (id: string, input: UpdateContractInput) => Promise<void>;
  deleteContract: (id: string) => Promise<void>;
  uploadFile: (contractId: string, category: string, file: File, versionId?: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  importCSV: (file: File) => Promise<void>;
  searchContracts: (query: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  fetchVersions: (contractId: string) => Promise<void>;
  fetchVersionsBatch: (contractIds: string[]) => Promise<void>;
  clearVersions: () => void;
  clearVersionsFor: (contractId: string) => void;
  createVersion: (contractId: string, data: { change_reason?: string; transfer_purpose?: string; transferable_data?: string; effective_date?: string; added_domains?: string[] }) => Promise<void>;
  updateVersion: (contractId: string, versionId: string, data: { status?: string; added_domains?: string[] }) => Promise<void>;
}

export const useContractStore = create<ContractStore>((set, get) => ({
  contracts: [],
  versions: {},
  loading: false,
  searchQuery: '',
  searchResult: null,
  searchLoading: false,

  fetchContracts: async () => {
    set({ loading: true });
    const res = await fetch('/api/contracts');
    const data = await res.json();
    set({ contracts: data.contracts || [], loading: false });
  },

  createContract: async (input: CreateContractInput) => {
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const contract = await res.json();
    await get().fetchContracts();
    return contract;
  },

  updateContract: async (id: string, input: UpdateContractInput) => {
    await fetch(`/api/contracts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await get().fetchContracts();
  },

  deleteContract: async (id: string) => {
    await fetch(`/api/contracts/${id}`, {
      method: 'DELETE',
    });
    await get().fetchContracts();
  },

  uploadFile: async (contractId: string, category: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    await fetch(`/api/contracts/${contractId}/files`, {
      method: 'POST',
      body: formData,
    });
    await get().fetchContracts();
  },

  deleteFile: async (fileId: string) => {
    await fetch(`/api/contracts/files/${fileId}`, {
      method: 'DELETE',
    });
    await get().fetchContracts();
  },

  importCSV: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    await fetch('/api/contracts/import', {
      method: 'POST',
      body: formData,
    });
    await get().fetchContracts();
  },

  searchContracts: async (query: string) => {
    set({ searchLoading: true, searchQuery: query });
    const res = await fetch('/api/contracts/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    set({ searchResult: data.result ?? data.answer ?? JSON.stringify(data), searchLoading: false });
  },

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
  },

  fetchVersions: async (contractId: string) => {
    const res = await fetch(`/api/contracts/${contractId}/versions`);
    if (res.ok) {
      const versions = await res.json();
      set({ versions: { ...get().versions, [contractId]: versions } });
    }
  },

  fetchVersionsBatch: async (contractIds) => {
    const uniqueContractIds = [...new Set(contractIds.filter(Boolean))];
    if (uniqueContractIds.length === 0) return;

    const params = new URLSearchParams();
    uniqueContractIds.forEach((contractId) => params.append('id', contractId));

    const res = await fetch(`/api/contracts/versions/batch?${params.toString()}`);
    if (!res.ok) return;

    const versions = await res.json() as Record<string, ContractVersion[]>;
    set({ versions: { ...get().versions, ...versions } });
  },

  clearVersions: () => {
    set({ versions: {} });
  },

  clearVersionsFor: (contractId) => {
    const nextVersions = { ...get().versions };
    delete nextVersions[contractId];
    set({ versions: nextVersions });
  },

  createVersion: async (contractId: string, data) => {
    await fetch(`/api/contracts/${contractId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await get().fetchVersions(contractId);
    await get().fetchContracts();
  },

  updateVersion: async (contractId: string, versionId: string, data) => {
    await fetch(`/api/contracts/${contractId}/versions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_id: versionId, ...data }),
    });
    await get().fetchVersions(contractId);
    await get().fetchContracts();
  },
}));
