import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LabelList, ResponsiveContainer,
} from 'recharts';
import { useYieldStore } from '../../hooks/useYieldData';
import { MONTHS, KNOWN_PNS } from '../../types/yield';
import { pickBlue } from '../../utils/colors';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';

function compute(input: number, defects: number): number | null {
  if (!Number.isFinite(input) || input <= 0) return null;
  const bounded = Math.min(Math.max(0, defects), input);
  return Math.round(((input - bounded) / input) * 10000) / 100;
}

export const ThroughYieldByPnChart: React.FC = () => {
  const records = useYieldStore((s) => s.filteredRecords());

  const allPns = useMemo(() => {
    const pns = new Set<string>([...KNOWN_PNS, ...records.map((r) => r.pn)]);
    return Array.from(pns);
  }, [records]);

  const chartData = useMemo(() => {
    const monthsPresent = records.length > 0
      ? MONTHS.filter((m) => records.some((r) => r.month === m))
      : [];
    return monthsPresent.map((month) => {
      const entry: Record<string, string | number | null> = { month };
      for (const pn of allPns) {
        const match = records.find((r) => r.month === month && r.pn === pn);
        if (!match) entry[pn] = null;
        else entry[pn] = compute(match.input, match.leakageLoss + match.flatnessLoss + match.pressureDropLoss + match.ttvLoss);
      }
      return entry;
    });
  }, [records, allPns]);

  return (
    <ChartCard
      title="Through Yield by Month (by PN)"
      info="按 PN 拆解每月 Through Yield，方便比較不同料號。"
    >
      {records.length === 0 ? (
        <EmptyHint height={320} />
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} margin={{ top: 24, right: 20, left: 0, bottom: 8 }} barCategoryGap="25%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} width={48} />
            <Tooltip formatter={(v) => {
              const n = v as number | null | undefined;
              return n != null ? [`${n}%`, ''] : ['N/A', ''];
            }} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            {allPns.map((pn, idx) => (
              <Bar key={pn} dataKey={pn} name={pn} fill={pickBlue(idx)} maxBarSize={48}>
                <LabelList
                  dataKey={pn}
                  position="top"
                  formatter={(v: unknown) => (v != null && v !== '' ? `${v}%` : '')}
                  style={{ fontSize: 11, fill: '#555' }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};
