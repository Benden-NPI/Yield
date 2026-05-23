import { create } from 'zustand';
import type { YieldMetric } from '../types/yield';
import { YIELD_METRICS } from '../types/yield';

const STORAGE_KEY = 'yield_settings_v1';

export interface ThresholdConfig {
  target: number;    // % above which is good
  warning: number;   // % below which we warn (between critical & warning)
  critical: number;  // % below which is critical
}

export interface SpecLimits {
  usl: number | null;
  lsl: number | null;
  target: number | null;
}

export interface AlertRulesConfig {
  enableThresholdBreach: boolean;
  enableMoMChange: boolean;
  momChangeThreshold: number; // % drop in Through Yield m/m to flag
  enableWesternElectric: boolean;
}

export interface SettingsState {
  // Through Yield target band (applies on monthly aggregate).
  throughYield: ThresholdConfig;
  // Per-defect failure ratio warning thresholds (%).
  defectFailureRatioMax: Record<YieldMetric, number>;
  // Cost of poor quality (per defect unit).
  unitCost: number;
  // Spec limits for measurement-based Cpk / SPC.
  specs: Record<YieldMetric, SpecLimits>;
  alertRules: AlertRulesConfig;
}

export const DEFAULT_SETTINGS: SettingsState = {
  throughYield: { target: 98, warning: 95, critical: 90 },
  defectFailureRatioMax: {
    leakage: 2,
    flatness: 2,
    pressureDrop: 2,
    ttv: 2,
  },
  unitCost: 0,
  specs: {
    leakage:      { usl: null, lsl: 0,    target: 0 },
    flatness:     { usl: 5,    lsl: 0,    target: 0 },
    pressureDrop: { usl: 100,  lsl: 0,    target: 50 },
    ttv:          { usl: 5,    lsl: 0,    target: 0 },
  },
  alertRules: {
    enableThresholdBreach: true,
    enableMoMChange: true,
    momChangeThreshold: 10,
    enableWesternElectric: true,
  },
};

function loadFromStorage(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function mergeSettings(base: SettingsState, override: unknown): SettingsState {
  if (!override || typeof override !== 'object') return base;
  const o = override as Partial<SettingsState>;
  return {
    throughYield: { ...base.throughYield, ...(o.throughYield ?? {}) },
    defectFailureRatioMax: {
      ...base.defectFailureRatioMax,
      ...(o.defectFailureRatioMax ?? {}),
    },
    unitCost: typeof o.unitCost === 'number' ? o.unitCost : base.unitCost,
    specs: YIELD_METRICS.reduce((acc, m) => {
      acc[m] = { ...base.specs[m], ...((o.specs ?? {})[m] ?? {}) };
      return acc;
    }, {} as Record<YieldMetric, SpecLimits>),
    alertRules: { ...base.alertRules, ...(o.alertRules ?? {}) },
  };
}

function saveToStorage(s: SettingsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore quota errors – settings are small
  }
}

interface SettingsStore extends SettingsState {
  update: (patch: Partial<SettingsState>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...loadFromStorage(),

  update: (patch) => {
    const next = mergeSettings(get(), patch);
    saveToStorage(next);
    set(next);
  },

  reset: () => {
    saveToStorage(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));
