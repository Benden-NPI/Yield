import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { YieldMetric } from '../types/yield';

const STORAGE_KEY = 'yield_capa_v1';

export type CapaStatus = 'open' | 'in_progress' | 'closed';

export interface CapaItem {
  id: string;
  createdAt: string;            // ISO timestamp
  source: 'manual' | 'alert';
  title: string;
  description?: string;
  pn?: string;
  defectMode?: YieldMetric;
  month?: string;
  owner?: string;
  dueDate?: string;             // yyyy-mm-dd
  status: CapaStatus;
  rootCause?: string;
  action?: string;
  verification?: string;
  closedAt?: string;
}

function normalize(raw: Partial<CapaItem>): CapaItem {
  const status: CapaStatus =
    raw.status === 'closed' || raw.status === 'in_progress' ? raw.status : 'open';
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : uuidv4(),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    source: raw.source === 'alert' ? 'alert' : 'manual',
    title: String(raw.title ?? '').trim() || 'Untitled CAPA',
    description: raw.description ? String(raw.description) : undefined,
    pn: raw.pn ? String(raw.pn) : undefined,
    defectMode: (raw.defectMode === 'leakage' || raw.defectMode === 'flatness'
      || raw.defectMode === 'pressureDrop' || raw.defectMode === 'ttv')
      ? raw.defectMode : undefined,
    month: raw.month ? String(raw.month) : undefined,
    owner: raw.owner ? String(raw.owner) : undefined,
    dueDate: raw.dueDate ? String(raw.dueDate) : undefined,
    status,
    rootCause: raw.rootCause ? String(raw.rootCause) : undefined,
    action: raw.action ? String(raw.action) : undefined,
    verification: raw.verification ? String(raw.verification) : undefined,
    closedAt: status === 'closed' ? (raw.closedAt ?? new Date().toISOString()) : undefined,
  };
}

function loadFromStorage(): CapaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => normalize(r as Partial<CapaItem>));
  } catch {
    return [];
  }
}

function saveToStorage(items: CapaItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

interface CapaStore {
  items: CapaItem[];
  add: (item: Omit<CapaItem, 'id' | 'createdAt'> & { createdAt?: string }) => CapaItem;
  update: (id: string, patch: Partial<Omit<CapaItem, 'id'>>) => void;
  remove: (id: string) => void;
  setStatus: (id: string, status: CapaStatus) => void;
}

export const useCapaStore = create<CapaStore>((set, get) => ({
  items: loadFromStorage(),
  add: (item) => {
    const newItem = normalize({ id: uuidv4(), createdAt: new Date().toISOString(), ...item });
    const items = [newItem, ...get().items];
    saveToStorage(items);
    set({ items });
    return newItem;
  },
  update: (id, patch) => {
    const items = get().items.map((i) => (i.id === id ? normalize({ ...i, ...patch, id }) : i));
    saveToStorage(items);
    set({ items });
  },
  remove: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    saveToStorage(items);
    set({ items });
  },
  setStatus: (id, status) => {
    const items = get().items.map((i) => (
      i.id === id
        ? normalize({ ...i, status, closedAt: status === 'closed' ? new Date().toISOString() : undefined })
        : i
    ));
    saveToStorage(items);
    set({ items });
  },
}));
