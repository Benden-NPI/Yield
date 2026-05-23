// Blue-only palette (per user request: keep bars in blue scale, no rainbow)
// Order from dark→light so that primary/important series get the darker tones.
export const BLUE_PALETTE = [
  '#003a8c',
  '#0050b3',
  '#096dd9',
  '#1890ff',
  '#40a9ff',
  '#69c0ff',
  '#91d5ff',
  '#bae7ff',
];

// Stable color assignment for a given key (PN, defect mode, etc.)
export function pickBlue(index: number): string {
  return BLUE_PALETTE[index % BLUE_PALETTE.length];
}

// Fixed colors per defect metric (used in pareto/composition where the
// identity of the bar matters).
export const DEFECT_BLUE: Record<string, string> = {
  leakage: '#003a8c',
  flatness: '#0958d9',
  pressureDrop: '#1677ff',
  ttv: '#69b1ff',
};

// Status colors (only for KPI/CAPA badges, kept minimal)
export const STATUS_COLOR = {
  good: '#1677ff',
  warning: '#faad14',
  critical: '#ff4d4f',
  muted: '#8c8c8c',
} as const;
