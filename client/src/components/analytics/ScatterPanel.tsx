import React, { useMemo, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ZAxis,
} from 'recharts';
import { Select, Space, Row, Col, Tag, Statistic } from 'antd';
import { useMeasurementStore, valueOf } from '../../hooks/useMeasurements';
import { METRIC_LABELS, METRIC_UNITS, YIELD_METRICS } from '../../types/yield';
import type { YieldMetric } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';
import { pickBlue } from '../../utils/colors';
import { mean, stdev } from '../../utils/statistics';

function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return null;
  return num / denom;
}

export const ScatterPanel: React.FC = () => {
  const items = useMeasurementStore((s) => s.records);
  const [x, setX] = useState<YieldMetric>('flatness');
  const [y, setY] = useState<YieldMetric>('ttv');

  const byPn = useMemo(() => {
    const groups = new Map<string, { x: number; y: number; pn: string; date?: string }[]>();
    for (const r of items) {
      const vx = valueOf(r, x);
      const vy = valueOf(r, y);
      if (vx == null || vy == null) continue;
      let arr = groups.get(r.pn);
      if (!arr) {
        arr = [];
        groups.set(r.pn, arr);
      }
      arr.push({ x: vx, y: vy, pn: r.pn, date: r.date });
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items, x, y]);

  const flatXs: number[] = [];
  const flatYs: number[] = [];
  for (const [, arr] of byPn) {
    for (const p of arr) {
      flatXs.push(p.x);
      flatYs.push(p.y);
    }
  }
  const r = pearson(flatXs, flatYs);
  const totalN = flatXs.length;

  return (
    <ChartCard
      title="Scatter / Correlation"
      info="挑兩個量測指標，觀察兩兩相關性；點按 PN 著色。Pearson r：±1 強相關、0 無相關。"
      extra={
        <Space>
          <Select size="small" value={x} onChange={setX} style={{ width: 140 }}
            options={YIELD_METRICS.map((m) => ({ label: `X: ${METRIC_LABELS[m]}`, value: m }))} />
          <Select size="small" value={y} onChange={setY} style={{ width: 140 }}
            options={YIELD_METRICS.map((m) => ({ label: `Y: ${METRIC_LABELS[m]}`, value: m }))} />
        </Space>
      }
    >
      {totalN < 2 ? (
        <EmptyHint text="量測資料不足（至少需要 2 點同時有 X 和 Y）。" height={280} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                type="number"
                dataKey="x"
                name={`${METRIC_LABELS[x]} (${METRIC_UNITS[x]})`}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={`${METRIC_LABELS[y]} (${METRIC_UNITS[y]})`}
                tick={{ fontSize: 12 }}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
              {byPn.map(([pn, arr], idx) => (
                <Scatter key={pn} name={pn} data={arr} fill={pickBlue(idx)} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col>
              <Statistic title="n" value={totalN} valueStyle={{ fontSize: 16, color: '#003a8c' }} />
            </Col>
            <Col>
              <Statistic
                title="Pearson r"
                value={r == null ? '—' : r.toFixed(3)}
                valueStyle={{ fontSize: 16, color: r != null && Math.abs(r) > 0.7 ? '#cf1322' : '#003a8c' }}
              />
            </Col>
            <Col>
              <Tag color="blue">X σ = {stdev(flatXs).toFixed(3)}</Tag>
            </Col>
            <Col>
              <Tag color="blue">Y σ = {stdev(flatYs).toFixed(3)}</Tag>
            </Col>
          </Row>
        </>
      )}
    </ChartCard>
  );
};
