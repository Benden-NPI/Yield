import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Shift, YieldMetric } from '../types/yield';

const STORAGE_KEY = 'yield_measurements_v1';

// One measurement = one inspected part with continuous variable readings.
export interface MeasurementRecord {
  id: string;
  date: string;              // yyyy-mm-dd
  pn: string;
  machine?: string;
  operator?: string;
  woNo?: string;
  materialLot?: string;
  shift?: Shift;

  // Numeric readings — any may be null if not measured.
  leakage: number | null;        // ccm
  flatness: number | null;       // µm
  pressureDrop: number | null;   // kPa
  ttv: number | null;            // µm

  pass: boolean;
  failModes: YieldMetric[];
  note?: string;
}

function toNumOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalize(raw: Partial<MeasurementRecord>): MeasurementRecord {
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : uuidv4(),
    date: String(raw.date ?? ''),
    pn: String(raw.pn ?? ''),
    machine: raw.machine ? String(raw.machine) : undefined,
    operator: raw.operator ? String(raw.operator) : undefined,
    woNo: raw.woNo ? String(raw.woNo) : undefined,
    materialLot: raw.materialLot ? String(raw.materialLot) : undefined,
    shift: (raw.shift === 'A' || raw.shift === 'B' || raw.shift === 'C') ? raw.shift : undefined,
    leakage: toNumOrNull(raw.leakage),
    flatness: toNumOrNull(raw.flatness),
    pressureDrop: toNumOrNull(raw.pressureDrop),
    ttv: toNumOrNull(raw.ttv),
    pass: raw.pass === false ? false : true,
    failModes: Array.isArray(raw.failModes)
      ? (raw.failModes.filter((m) =>
          m === 'leakage' || m === 'flatness' || m === 'pressureDrop' || m === 'ttv',
        ) as YieldMetric[])
      : [],
    note: raw.note ? String(raw.note) : undefined,
  };
}

function loadFromStorage(): MeasurementRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => normalize(r as Partial<MeasurementRecord>));
  } catch {
    return [];
  }
}

function saveToStorage(rs: MeasurementRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rs));
  } catch {
    // ignore
  }
}

interface MeasurementStore {
  records: MeasurementRecord[];
  add: (r: Omit<MeasurementRecord, 'id'>) => void;
  update: (id: string, patch: Partial<Omit<MeasurementRecord, 'id'>>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useMeasurementStore = create<MeasurementStore>((set, get) => ({
  records: loadFromStorage(),
  add: (r) => {
    const newRec = normalize({ id: uuidv4(), ...r });
    const records = [...get().records, newRec];
    saveToStorage(records);
    set({ records });
  },
  update: (id, patch) => {
    const records = get().records.map((r) => (r.id === id ? normalize({ ...r, ...patch, id }) : r));
    saveToStorage(records);
    set({ records });
  },
  remove: (id) => {
    const records = get().records.filter((r) => r.id !== id);
    saveToStorage(records);
    set({ records });
  },
  clear: () => {
    saveToStorage([]);
    set({ records: [] });
  },
}));

export function valueOf(r: MeasurementRecord, metric: YieldMetric): number | null {
  switch (metric) {
    case 'leakage': return r.leakage;
    case 'flatness': return r.flatness;
    case 'pressureDrop': return r.pressureDrop;
    case 'ttv': return r.ttv;
  }
}
