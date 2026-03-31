import { create } from 'zustand';
import type { Contract, CreateContractInput, UpdateContractInput } from '@/types/contract';

interface ContractStore {
  contracts: Contract[];
  loading: boolean;
  searchQuery: string;
  searchResult: string | null;
  searchLoading: boolean;

  fetchContracts: () => Promise<void>;
  createContract: (input: CreateContractInput) => Promise<Contract>;
  updateContract: (id: string, input: UpdateContractInput) => Promise<void>;
  deleteContract: (id: string) => Promise<void>;
  uploadFile: (contractId: string, category: string, file: File) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  importCSV: (file: File) => Promise<void>;
  searchContracts: (query: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
}

export const useContractStore = create<ContractStore>((set, get) => ({
  contracts: [],
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
}));
