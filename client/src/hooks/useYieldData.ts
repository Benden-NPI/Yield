import { useMemo } from 'react';
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { FilterState, Shift, YieldMetric, YieldRecord } from '../types/yield';
import { EMPTY_FILTER, MONTHS, METRIC_LOSS_FIELD, YIELD_METRICS } from '../types/yield';

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

export function computeDefectFailureRatio(input: number, loss: number): number | null {
  if (!Number.isFinite(input) || input <= 0) return null;
  const boundedLoss = Math.min(Math.max(loss, 0), input);
  return Math.round((boundedLoss / input) * 10000) / 100;
}

export function totalDefects(r: YieldRecord): number {
  return r.leakageLoss + r.flatnessLoss + r.pressureDropLoss + r.ttvLoss;
}

export function computeThroughYield(r: YieldRecord): number | null {
  if (!Number.isFinite(r.input) || r.input <= 0) return null;
  const total = Math.min(totalDefects(r), r.input);
  return Math.round(((r.input - total) / r.input) * 10000) / 100;
}

function legacyPercentToLoss(input: number, percent: number | null | undefined): number {
  if (!Number.isFinite(input) || input <= 0) return 0;
  if (percent == null || !Number.isFinite(percent)) return 0;
  const loss = input * (1 - percent / 100);
  return toNonNegativeInteger(Math.max(loss, 0));
}

function deriveMonthFromDate(date: string): string | null {
  // Expect yyyy-mm-dd. Returns English month name or null.
  if (!date || typeof date !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!m) return null;
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;
  return MONTHS[monthIdx];
}

function normalizeShift(s: unknown): Shift | undefined {
  return s === 'A' || s === 'B' || s === 'C' ? s : undefined;
}

function normalizeRecord(raw: StoredRecord): YieldRecord {
  const input = toNonNegativeInteger(raw.input);
  const date = raw.date ? String(raw.date) : undefined;
  const monthFromDate = date ? deriveMonthFromDate(date) : null;
  const month = monthFromDate ?? String(raw.month || '');

  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : uuidv4(),
    month,
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
    date,
    shift: normalizeShift(raw.shift),
    machine: raw.machine ? String(raw.machine) : undefined,
    operator: raw.operator ? String(raw.operator) : undefined,
    materialLot: raw.materialLot ? String(raw.materialLot) : undefined,
    woNo: raw.woNo ? String(raw.woNo) : undefined,
    reworkCount: raw.reworkCount != null ? toNonNegativeInteger(raw.reworkCount) : undefined,
    source: raw.source === 'sharepoint' ? 'sharepoint' : 'manual',
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
  lastUpdatedAt: number | null;
  addRecord: (record: Omit<YieldRecord, 'id'>) => void;
  updateRecord: (id: string, updates: Partial<Omit<YieldRecord, 'id'>>) => void;
  deleteRecord: (id: string) => void;
  replaceRecords: (records: Array<Partial<YieldRecord>>) => void;
  replaceSharePointRecords: (records: Array<Partial<YieldRecord>>) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  clearFilter: () => void;
  filteredRecords: () => YieldRecord[];
}

function bumpUpdatedAt(): number {
  return Date.now();
}

export const useYieldStore = create<YieldStore>((set, get) => {
  const initialRecords = loadFromStorage();
  return {
    records: initialRecords,
    filter: { ...EMPTY_FILTER },
    lastUpdatedAt: initialRecords.length > 0 ? bumpUpdatedAt() : null,

    addRecord: (record) => {
      const newRecord: YieldRecord = normalizeRecord({ id: uuidv4(), ...record });
      const records = [...get().records, newRecord];
      saveToStorage(records);
      set({ records, lastUpdatedAt: bumpUpdatedAt() });
    },

    updateRecord: (id, updates) => {
      const records = get().records.map((r) =>
        r.id === id ? normalizeRecord({ ...r, ...updates, id }) : r,
      );
      saveToStorage(records);
      set({ records, lastUpdatedAt: bumpUpdatedAt() });
    },

    deleteRecord: (id) => {
      const records = get().records.filter((r) => r.id !== id);
      saveToStorage(records);
      set({ records, lastUpdatedAt: bumpUpdatedAt() });
    },

    replaceRecords: (incoming) => {
      const records = incoming.map((r) => normalizeRecord(r as StoredRecord));
      saveToStorage(records);
      set({ records, lastUpdatedAt: bumpUpdatedAt() });
    },

    replaceSharePointRecords: (incoming) => {
      const spRecords = incoming.map((r) =>
        normalizeRecord({ ...(r as StoredRecord), source: 'sharepoint' }),
      );
      const manualRecords = get().records.filter((r) => r.source !== 'sharepoint');
      const records = [...manualRecords, ...spRecords];
      saveToStorage(records);
      set({ records, lastUpdatedAt: bumpUpdatedAt() });
    },

    setFilter: (patch) => set({ filter: { ...get().filter, ...patch } }),

    clearFilter: () => set({ filter: { ...EMPTY_FILTER } }),

    filteredRecords: () => filterRecords(get().records, get().filter),
  };
});

/**
 * Pure helper: apply a FilterState to a records array. Safe to call outside React.
 */
export function filterRecords(records: YieldRecord[], filter: FilterState): YieldRecord[] {
  return records.filter((r) => {
    if (filter.months.length > 0 && !filter.months.includes(r.month)) return false;
    if (filter.pns.length > 0 && !filter.pns.includes(r.pn)) return false;
    if (filter.shifts.length > 0 && (!r.shift || !filter.shifts.includes(r.shift))) return false;
    if (filter.machines.length > 0 && (!r.machine || !filter.machines.includes(r.machine))) return false;
    if (filter.materialLots.length > 0 && (!r.materialLot || !filter.materialLots.includes(r.materialLot))) return false;
    return true;
  });
}

/**
 * React hook returning the filtered records with a STABLE reference between renders
 * (recomputed only when `records` or `filter` changes).
 *
 * Do NOT use `useYieldStore((s) => s.filteredRecords())` directly: that selector returns
 * a new array reference on every render, which breaks zustand's `useSyncExternalStore`
 * snapshot caching and causes "Maximum update depth exceeded" infinite render loops.
 */
export function useFilteredRecords(): YieldRecord[] {
  const records = useYieldStore((s) => s.records);
  const filter = useYieldStore((s) => s.filter);
  return useMemo(() => filterRecords(records, filter), [records, filter]);
}

// ---------- aggregation helpers (pure, exported for charts/tabs) ----------

export interface MonthAggregate {
  month: string;
  input: number;
  losses: Record<YieldMetric, number>;
  totalDefect: number;
  throughYield: number | null;   // (input - totalDefect) / input %
}

export function aggregateByMonth(records: YieldRecord[]): MonthAggregate[] {
  const byMonth = new Map<string, MonthAggregate>();
  for (const r of records) {
    if (!r.month) continue;
    let agg = byMonth.get(r.month);
    if (!agg) {
      agg = {
        month: r.month,
        input: 0,
        losses: { leakage: 0, flatness: 0, pressureDrop: 0, ttv: 0 },
        totalDefect: 0,
        throughYield: null,
      };
      byMonth.set(r.month, agg);
    }
    agg.input += r.input;
    for (const m of YIELD_METRICS) {
      agg.losses[m] += r[METRIC_LOSS_FIELD[m]];
    }
  }
  for (const agg of byMonth.values()) {
    agg.totalDefect = agg.losses.leakage + agg.losses.flatness + agg.losses.pressureDrop + agg.losses.ttv;
    if (agg.input > 0) {
      const bounded = Math.min(agg.totalDefect, agg.input);
      agg.throughYield = Math.round(((agg.input - bounded) / agg.input) * 10000) / 100;
    }
  }
  return MONTHS.filter((m) => byMonth.has(m)).map((m) => byMonth.get(m)!);
}

export interface ParetoEntry {
  metric: YieldMetric;
  count: number;
  pct: number;       // percentage of total defect
  cumulativePct: number;
}

export function paretoByDefect(records: YieldRecord[]): ParetoEntry[] {
  const totals: Record<YieldMetric, number> = { leakage: 0, flatness: 0, pressureDrop: 0, ttv: 0 };
  for (const r of records) {
    totals.leakage += r.leakageLoss;
    totals.flatness += r.flatnessLoss;
    totals.pressureDrop += r.pressureDropLoss;
    totals.ttv += r.ttvLoss;
  }
  const total = totals.leakage + totals.flatness + totals.pressureDrop + totals.ttv;
  const sorted = YIELD_METRICS
    .map((m) => ({ metric: m, count: totals[m] }))
    .sort((a, b) => b.count - a.count);
  let cum = 0;
  return sorted.map((row) => {
    const pct = total > 0 ? (row.count / total) * 100 : 0;
    cum += pct;
    return {
      metric: row.metric,
      count: row.count,
      pct: Math.round(pct * 100) / 100,
      cumulativePct: Math.round(cum * 100) / 100,
    };
  });
}

export interface HeatmapCell {
  pn: string;
  metric: YieldMetric;
  ratio: number | null;   // defect/input %
  count: number;
  input: number;
}

export function heatmapPnByDefect(records: YieldRecord[]): { pns: string[]; cells: HeatmapCell[] } {
  const inputByPn = new Map<string, number>();
  const lossByPnMetric = new Map<string, Record<YieldMetric, number>>();
  for (const r of records) {
    inputByPn.set(r.pn, (inputByPn.get(r.pn) ?? 0) + r.input);
    let row = lossByPnMetric.get(r.pn);
    if (!row) {
      row = { leakage: 0, flatness: 0, pressureDrop: 0, ttv: 0 };
      lossByPnMetric.set(r.pn, row);
    }
    row.leakage += r.leakageLoss;
    row.flatness += r.flatnessLoss;
    row.pressureDrop += r.pressureDropLoss;
    row.ttv += r.ttvLoss;
  }
  const pns = Array.from(inputByPn.keys()).sort();
  const cells: HeatmapCell[] = [];
  for (const pn of pns) {
    const input = inputByPn.get(pn) ?? 0;
    const losses = lossByPnMetric.get(pn) ?? { leakage: 0, flatness: 0, pressureDrop: 0, ttv: 0 };
    for (const m of YIELD_METRICS) {
      const ratio = input > 0
        ? Math.round((losses[m] / input) * 10000) / 100
        : null;
      cells.push({ pn, metric: m, ratio, count: losses[m], input });
    }
  }
  return { pns, cells };
}
