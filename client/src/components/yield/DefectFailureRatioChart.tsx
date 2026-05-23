import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LabelList, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Radio } from 'antd';
import { computeDefectFailureRatio, useFilteredRecords } from '../../hooks/useYieldData';
import { useSettingsStore } from '../../hooks/useSettings';
import type { YieldMetric } from '../../types/yield';
import { KNOWN_PNS, METRIC_LABELS, METRIC_LOSS_FIELD, YIELD_METRICS, DISPLAY_MONTHS } from '../../types/yield';
import { pickBlue } from '../../utils/colors';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';

export const DefectFailureRatioChart: React.FC = () => {
  const records = useFilteredRecords();
  const settings = useSettingsStore();
  const [metric, setMetric] = useState<YieldMetric>('leakage');

  const allPns = useMemo(() => {
    const pns = new Set<string>([...KNOWN_PNS, ...records.map((r) => r.pn)]);
    return Array.from(pns);
  }, [records]);

  const chartData = useMemo(() => {
    return DISPLAY_MONTHS.map((month) => {
      const entry: Record<string, string | number | null> = { month };
      for (const pn of allPns) {
        const match = records.find((r) => r.month === month && r.pn === pn);
        entry[pn] = match
          ? computeDefectFailureRatio(match.input, match[METRIC_LOSS_FIELD[metric]])
          : null;
      }
      return entry;
    });
  }, [records, metric, allPns]);

  const cap = settings.defectFailureRatioMax[metric];

  return (
    <ChartCard
      title={`Defect Failure Ratio by ${METRIC_LABELS[metric]}`}
      info="Formula: defect count / input. Red dashed line = per-defect cap from Settings."
      extra={
        <Radio.Group
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          size="small"
          options={YIELD_METRICS.map((k) => ({ label: METRIC_LABELS[k], value: k }))}
        />
      }
    >
      {records.length === 0 ? (
        <EmptyHint height={320} />
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} margin={{ top: 24, right: 20, left: 0, bottom: 8 }} barCategoryGap="25%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} width={48} />
            <Tooltip
              formatter={(value) => {
                const v = value as number | null | undefined;
                return v != null ? [`${v}%`, ''] : ['N/A', ''];
              }}
            />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            <ReferenceLine y={cap} stroke="#ff4d4f" strokeDasharray="4 4"
              label={{ value: `Cap ${cap}%`, position: 'right', fill: '#ff4d4f', fontSize: 11 }} />
            {allPns.map((pn, idx) => (
              <Bar key={pn} dataKey={pn} name={pn} fill={pickBlue(idx)} maxBarSize={48}>
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
      )}
    </ChartCard>
  );
};
