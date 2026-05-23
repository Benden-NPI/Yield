import React, { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import { useYieldStore, paretoByDefect } from '../../hooks/useYieldData';
import { METRIC_LABELS } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';

export const ParetoChart: React.FC = () => {
  const records = useYieldStore((s) => s.filteredRecords());
  const data = useMemo(() => paretoByDefect(records).map((row) => ({
    name: METRIC_LABELS[row.metric],
    count: row.count,
    cumulative: row.cumulativePct,
  })), [records]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <ChartCard
      title="Defect Pareto"
      subtitle="決定『先攻哪個』缺陷"
      info="長條依 defect 數量由大到小排列，折線顯示累計百分比，協助識別 80/20 重點。"
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
                if (name === 'cumulative') return [`${v}%`, '累計 %'];
                return [v as number, '缺陷數量'];
              }}
            />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <Bar yAxisId="left" dataKey="count" name="缺陷數量" fill="#0050b3" maxBarSize={56}>
              <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#555' }} />
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cumulative" name="累計 %" stroke="#1677ff" strokeWidth={2}
              dot={{ r: 4, fill: '#1677ff' }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};
