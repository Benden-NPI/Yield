import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { aggregateByMonth, useFilteredRecords } from '../../hooks/useYieldData';
import { METRIC_LABELS, YIELD_METRICS } from '../../types/yield';
import { DEFECT_BLUE } from '../../utils/colors';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';

export const DefectComposition: React.FC = () => {
  const records = useFilteredRecords();

  const data = useMemo(() => {
    const monthly = aggregateByMonth(records);
    return monthly.map((m) => {
      const total = m.totalDefect || 1;
      return {
        month: m.month,
        leakage: Math.round((m.losses.leakage / total) * 10000) / 100,
        flatness: Math.round((m.losses.flatness / total) * 10000) / 100,
        pressureDrop: Math.round((m.losses.pressureDrop / total) * 10000) / 100,
        ttv: Math.round((m.losses.ttv / total) * 10000) / 100,
        totalDefect: m.totalDefect,
      };
    });
  }, [records]);

  return (
    <ChartCard
      title="Defect Composition (100% Stacked, by Month)"
      info="顯示每月四種缺陷的相對占比，幫助觀察失效結構是否改變。"
    >
      {data.length === 0 ? (
        <EmptyHint height={300} />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} width={48} />
            <Tooltip formatter={(v, name) => [`${v}%`, METRIC_LABELS[name as keyof typeof METRIC_LABELS] ?? name]} />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }}
              formatter={(value) => METRIC_LABELS[value as keyof typeof METRIC_LABELS] ?? value} />
            {YIELD_METRICS.map((m) => (
              <Bar key={m} dataKey={m} stackId="defects" fill={DEFECT_BLUE[m]} maxBarSize={64} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};
