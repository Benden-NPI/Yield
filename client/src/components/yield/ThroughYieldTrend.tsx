import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, ResponsiveContainer,
} from 'recharts';
import { aggregateByMonth, useFilteredRecords } from '../../hooks/useYieldData';
import { useSettingsStore } from '../../hooks/useSettings';
import { DISPLAY_MONTHS } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';

export const ThroughYieldTrend: React.FC = () => {
  const records = useFilteredRecords();
  const { throughYield } = useSettingsStore();

  const data = useMemo(() => {
    const byMonth = new Map(aggregateByMonth(records).map((m) => [m.month, m]));
    return DISPLAY_MONTHS.map((month) => ({
      month,
      throughYield: byMonth.get(month)?.throughYield ?? null,
    }));
  }, [records]);

  return (
    <ChartCard
      title="Through Yield Trend by Month"
      info="(input - total defect) / input, aggregated monthly from filtered records. Green = Target, yellow = Warning, red = Critical."
    >
      {records.length === 0 ? (
        <EmptyHint height={300} />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12 }}
              width={48}
            />
            <Tooltip
              formatter={(v) => {
                const n = v as number | null | undefined;
                return n != null ? [`${n}%`, 'Through Yield'] : ['N/A', 'Through Yield'];
              }}
            />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <ReferenceLine y={throughYield.target} stroke="#52c41a" strokeDasharray="4 4"
              label={{ value: `Target ${throughYield.target}%`, position: 'right', fill: '#52c41a', fontSize: 11 }} />
            <ReferenceLine y={throughYield.warning} stroke="#faad14" strokeDasharray="4 4"
              label={{ value: `Warning ${throughYield.warning}%`, position: 'right', fill: '#faad14', fontSize: 11 }} />
            <ReferenceLine y={throughYield.critical} stroke="#ff4d4f" strokeDasharray="4 4"
              label={{ value: `Critical ${throughYield.critical}%`, position: 'right', fill: '#ff4d4f', fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="throughYield"
              name="Through Yield"
              stroke="#0050b3"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#0050b3' }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};
