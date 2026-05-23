import React from 'react';
import { Card, Statistic, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  title: string;
  value: number | string | null;
  suffix?: string;
  precision?: number;
  delta?: number | null;          // % change vs previous
  deltaUnit?: string;             // default: %
  status?: 'good' | 'warning' | 'critical' | 'muted';
  hint?: string;
  // If true, higher delta = bad (e.g. defect ratio). Default false (higher = good).
  invertDelta?: boolean;
}

const STATUS_BG: Record<NonNullable<Props['status']>, string> = {
  good: 'linear-gradient(135deg,#e6f4ff 0%,#bae0ff 100%)',
  warning: 'linear-gradient(135deg,#fffbe6 0%,#fff1b8 100%)',
  critical: 'linear-gradient(135deg,#fff1f0 0%,#ffccc7 100%)',
  muted: 'linear-gradient(135deg,#fafafa 0%,#f0f0f0 100%)',
};

const STATUS_BORDER: Record<NonNullable<Props['status']>, string> = {
  good: '#91caff',
  warning: '#ffd666',
  critical: '#ff7875',
  muted: '#d9d9d9',
};

const STATUS_VALUE: Record<NonNullable<Props['status']>, string> = {
  good: '#003a8c',
  warning: '#d48806',
  critical: '#cf1322',
  muted: '#595959',
};

export const KpiCard: React.FC<Props> = ({
  title, value, suffix, precision = 2, delta, deltaUnit = '%', status = 'good', hint, invertDelta = false,
}) => {
  const goodDelta = delta != null && (invertDelta ? delta < 0 : delta > 0);
  const badDelta = delta != null && (invertDelta ? delta > 0 : delta < 0);

  return (
    <Card
      size="small"
      style={{
        background: STATUS_BG[status],
        borderColor: STATUS_BORDER[status],
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      <Statistic
        title={<Text style={{ color: '#003a8c', fontWeight: 600 }}>{title}</Text>}
        value={value ?? '—'}
        suffix={value == null ? undefined : suffix}
        precision={typeof value === 'number' ? precision : undefined}
        valueStyle={{ color: STATUS_VALUE[status], fontSize: 26, fontWeight: 700 }}
      />
      {delta != null && (
        <div style={{ marginTop: 4, fontSize: 12, color: goodDelta ? '#389e0d' : badDelta ? '#cf1322' : '#595959' }}>
          {goodDelta && <ArrowUpOutlined />} {badDelta && <ArrowDownOutlined />}
          {' '}{delta > 0 ? '+' : ''}{delta.toFixed(2)}{deltaUnit} vs prev
        </div>
      )}
      {hint && <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>{hint}</div>}
    </Card>
  );
};
