import React, { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import { paretoByDefect, useFilteredRecords } from '../../hooks/useYieldData';
import { METRIC_LABELS } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';

export const ParetoChart: React.FC = () => {
  const records = useFilteredRecords();
  const data = useMemo(() => paretoByDefect(records).map((row) => ({
    name: METRIC_LABELS[row.metric],
    count: row.count,
    cumulative: row.cumulativePct,
  })), [records]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <ChartCard
      title="Defect Pareto"
      subtitle="Identify which Defect to tackle first"
      info="Bars sort defects by count; the line shows cumulative percentage to highlight 80/20 priorities."
    >
      {total === 0 ? (
        <EmptyHint height={300} />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 20, right: 40, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v, name) => {
                if (name === 'cumulative') return [`${v}%`, 'Cumulative %'];
                return [v as number, 'Defect Count'];
              }}
            />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <Bar yAxisId="left" dataKey="count" name="Defect Count" fill="#0050b3" maxBarSize={56}>
              <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#555' }} />
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %" stroke="#1677ff" strokeWidth={2}
              dot={{ r: 4, fill: '#1677ff' }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};
