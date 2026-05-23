import React, { useMemo } from 'react';
import { Table, Tag, Typography } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useMeasurementStore, valueOf } from '../../hooks/useMeasurements';
import { useSettingsStore } from '../../hooks/useSettings';
import { METRIC_LABELS, METRIC_UNITS, YIELD_METRICS } from '../../types/yield';
import type { YieldMetric } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';
import { capability } from '../../utils/statistics';

const { Text } = Typography;

interface Row {
  key: string;
  pn: string;
  metric: YieldMetric;
  n: number;
  mean: number;
  stdev: number;
  cp: number | null;
  cpk: number | null;
  outOfSpecPct: number | null;
  usl: number | null;
  lsl: number | null;
}

function cpkTag(cpk: number | null): React.ReactNode {
  if (cpk == null) return <Tag>—</Tag>;
  const v = Math.round(cpk * 100) / 100;
  if (cpk >= 1.67) return <Tag color="blue">{v} (Excellent)</Tag>;
  if (cpk >= 1.33) return <Tag color="cyan">{v} (Capable)</Tag>;
  if (cpk >= 1.0)  return <Tag color="orange">{v} (Marginal)</Tag>;
  return <Tag color="red">{v} (Not capable)</Tag>;
}

export const CpkPanel: React.FC = () => {
  const items = useMeasurementStore((s) => s.records);
  const settings = useSettingsStore();

  const rows = useMemo<Row[]>(() => {
    const pns = Array.from(new Set(items.map((i) => i.pn))).sort();
    const out: Row[] = [];
    for (const pn of pns) {
      for (const metric of YIELD_METRICS) {
        const vals = items
          .filter((r) => r.pn === pn)
          .map((r) => valueOf(r, metric))
          .filter((v): v is number => v != null);
        if (vals.length === 0) continue;
        const spec = settings.specs[metric];
        const res = capability({ values: vals, usl: spec.usl, lsl: spec.lsl, target: spec.target });
        out.push({
          key: `${pn}-${metric}`,
          pn,
          metric,
          n: res.n,
          mean: Math.round(res.mean * 1000) / 1000,
          stdev: Math.round(res.stdev * 1000) / 1000,
          cp: res.cp == null ? null : Math.round(res.cp * 100) / 100,
          cpk: res.cpk == null ? null : Math.round(res.cpk * 100) / 100,
          outOfSpecPct: res.outOfSpecPct == null ? null : Math.round(res.outOfSpecPct * 100) / 100,
          usl: spec.usl,
          lsl: spec.lsl,
        });
      }
    }
    return out;
  }, [items, settings]);

  const columns: ColumnType<Row>[] = [
    { title: 'PN', dataIndex: 'pn', key: 'pn', render: (v) => <Text code>{v}</Text> },
    {
      title: 'Metric', dataIndex: 'metric', key: 'metric',
      render: (v) => <Tag color="blue">{METRIC_LABELS[v as YieldMetric]} ({METRIC_UNITS[v as YieldMetric]})</Tag>,
    },
    { title: 'n', dataIndex: 'n', key: 'n', width: 60 },
    { title: 'Mean', dataIndex: 'mean', key: 'mean' },
    { title: 'σ', dataIndex: 'stdev', key: 'sd' },
    {
      title: 'Spec (LSL / USL)', key: 'spec', render: (_, r) => (
        <Text style={{ fontFamily: 'monospace' }}>{r.lsl ?? '—'} / {r.usl ?? '—'}</Text>
      ),
    },
    { title: 'Cp', dataIndex: 'cp', key: 'cp', render: (v) => v ?? '—' },
    { title: 'Cpk', dataIndex: 'cpk', key: 'cpk', render: cpkTag },
    {
      title: 'Out of Spec %', dataIndex: 'outOfSpecPct', key: 'oos',
      render: (v) => v == null ? '—' : <Tag color={v > 5 ? 'red' : v > 1 ? 'orange' : 'blue'}>{v}%</Tag>,
    },
  ];

  return (
    <ChartCard
      title="Process Capability (Cp / Cpk)"
      info="Calculated using USL/LSL from Settings and overall sample standard deviation. Cpk >= 1.33 indicates a capable process; < 1.0 is insufficient."
    >
      {rows.length === 0 ? (
        <EmptyHint text="No measurement data yet. Add Measurement Data in Data Entry first." height={200} />
      ) : (
        <Table size="small" rowKey="key" dataSource={rows} columns={columns} pagination={false} />
      )}
    </ChartCard>
  );
};
