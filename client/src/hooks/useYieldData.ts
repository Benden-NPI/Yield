import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { YieldRecord, FilterState } from '../types/yield';

const STORAGE_KEY = 'yield_records';

type StoredRecord = Partial<YieldRecord> & {
  leakage?: number | null;
  flatness?: number | null;
  pressureDrop?: number | null;
  ttv?: number | null;
};

function toNonNegativeInteger(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

export function computeYieldFromLoss(input: number, loss: number): number | null {
  if (!Number.isFinite(input) || input <= 0) return null;
  const boundedLoss = Math.min(Math.max(loss, 0), input);
  const yieldRate = ((input - boundedLoss) / input) * 100;
  return Math.round(yieldRate * 100) / 100;
}

function legacyPercentToLoss(input: number, percent: number | null | undefined): number {
  if (!Number.isFinite(input) || input <= 0) return 0;
  if (percent == null || !Number.isFinite(percent)) return 0;
  const loss = input * (1 - percent / 100);
  return toNonNegativeInteger(Math.max(loss, 0));
}

function normalizeRecord(raw: StoredRecord): YieldRecord {
  const input = toNonNegativeInteger(raw.input);
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : uuidv4(),
    month: String(raw.month || ''),
    pn: String(raw.pn || ''),
    input,
    leakageLoss: raw.leakageLoss != null
      ? toNonNegativeInteger(raw.leakageLoss)
      : legacyPercentToLoss(input, raw.leakage),
    flatnessLoss: raw.flatnessLoss != null
      ? toNonNegativeInteger(raw.flatnessLoss)
      : legacyPercentToLoss(input, raw.flatness),
    pressureDropLoss: raw.pressureDropLoss != null
      ? toNonNegativeInteger(raw.pressureDropLoss)
      : legacyPercentToLoss(input, raw.pressureDrop),
    ttvLoss: raw.ttvLoss != null
      ? toNonNegativeInteger(raw.ttvLoss)
      : legacyPercentToLoss(input, raw.ttv),
  };
}

function loadFromStorage(): YieldRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeRecord(item as StoredRecord));
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
    const newRecord: YieldRecord = normalizeRecord({ id: uuidv4(), ...record });
    const records = [...get().records, newRecord];
    saveToStorage(records);
    set({ records });
  },

  updateRecord: (id, updates) => {
    const records = get().records.map((r) =>
      r.id === id ? normalizeRecord({ ...r, ...updates, id }) : r
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
