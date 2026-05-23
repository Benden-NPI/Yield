import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { YieldRecord, FilterState } from '../types/yield';

const STORAGE_KEY = 'yield_records';

function loadFromStorage(): YieldRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(records: YieldRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

interface YieldStore {
  records: YieldRecord[];
  filter: FilterState;
  addRecord: (record: Omit<YieldRecord, 'id'>) => void;
  updateRecord: (id: string, updates: Partial<Omit<YieldRecord, 'id'>>) => void;
  deleteRecord: (id: string) => void;
  setFilter: (filter: FilterState) => void;
  clearFilter: () => void;
  filteredRecords: () => YieldRecord[];
}

export const useYieldStore = create<YieldStore>((set, get) => ({
  records: loadFromStorage(),
  filter: { months: [], pns: [] },

  addRecord: (record) => {
    const newRecord: YieldRecord = { id: uuidv4(), ...record };
    const records = [...get().records, newRecord];
    saveToStorage(records);
    set({ records });
  },

  updateRecord: (id, updates) => {
    const records = get().records.map((r) =>
      r.id === id ? { ...r, ...updates } : r
    );
    saveToStorage(records);
    set({ records });
  },

  deleteRecord: (id) => {
    const records = get().records.filter((r) => r.id !== id);
    saveToStorage(records);
    set({ records });
  },

  setFilter: (filter) => set({ filter }),

  clearFilter: () => set({ filter: { months: [], pns: [] } }),

  filteredRecords: () => {
    const { records, filter } = get();
    return records.filter((r) => {
      const monthOk = filter.months.length === 0 || filter.months.includes(r.month);
      const pnOk = filter.pns.length === 0 || filter.pns.includes(r.pn);
      return monthOk && pnOk;
    });
  },
}));
