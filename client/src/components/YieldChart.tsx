import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LabelList, ResponsiveContainer,
} from 'recharts';
import { Radio, Typography, Empty } from 'antd';
import { useYieldStore } from '../hooks/useYieldData';
import type { YieldMetric } from '../types/yield';
import {
  MONTHS, KNOWN_PNS,
  METRIC_LABELS, PN_COLORS, FALLBACK_COLORS,
} from '../types/yield';

const { Title } = Typography;

function getColor(pn: string, index: number): string {
  return PN_COLORS[pn] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export const YieldChart: React.FC = () => {
  const { filteredRecords } = useYieldStore();
  const [metric, setMetric] = useState<YieldMetric>('leakage');

  const records = filteredRecords();

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
        entry[pn] = match ? (match[metric] ?? null) : null;
      }
      return entry;
    });
  }, [records, metric, allPns]);

  const metricOptions = (Object.keys(METRIC_LABELS) as YieldMetric[]).map((key) => ({
    label: METRIC_LABELS[key],
    value: key,
  }));

  if (records.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <Empty description="暫無資料，請先新增良率資料" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>
          Yield by {METRIC_LABELS[metric]}
        </Title>
        <Radio.Group
          options={metricOptions}
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          size="small"
        />
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={chartData}
          margin={{ top: 24, right: 20, left: 0, bottom: 8 }}
          barCategoryGap="25%"
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12 }}
            width={48}
          />
          <Tooltip
            formatter={(value) => {
              const v = value as number | null | undefined;
              return v != null ? [`${v}%`, ''] : ['N/A', ''];
            }}
          />
          <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
          {allPns.map((pn, idx) => (
            <Bar key={pn} dataKey={pn} name={pn} fill={getColor(pn, idx)} maxBarSize={48}>
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
    </div>
  );
};
