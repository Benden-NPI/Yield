import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LabelList, ResponsiveContainer,
} from 'recharts';
import { Typography, Empty } from 'antd';
import { useYieldStore } from '../hooks/useYieldData';
import {
  MONTHS, KNOWN_PNS, PN_COLORS, FALLBACK_COLORS,
} from '../types/yield';

const { Title } = Typography;

function getColor(pn: string, index: number): string {
  return PN_COLORS[pn] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function computeThroughYield(
  input: number,
  leakage: number,
  flatness: number,
  pressureDrop: number,
  ttv: number,
): number | null {
  if (!Number.isFinite(input) || input <= 0) return null;
  const totalDefect = Math.max(0, leakage) + Math.max(0, flatness)
    + Math.max(0, pressureDrop) + Math.max(0, ttv);
  const bounded = Math.min(totalDefect, input);
  const ratio = ((input - bounded) / input) * 100;
  return Math.round(ratio * 100) / 100;
}

export const ThroughYieldChart: React.FC = () => {
  const { filteredRecords } = useYieldStore();
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
        if (!match) {
          entry[pn] = null;
          continue;
        }
        entry[pn] = computeThroughYield(
          match.input,
          match.leakageLoss,
          match.flatnessLoss,
          match.pressureDropLoss,
          match.ttvLoss,
        );
      }
      return entry;
    });
  }, [records, allPns]);

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
          Through Yield by Month
        </Title>
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
