import React, { useMemo, useRef, useState } from 'react';
import { Row, Col, Card, Typography, Tag, List, Empty, Space, Button, Tooltip, Popconfirm, message } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { PdfExportButton } from '../PdfExportButton';
import { useSharePointSync, getStoredWebhookUrl } from '../../hooks/useSharePointSync';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useYieldStore, aggregateByMonth, paretoByDefect, useFilteredRecords } from '../../hooks/useYieldData';
import { useSettingsStore } from '../../hooks/useSettings';
import { useAlerts } from '../../hooks/useAlerts';
import { useCapaStore } from '../../hooks/useCapa';
import { MONTHS, METRIC_LABELS, DISPLAY_MONTHS } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';
import { KpiCard } from './KpiCard';
import { YieldReportsContent } from '../yield/YieldReportsContent';
import { pctChange } from '../../utils/statistics';

const { Text, Title } = Typography;

export const OverviewTab: React.FC = () => {
  const records = useFilteredRecords();
  const lastUpdatedAt = useYieldStore((s) => s.lastUpdatedAt);
  const [msgApi, msgCtx] = message.useMessage();
  const { sync, syncing } = useSharePointSync();
  const hasUrl = !!getStoredWebhookUrl();

  const handleSync = async () => {
    try {
      const result = await sync();
      if (result.missingMonth > 0) {
        msgApi.warning(`已載入 ${result.count} 筆；其中 ${result.missingMonth} 筆缺少 Date 欄位`);
      } else {
        msgApi.success(`已從 SharePoint 載入 ${result.count} 筆資料`);
      }
    } catch (err) {
      msgApi.error(`同步失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const { throughYield, unitCost } = useSettingsStore();
  const alerts = useAlerts();
  const openCapaCount = useCapaStore((s) => s.items.filter((i) => i.status !== 'closed').length);

  const monthly = useMemo(() => aggregateByMonth(records), [records]);
  const pareto = useMemo(() => paretoByDefect(records), [records]);

  // Stable reference for Recharts <LineChart data={...}>. Re-creating this array
  // inline on every render makes Recharts v3 (which subscribes to its internal
  // store via useSyncExternalStore) repeatedly notify its subscribers and
  // triggers "Maximum update depth exceeded" via forceStoreRerender.
  // Always render every month in DISPLAY_MONTHS (April–September); months with
  // no data show as null so the trend line just leaves a gap there.
  const throughYieldTrendData = useMemo(
    () => {
      const byMonth = new Map(monthly.map((m) => [m.month, m]));
      return DISPLAY_MONTHS.map((month) => ({
        month,
        throughYield: byMonth.get(month)?.throughYield ?? null,
      }));
    },
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

  const reportRef = useRef<HTMLDivElement | null>(null);
  const yieldReportsExportRef = useRef<HTMLDivElement | null>(null);
  // Mount the Yield Reports section off-screen only while exporting, so the
  // Overview PDF can include it as a second section without polluting the
  // normal Overview UI or paying its render cost continuously.
  const [renderYieldReportsForExport, setRenderYieldReportsForExport] = useState(false);

  return (
    <div>
      {msgCtx}
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 12 }}>
        {hasUrl ? (
          <Popconfirm
            title="從 SharePoint 同步會覆寫本機 Yield 資料，確定繼續？"
            onConfirm={handleSync}
            okText="同步"
            cancelText="取消"
          >
            <Button icon={<SyncOutlined spin={syncing} />} loading={syncing}>
              Sync Yield Data
            </Button>
          </Popconfirm>
        ) : (
          <Tooltip title="請先在 Settings 頁面設定 Yield Webhook URL">
            <Button icon={<SyncOutlined />} disabled>
              Sync Yield Data
            </Button>
          </Tooltip>
        )}
        <PdfExportButton
          targetRef={[reportRef, yieldReportsExportRef]}
          fileName="overview-report"
          label="Export Overview + Yield Reports PDF"
          beforeCapture={() => setRenderYieldReportsForExport(true)}
          afterCapture={() => setRenderYieldReportsForExport(false)}
          // Give React time to mount the off-screen subtree and Recharts'
          // ResponsiveContainer time to measure & paint before html2canvas runs.
          prepareDelayMs={700}
        />
      </Space>
      <div ref={reportRef} style={{ background: '#f4f6fa', padding: 1 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <KpiCard
            title="Latest Month Through Yield"
            value={currentTY}
            suffix="%"
            delta={deltaTY}
            status={tyStatus}
            hint={latest ? `Month: ${latest.month}` : 'No data'}
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
            hint={unitCost > 0 ? `Unit cost = ${unitCost}` : 'Set unit cost in Settings'}
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
            hint="Open CAPA actions"
          />
        </Col>
        <Col xs={24} sm={12} md={12}>
          <Card size="small" style={{ borderColor: '#e6efff' }} styles={{ body: { padding: '14px 16px' } }}>
            <Text strong style={{ color: '#003a8c' }}>Data Freshness</Text>
            <div style={{ fontSize: 13, marginTop: 6, color: '#222' }}>
              Last data update: <Text code>{lastUpdatedText}</Text>
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
              Filter scope: {records.length} records / All records {useYieldStore.getState().records.length} records
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <ChartCard
            title="Through Yield Trend"
            info="Trend line with three reference lines: Target, Warning, and Critical."
          >
            {records.length === 0 ? (
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
            subtitle="Tackle these first"
            info="Sorted by Defect count in the current filtered data."
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
            info="Automatically calculated from Yield data and your Settings rules. Shows up to 8 records."
          >
            {alerts.length === 0 ? (
              <Empty description="No alerts triggered. Keep it up!" />
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

      <Title level={5} style={{ marginTop: 24, color: '#003a8c' }}>Usage Tips</Title>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Overview is the executive view. All metrics update with Data Entry and Settings. See Yield Reports and Process Analytics for deeper analysis.
      </Text>
      </div>

      {/* Off-screen Yield Reports section, only rendered while exporting so
          html2canvas can capture it as the second PDF section. Positioned far
          left so it neither paints visibly nor interferes with the page flow,
          but kept at a fixed wide width so Recharts' ResponsiveContainer
          measures correctly and the charts render at a sensible size. */}
      {renderYieldReportsForExport && (
        <div
          ref={yieldReportsExportRef}
          aria-hidden
          style={{
            position: 'fixed',
            top: 0,
            left: -100000,
            width: 1200,
            background: '#f4f6fa',
            padding: 16,
            pointerEvents: 'none',
          }}
        >
          <YieldReportsContent />
        </div>
      )}
    </div>
  );
};
