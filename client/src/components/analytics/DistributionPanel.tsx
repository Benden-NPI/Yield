import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Radio, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useMeasurementStore, valueOf } from '../../hooks/useMeasurements';
import { useSettingsStore } from '../../hooks/useSettings';
import { METRIC_LABELS, METRIC_UNITS, YIELD_METRICS } from '../../types/yield';
import type { YieldMetric } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';
import { fiveNumberSummary } from '../../utils/statistics';

const { Text } = Typography;

function buildHistogram(values: number[], binCount = 12): { bin: string; count: number; midpoint: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ bin: `${min.toFixed(2)}`, count: values.length, midpoint: min }];
  }
  const width = (max - min) / binCount;
  const bins: { bin: string; count: number; midpoint: number }[] = [];
  for (let i = 0; i < binCount; i++) {
    const lo = min + width * i;
    const hi = lo + width;
    const isLast = i === binCount - 1;
    const inside = values.filter((v) => v >= lo && (isLast ? v <= hi : v < hi)).length;
    bins.push({
      bin: `${lo.toFixed(2)}–${hi.toFixed(2)}`,
      count: inside,
      midpoint: (lo + hi) / 2,
    });
  }
  return bins;
}

export const DistributionPanel: React.FC = () => {
  const items = useMeasurementStore((s) => s.records);
  const settings = useSettingsStore();
  const [metric, setMetric] = useState<YieldMetric>('flatness');
  const allPns = useMemo(() => ['(All)', ...Array.from(new Set(items.map((i) => i.pn))).sort()], [items]);
  const [pn, setPn] = useState<string>('(All)');

  const values = useMemo(() => items
    .filter((r) => pn === '(All)' ? true : r.pn === pn)
    .map((r) => valueOf(r, metric))
    .filter((v): v is number => v != null), [items, pn, metric]);

  const summary = fiveNumberSummary(values);
  const histo = useMemo(() => buildHistogram(values), [values]);
  const spec = settings.specs[metric];

  const summaryRows = summary ? [
    { key: 'n', label: 'n', value: summary.n },
    { key: 'mean', label: 'Mean', value: summary.mean.toFixed(3) },
    { key: 'sd', label: 'σ', value: summary.stdev.toFixed(3) },
    { key: 'min', label: 'Min', value: summary.min.toFixed(3) },
    { key: 'q1', label: 'Q1', value: summary.q1.toFixed(3) },
    { key: 'median', label: 'Median', value: summary.median.toFixed(3) },
    { key: 'q3', label: 'Q3', value: summary.q3.toFixed(3) },
    { key: 'max', label: 'Max', value: summary.max.toFixed(3) },
    { key: 'iqr', label: 'IQR', value: (summary.q3 - summary.q1).toFixed(3) },
  ] : [];

  const summaryCols: ColumnType<typeof summaryRows[number]>[] = [
    { title: '', dataIndex: 'label', key: 'label', width: 80, render: (v) => <Text strong style={{ color: '#003a8c' }}>{v}</Text> },
    { title: '', dataIndex: 'value', key: 'value' },
  ];

  return (
    <ChartCard
      title="Distribution / Histogram"
      info="量測值分布直方圖 + 五數摘要；可顯示 USL/LSL 規格界線參考。"
      extra={
        <Space>
          <Select size="small" value={pn} onChange={setPn} style={{ width: 150 }}
            options={allPns.map((p) => ({ label: p, value: p }))} />
          <Radio.Group
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
            options={YIELD_METRICS.map((k) => ({ label: METRIC_LABELS[k], value: k }))}
          />
        </Space>
      }
    >
      {values.length === 0 ? (
        <EmptyHint text="尚無量測資料" height={260} />
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 480px', minWidth: 320 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={histo} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bin" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                {spec.usl != null && (
                  <ReferenceLine x={histo.find((b) => b.midpoint >= (spec.usl as number))?.bin}
                    stroke="#faad14" label={{ value: `USL`, fill: '#faad14', fontSize: 10 }} />
                )}
                {spec.lsl != null && (
                  <ReferenceLine x={histo.find((b) => b.midpoint >= (spec.lsl as number))?.bin}
                    stroke="#faad14" label={{ value: `LSL`, fill: '#faad14', fontSize: 10 }} />
                )}
                <Bar dataKey="count" fill="#1677ff" maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: '0 0 240px' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="blue">{METRIC_LABELS[metric]} ({METRIC_UNITS[metric]})</Tag>
              {pn !== '(All)' && <Tag color="geekblue">{pn}</Tag>}
            </div>
            <Table size="small" rowKey="key" dataSource={summaryRows} columns={summaryCols} pagination={false} showHeader={false} bordered />
          </div>
        </div>
      )}
    </ChartCard>
  );
};
