export interface YieldRecord {
  id: string;
  month: string;
  pn: string;
  leakage: number | null;
  flatness: number | null;
  pressureDrop: number | null;
  ttv: number | null;
  input: number;
}

export type YieldMetric = 'leakage' | 'flatness' | 'pressureDrop' | 'ttv';

export interface FilterState {
  months: string[];
  pns: string[];
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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

export const PN_COLORS: Record<string, string> = {
  '63AA-LJ-0003': '#1890ff',
  '63AA-LJ-0004': '#52c41a',
  '62AA-LJ-0001': '#fa8c16',
  '62AA-LJ-0002': '#722ed1',
};

export const FALLBACK_COLORS = [
  '#1890ff', '#52c41a', '#fa8c16', '#722ed1',
  '#eb2f96', '#13c2c2', '#faad14', '#f5222d',
];
