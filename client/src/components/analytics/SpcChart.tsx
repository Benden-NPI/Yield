import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Dot,
} from 'recharts';
import { Radio, Space, Select, Typography, Row, Col, Tag } from 'antd';
import { useMeasurementStore, valueOf } from '../../hooks/useMeasurements';
import { useSettingsStore } from '../../hooks/useSettings';
import { METRIC_LABELS, METRIC_UNITS, YIELD_METRICS } from '../../types/yield';
import type { YieldMetric } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';
import { imrLimits, movingRange, westernElectricRules, mean } from '../../utils/statistics';

const { Text } = Typography;

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: { ooc?: boolean };
}

const HighlightDot: React.FC<DotProps> = (p) => {
  const ooc = p.payload?.ooc;
  return <Dot cx={p.cx} cy={p.cy} r={ooc ? 6 : 3} fill={ooc ? '#cf1322' : '#0050b3'} stroke={ooc ? '#cf1322' : '#0050b3'} />;
};

export const SpcChart: React.FC = () => {
  const items = useMeasurementStore((s) => s.records);
  const settings = useSettingsStore();
  const [metric, setMetric] = useState<YieldMetric>('flatness');
  const allPns = useMemo(() => Array.from(new Set(items.map((i) => i.pn))).sort(), [items]);
  const [pn, setPn] = useState<string>('');
  const effectivePn = pn || allPns[0] || '';

  const dataPoints = useMemo(() => {
    return items
      .filter((r) => r.pn === effectivePn && valueOf(r, metric) != null)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .map((r) => ({ date: r.date, value: valueOf(r, metric) as number, id: r.id }));
  }, [items, effectivePn, metric]);

  const values = dataPoints.map((d) => d.value);
  const limits = imrLimits(values);
  const spec = settings.specs[metric];

  const oocSet = useMemo(() => {
    if (!limits) return new Set<number>();
    const center = limits.centerI;
    const sigma = limits.sigma;
    const hits = westernElectricRules(values, center, sigma);
    return new Set(hits.map((h) => h.index));
  }, [values, limits]);

  const chartData = dataPoints.map((d, i) => ({
    ...d,
    ooc: oocSet.has(i),
  }));

  const mrPoints = useMemo(() => {
    const mr = movingRange(values);
    return mr.map((v, i) => ({ date: dataPoints[i + 1]?.date, value: v }));
  }, [values, dataPoints]);

  const mrLimits = limits ? { ucl: limits.uclMR, center: limits.centerMR } : null;

  return (
    <ChartCard
      title="SPC – Individuals & Moving Range (I-MR)"
      info="Individual values chart + moving range chart. Center line = mean; UCL/LCL = mean +/- 3σ (σ estimated from MR/d2). Red points = Western Electric Rules triggers. USL/LSL are Spec limits from Settings."
      extra={
        <Space>
          <Select size="small" value={effectivePn} onChange={setPn} style={{ width: 160 }}
            options={allPns.map((p) => ({ label: p, value: p }))} placeholder="PN" />
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
      {dataPoints.length < 2 ? (
        <EmptyHint text="Insufficient measurements for this PN/Metric (at least 2 records required). Add more in Data Entry." height={280} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} width={56} />
              <Tooltip />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 4 }} />
              {limits && (
                <>
                  <ReferenceLine y={limits.centerI} stroke="#003a8c" strokeDasharray="4 4"
                    label={{ value: `CL ${limits.centerI.toFixed(2)}`, position: 'right', fill: '#003a8c', fontSize: 10 }} />
                  <ReferenceLine y={limits.uclI} stroke="#cf1322" strokeDasharray="2 4"
                    label={{ value: `UCL ${limits.uclI.toFixed(2)}`, position: 'right', fill: '#cf1322', fontSize: 10 }} />
                  <ReferenceLine y={limits.lclI} stroke="#cf1322" strokeDasharray="2 4"
                    label={{ value: `LCL ${limits.lclI.toFixed(2)}`, position: 'right', fill: '#cf1322', fontSize: 10 }} />
                </>
              )}
              {spec.usl != null && (
                <ReferenceLine y={spec.usl} stroke="#faad14"
                  label={{ value: `USL ${spec.usl}`, position: 'left', fill: '#faad14', fontSize: 10 }} />
              )}
              {spec.lsl != null && (
                <ReferenceLine y={spec.lsl} stroke="#faad14"
                  label={{ value: `LSL ${spec.lsl}`, position: 'left', fill: '#faad14', fontSize: 10 }} />
              )}
              <Line
                type="monotone"
                dataKey="value"
                name={`${METRIC_LABELS[metric]} (${METRIC_UNITS[metric]})`}
                stroke="#0050b3"
                strokeWidth={2}
                dot={<HighlightDot />}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>

          {mrLimits && mrPoints.length >= 1 && (
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={mrPoints} margin={{ top: 8, right: 32, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} width={56} />
                <Tooltip />
                <ReferenceLine y={mrLimits.center} stroke="#003a8c" strokeDasharray="4 4"
                  label={{ value: `MR-bar ${mrLimits.center.toFixed(2)}`, position: 'right', fill: '#003a8c', fontSize: 10 }} />
                <ReferenceLine y={mrLimits.ucl} stroke="#cf1322" strokeDasharray="2 4"
                  label={{ value: `UCL ${mrLimits.ucl.toFixed(2)}`, position: 'right', fill: '#cf1322', fontSize: 10 }} />
                <Line type="monotone" dataKey="value" name="Moving Range" stroke="#1677ff" strokeWidth={1.6}
                  dot={{ r: 3, fill: '#1677ff' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}

          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col><Tag color="blue">n = {values.length}</Tag></Col>
            <Col><Tag>Mean = {mean(values).toFixed(2)}</Tag></Col>
            {limits && <Col><Tag color="geekblue">σ̂ = {limits.sigma.toFixed(3)}</Tag></Col>}
            {oocSet.size > 0 && <Col><Tag color="red">OOC points: {oocSet.size}</Tag></Col>}
          </Row>
          {oocSet.size > 0 && (
            <div style={{ marginTop: 4 }}>
              <Text type="warning" style={{ fontSize: 12 }}>
                ⚠ Western Electric Rules triggers detected (red points). Create a CAPA action in Alerts &amp; CAPA.
              </Text>
            </div>
          )}
        </>
      )}
    </ChartCard>
  );
};
