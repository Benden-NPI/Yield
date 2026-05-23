import React, { useMemo } from 'react';
import { Row, Col, Card, Typography, Tag, List, Empty } from 'antd';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useYieldStore, aggregateByMonth, paretoByDefect, useFilteredRecords } from '../../hooks/useYieldData';
import { useSettingsStore } from '../../hooks/useSettings';
import { useAlerts } from '../../hooks/useAlerts';
import { useCapaStore } from '../../hooks/useCapa';
import { MONTHS, METRIC_LABELS } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';
import { KpiCard } from './KpiCard';
import { pctChange } from '../../utils/statistics';

const { Text, Title } = Typography;

export const OverviewTab: React.FC = () => {
  const records = useFilteredRecords();
  const lastUpdatedAt = useYieldStore((s) => s.lastUpdatedAt);
  const { throughYield, unitCost } = useSettingsStore();
  const alerts = useAlerts();
  const openCapaCount = useCapaStore((s) => s.items.filter((i) => i.status !== 'closed').length);

  const monthly = useMemo(() => aggregateByMonth(records), [records]);
  const pareto = useMemo(() => paretoByDefect(records), [records]);

  // Stable reference for Recharts <LineChart data={...}>. Re-creating this array
  // inline on every render makes Recharts v3 (which subscribes to its internal
  // store via useSyncExternalStore) repeatedly notify its subscribers and
  // triggers "Maximum update depth exceeded" via forceStoreRerender.
  const throughYieldTrendData = useMemo(
    () => monthly.map((m) => ({ month: m.month, throughYield: m.throughYield })),
    [monthly],
  );

  // Pick the latest two months (by month index) for KPI computation
  const latest = monthly.length > 0
    ? [...monthly].sort((a, b) => MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month))[0]
    : null;
  const prev = monthly.length > 1
    ? [...monthly].sort((a, b) => MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month))[1]
    : null;

  const currentTY = latest?.throughYield ?? null;
  const prevTY = prev?.throughYield ?? null;
  const deltaTY = pctChange(currentTY, prevTY);

  const tyStatus: 'good' | 'warning' | 'critical' | 'muted' =
    currentTY == null ? 'muted'
      : currentTY < throughYield.critical ? 'critical'
        : currentTY < throughYield.warning ? 'warning'
          : 'good';

  // COPQ ($): total defect count across filtered records × unit cost
  const totalDefects = records.reduce(
    (s, r) => s + r.leakageLoss + r.flatnessLoss + r.pressureDropLoss + r.ttvLoss, 0);
  const totalInput = records.reduce((s, r) => s + r.input, 0);
  const copq = unitCost > 0 ? totalDefects * unitCost : null;

  const criticalAlertCount = alerts.filter((a) => a.severity === 'critical').length;
  const alertStatus: 'good' | 'warning' | 'critical' | 'muted' =
    alerts.length === 0 ? 'good'
      : criticalAlertCount > 0 ? 'critical' : 'warning';

  const lastUpdatedText = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString()
    : '—';

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title="Latest Month Through Yield"
            value={currentTY}
            suffix="%"
            delta={deltaTY}
            status={tyStatus}
            hint={latest ? `Month: ${latest.month}` : '無資料'}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title="Total Input (filtered)"
            value={totalInput}
            precision={0}
            status="good"
            hint={`Records: ${records.length}`}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title="Total Defect Count"
            value={totalDefects}
            precision={0}
            invertDelta
            status={totalDefects === 0 ? 'good' : 'warning'}
            hint={totalInput > 0 ? `${((totalDefects / totalInput) * 100).toFixed(2)}% of input` : ''}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title="COPQ (Cost of Poor Quality)"
            value={copq}
            precision={0}
            suffix={unitCost > 0 ? '' : undefined}
            status={copq == null ? 'muted' : copq > 0 ? 'warning' : 'good'}
            hint={unitCost > 0 ? `Unit cost = ${unitCost}` : '請於 Settings 設定 unit cost'}
          />
        </Col>

        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title="Open Alerts"
            value={alerts.length}
            precision={0}
            invertDelta
            status={alertStatus}
            hint={`${criticalAlertCount} critical`}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title="Open CAPA"
            value={openCapaCount}
            precision={0}
            invertDelta
            status={openCapaCount === 0 ? 'good' : openCapaCount > 5 ? 'critical' : 'warning'}
            hint="未結案的改善行動"
          />
        </Col>
        <Col xs={24} sm={12} md={12}>
          <Card size="small" style={{ borderColor: '#e6efff' }} styles={{ body: { padding: '14px 16px' } }}>
            <Text strong style={{ color: '#003a8c' }}>Data Freshness</Text>
            <div style={{ fontSize: 13, marginTop: 6, color: '#222' }}>
              最後資料更新時間：<Text code>{lastUpdatedText}</Text>
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
              篩選範圍：{records.length} 筆 / 全資料 {useYieldStore.getState().records.length} 筆
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <ChartCard
            title="Through Yield Trend"
            info="趨勢線 + 目標/警告/Critical 三條參考線。"
          >
            {monthly.length === 0 ? (
              <EmptyHint height={240} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={throughYieldTrendData}
                  margin={{ top: 12, right: 24, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} width={48} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Through Yield']} />
                  <ReferenceLine y={throughYield.target} stroke="#52c41a" strokeDasharray="4 4" />
                  <ReferenceLine y={throughYield.warning} stroke="#faad14" strokeDasharray="4 4" />
                  <ReferenceLine y={throughYield.critical} stroke="#ff4d4f" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="throughYield"
                    stroke="#0050b3"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0050b3' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Col>
        <Col xs={24} lg={8}>
          <ChartCard
            title="Top Defect Modes"
            subtitle="先攻這幾個"
            info="依當前篩選資料的 defect 數量排序。"
          >
            {pareto.length === 0 || pareto[0].count === 0 ? (
              <EmptyHint height={240} />
            ) : (
              <List
                size="small"
                dataSource={pareto}
                renderItem={(row, idx) => (
                  <List.Item style={{ padding: '8px 0', borderBottom: '1px dashed #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
                      <Tag color={idx === 0 ? 'blue' : 'default'} style={{ minWidth: 28, textAlign: 'center' }}>{idx + 1}</Tag>
                      <Text strong>{METRIC_LABELS[row.metric]}</Text>
                      <div style={{ flex: 1, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${row.pct}%`, height: '100%', background: '#1677ff' }} />
                      </div>
                      <Text style={{ minWidth: 60, textAlign: 'right' }}>{row.count} ({row.pct}%)</Text>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </ChartCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <ChartCard
            title="Latest Alerts"
            info="自動由 Yield 資料 + 你設定的規則計算，最多顯示 8 筆。"
          >
            {alerts.length === 0 ? (
              <Empty description="目前沒有觸發任何告警，繼續加油！" />
            ) : (
              <List
                size="small"
                dataSource={alerts.slice(0, 8)}
                renderItem={(a) => (
                  <List.Item>
                    <Tag color={a.severity === 'critical' ? 'red' : 'orange'} style={{ minWidth: 70, textAlign: 'center' }}>
                      {a.severity.toUpperCase()}
                    </Tag>
                    <div style={{ flex: 1 }}>
                      <Text strong>{a.title}</Text>
                      <div style={{ fontSize: 12, color: '#666' }}>{a.detail}</div>
                    </div>
                    <Tag>{a.kind.toUpperCase()}</Tag>
                  </List.Item>
                )}
              />
            )}
          </ChartCard>
        </Col>
      </Row>

      <Title level={5} style={{ marginTop: 24, color: '#003a8c' }}>使用提示</Title>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Overview 是 Executive 視角，所有指標皆隨「資料輸入」與「Settings」連動。深度分析請見「Yield Reports」、「Process Analytics」。
      </Text>
    </div>
  );
};
