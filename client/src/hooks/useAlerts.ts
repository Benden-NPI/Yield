import { useMemo } from 'react';
import { useYieldStore, aggregateByMonth, computeDefectFailureRatio } from './useYieldData';
import { useSettingsStore } from './useSettings';
import { MONTHS, METRIC_LABELS, METRIC_LOSS_FIELD, YIELD_METRICS } from '../types/yield';
import type { YieldMetric } from '../types/yield';
import { westernElectricRules, mean, stdev } from '../utils/statistics';

export type AlertSeverity = 'warning' | 'critical';
export type AlertKind = 'threshold' | 'mom' | 'we';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  kind: AlertKind;
  month: string;
  pn?: string;
  defectMode?: YieldMetric;
  title: string;
  detail: string;
}

// Pure helper: build alerts from records + settings, so they're easy to test
// and don't need to live in a writable store.
export function useAlerts(): AlertItem[] {
  const records = useYieldStore((s) => s.records);
  const settings = useSettingsStore();

  return useMemo(() => {
    const alerts: AlertItem[] = [];
    const { throughYield, defectFailureRatioMax, alertRules } = settings;

    const monthly = aggregateByMonth(records);

    // --- Rule A: monthly Through Yield breach thresholds ---
    if (alertRules.enableThresholdBreach) {
      for (const m of monthly) {
        if (m.throughYield == null) continue;
        if (m.throughYield < throughYield.critical) {
          alerts.push({
            id: `thr-${m.month}-tyc`,
            severity: 'critical',
            kind: 'threshold',
            month: m.month,
            title: `${m.month} Through Yield critically low (${m.throughYield}%)`,
            detail: `Below critical threshold ${throughYield.critical}% (target ${throughYield.target}%).`,
          });
        } else if (m.throughYield < throughYield.warning) {
          alerts.push({
            id: `thr-${m.month}-tyw`,
            severity: 'warning',
            kind: 'threshold',
            month: m.month,
            title: `${m.month} Through Yield below warning (${m.throughYield}%)`,
            detail: `Below warning threshold ${throughYield.warning}% (target ${throughYield.target}%).`,
          });
        }
      }
    }

    // --- Rule B: per-record defect failure ratio breach ---
    if (alertRules.enableThresholdBreach) {
      for (const r of records) {
        for (const metric of YIELD_METRICS) {
          const ratio = computeDefectFailureRatio(r.input, r[METRIC_LOSS_FIELD[metric]]);
          if (ratio == null) continue;
          const cap = defectFailureRatioMax[metric];
          if (ratio > cap * 2) {
            alerts.push({
              id: `dfr-${r.id}-${metric}-c`,
              severity: 'critical',
              kind: 'threshold',
              month: r.month,
              pn: r.pn,
              defectMode: metric,
              title: `${r.pn} ${METRIC_LABELS[metric]} ${ratio}% (≥2× cap ${cap}%)`,
              detail: `${r.month} – severely exceeds defect cap.`,
            });
          } else if (ratio > cap) {
            alerts.push({
              id: `dfr-${r.id}-${metric}-w`,
              severity: 'warning',
              kind: 'threshold',
              month: r.month,
              pn: r.pn,
              defectMode: metric,
              title: `${r.pn} ${METRIC_LABELS[metric]} ${ratio}% (> cap ${cap}%)`,
              detail: `${r.month} – exceeds defect failure ratio cap.`,
            });
          }
        }
      }
    }

    // --- Rule C: Month-over-Month Through Yield drop ---
    if (alertRules.enableMoMChange && monthly.length >= 2) {
      const monthIdx = (m: string) => MONTHS.indexOf(m);
      const sorted = [...monthly].sort((a, b) => monthIdx(a.month) - monthIdx(b.month));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev.throughYield == null || curr.throughYield == null) continue;
        const drop = prev.throughYield - curr.throughYield;
        if (drop >= alertRules.momChangeThreshold) {
          alerts.push({
            id: `mom-${curr.month}`,
            severity: drop >= alertRules.momChangeThreshold * 2 ? 'critical' : 'warning',
            kind: 'mom',
            month: curr.month,
            title: `${curr.month} Through Yield dropped ${drop.toFixed(2)}% MoM`,
            detail: `From ${prev.throughYield}% (${prev.month}) → ${curr.throughYield}% (${curr.month}).`,
          });
        }
      }
    }

    // --- Rule D: Western Electric on monthly Through Yield series ---
    if (alertRules.enableWesternElectric && monthly.length >= 3) {
      const monthIdx = (m: string) => MONTHS.indexOf(m);
      const sorted = [...monthly].sort((a, b) => monthIdx(a.month) - monthIdx(b.month));
      const series = sorted.map((m) => m.throughYield).filter((v): v is number => v != null);
      if (series.length >= 3) {
        const center = mean(series);
        const sigma = stdev(series);
        const hits = westernElectricRules(series, center, sigma);
        for (const h of hits) {
          const month = sorted[h.index]?.month ?? '';
          alerts.push({
            id: `we-${h.rule}-${month}`,
            severity: h.rule === 1 ? 'critical' : 'warning',
            kind: 'we',
            month,
            title: `${month} – Western Electric Rule ${h.rule}`,
            detail: h.description,
          });
        }
      }
    }

    return alerts;
  }, [records, settings]);
}
