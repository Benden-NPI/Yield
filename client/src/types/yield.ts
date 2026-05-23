export const APP_NAME = 'Yield';
export const APP_VERSION = '1.0.4';

export type Shift = 'A' | 'B' | 'C';

// Extended record schema (Phase 2).
// All extra dimensions are optional so legacy records still load cleanly.
export interface YieldRecord {
  id: string;
  month: string;             // Always derived/kept for backward-compat charts.
  pn: string;
  input: number;
  leakageLoss: number;
  flatnessLoss: number;
  pressureDropLoss: number;
  ttvLoss: number;

  date?: string;             // yyyy-mm-dd, optional. Used when present.
  shift?: Shift;
  machine?: string;
  operator?: string;
  materialLot?: string;
  woNo?: string;
  reworkCount?: number;
}

export type YieldMetric = 'leakage' | 'flatness' | 'pressureDrop' | 'ttv';

export const YIELD_METRICS: YieldMetric[] = ['leakage', 'flatness', 'pressureDrop', 'ttv'];

export interface FilterState {
  months: string[];
  pns: string[];
  shifts: Shift[];
  machines: string[];
  materialLots: string[];
}

export const EMPTY_FILTER: FilterState = {
  months: [],
  pns: [],
  shifts: [],
  machines: [],
  materialLots: [],
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Months that monthly time-series charts (Through Yield trend, By PN, Defect
// Failure Ratio, Defect Composition) display on the X axis. Months outside
// this window are hidden; in-range months with no data render as blanks.
export const DISPLAY_MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
];

export const KNOWN_PNS = [
  '63AA-LJ-0003',
  '63AA-LJ-0004',
  '62AA-LJ-0001',
  '62AA-LJ-0002',
];

export const METRIC_LABELS: Record<YieldMetric, string> = {
  leakage: 'Leakage',
  flatness: 'Flatness',
  pressureDrop: 'Pressure Drop',
  ttv: 'TTV',
};

export const METRIC_UNITS: Record<YieldMetric, string> = {
  leakage: 'ccm',
  flatness: 'µm',
  pressureDrop: 'kPa',
  ttv: 'µm',
};

export const METRIC_LOSS_FIELD: Record<YieldMetric, keyof Pick<
  YieldRecord,
  'leakageLoss' | 'flatnessLoss' | 'pressureDropLoss' | 'ttvLoss'
>> = {
  leakage: 'leakageLoss',
  flatness: 'flatnessLoss',
  pressureDrop: 'pressureDropLoss',
  ttv: 'ttvLoss',
};
