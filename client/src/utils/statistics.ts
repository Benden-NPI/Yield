// Lightweight statistics helpers used by SPC / Cpk / distribution panels.
// All functions are pure and handle empty / degenerate inputs gracefully.

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

// Sample standard deviation (n-1). Returns 0 if fewer than 2 points.
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

export function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

export interface FiveNumberSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  stdev: number;
  n: number;
}

export function fiveNumberSummary(xs: number[]): FiveNumberSummary | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    mean: mean(xs),
    stdev: stdev(xs),
    n: xs.length,
  };
}

// Moving range (|x_i - x_{i-1}|), length n-1.
export function movingRange(xs: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    out.push(Math.abs(xs[i] - xs[i - 1]));
  }
  return out;
}

// Individuals & Moving Range (I-MR) chart control limits.
// Constants for n=2 subgroup MR: d2=1.128, D3=0, D4=3.267.
const D2_N2 = 1.128;
const D4_N2 = 3.267;

export interface IMRLimits {
  centerI: number;   // x-bar
  uclI: number;
  lclI: number;
  centerMR: number;  // MR-bar
  uclMR: number;
  lclMR: number;
  sigma: number;     // estimated short-term sigma = MR-bar / d2
}

export function imrLimits(xs: number[]): IMRLimits | null {
  if (xs.length < 2) return null;
  const mr = movingRange(xs);
  const xbar = mean(xs);
  const mrbar = mean(mr);
  const sigma = mrbar / D2_N2;
  return {
    centerI: xbar,
    uclI: xbar + 3 * sigma,
    lclI: xbar - 3 * sigma,
    centerMR: mrbar,
    uclMR: D4_N2 * mrbar,
    lclMR: 0,
    sigma,
  };
}

// Process capability indices. Uses overall sample sigma (n-1).
// Returns null when sigma=0 or no spec limits provided.
export interface CapabilityInput {
  values: number[];
  usl?: number | null;
  lsl?: number | null;
  target?: number | null;
}

export interface CapabilityResult {
  n: number;
  mean: number;
  stdev: number;
  cp: number | null;
  cpk: number | null;
  cpu: number | null;
  cpl: number | null;
  // % out of spec (empirical)
  outOfSpecPct: number | null;
}

export function capability(input: CapabilityInput): CapabilityResult {
  const { values, usl, lsl } = input;
  const n = values.length;
  const m = mean(values);
  const s = stdev(values);

  let cp: number | null = null;
  let cpu: number | null = null;
  let cpl: number | null = null;
  let cpk: number | null = null;
  let oosPct: number | null = null;

  if (s > 0) {
    if (usl != null && lsl != null) cp = (usl - lsl) / (6 * s);
    if (usl != null) cpu = (usl - m) / (3 * s);
    if (lsl != null) cpl = (m - lsl) / (3 * s);
    if (cpu != null && cpl != null) cpk = Math.min(cpu, cpl);
    else if (cpu != null) cpk = cpu;
    else if (cpl != null) cpk = cpl;
  }

  if (n > 0 && (usl != null || lsl != null)) {
    let oos = 0;
    for (const v of values) {
      if (usl != null && v > usl) { oos += 1; continue; }
      if (lsl != null && v < lsl) { oos += 1; continue; }
    }
    oosPct = (oos / n) * 100;
  }

  return { n, mean: m, stdev: s, cp, cpk, cpu, cpl, outOfSpecPct: oosPct };
}

// Western Electric rules 1–4 (the most widely used subset).
// Each rule returns the indices of points considered out-of-control.
export interface WERuleHit {
  rule: 1 | 2 | 3 | 4;
  index: number;
  description: string;
}

export function westernElectricRules(
  xs: number[],
  center: number,
  sigma: number,
): WERuleHit[] {
  const hits: WERuleHit[] = [];
  if (sigma <= 0 || xs.length === 0) return hits;

  const sigmaOf = (v: number) => (v - center) / sigma;

  // Rule 1: any single point beyond ±3σ.
  xs.forEach((v, i) => {
    if (Math.abs(sigmaOf(v)) > 3) {
      hits.push({ rule: 1, index: i, description: 'Point beyond ±3σ' });
    }
  });

  // Rule 2: 2 of 3 consecutive points beyond ±2σ (same side).
  for (let i = 2; i < xs.length; i++) {
    const window = [xs[i - 2], xs[i - 1], xs[i]].map(sigmaOf);
    const above2 = window.filter((s) => s > 2).length;
    const below2 = window.filter((s) => s < -2).length;
    if (above2 >= 2 || below2 >= 2) {
      hits.push({ rule: 2, index: i, description: '2 of 3 points beyond ±2σ (same side)' });
    }
  }

  // Rule 3: 4 of 5 consecutive points beyond ±1σ (same side).
  for (let i = 4; i < xs.length; i++) {
    const window = xs.slice(i - 4, i + 1).map(sigmaOf);
    const above1 = window.filter((s) => s > 1).length;
    const below1 = window.filter((s) => s < -1).length;
    if (above1 >= 4 || below1 >= 4) {
      hits.push({ rule: 3, index: i, description: '4 of 5 points beyond ±1σ (same side)' });
    }
  }

  // Rule 4: 8 consecutive points on one side of the center line.
  for (let i = 7; i < xs.length; i++) {
    const window = xs.slice(i - 7, i + 1);
    if (window.every((v) => v > center) || window.every((v) => v < center)) {
      hits.push({ rule: 4, index: i, description: '8 consecutive points on one side of CL' });
    }
  }

  return hits;
}

// Round a number to N decimals, keeping null untouched.
export function round(value: number | null | undefined, decimals = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function pctChange(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}
