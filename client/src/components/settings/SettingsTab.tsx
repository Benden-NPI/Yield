import React from 'react';
import { Card, Form, InputNumber, Switch, Button, Row, Col, Divider, Typography, Space, Popconfirm, Input, message, Alert } from 'antd';
import { SettingOutlined, ReloadOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { useSettingsStore, DEFAULT_SETTINGS } from '../../hooks/useSettings';
import type { SettingsState } from '../../hooks/useSettings';
import { METRIC_LABELS, METRIC_UNITS, YIELD_METRICS } from '../../types/yield';
import { useSharePointSync, getStoredWebhookUrl, setStoredWebhookUrl } from '../../hooks/useSharePointSync';
import { useToolGanttSync, getToolGanttWebhookUrl, setToolGanttWebhookUrl } from '../../hooks/useToolGanttSync';
import { useToolGanttStore } from '../../hooks/useToolGanttStore';
import type { StationRecord } from '../toolgantt/types';

const { Title, Text } = Typography;

export const SettingsTab: React.FC = () => {
  const settings = useSettingsStore();
  const [form] = Form.useForm<SettingsState>();
  const { sync, syncing, lastSyncAt, lastError } = useSharePointSync();
  const [webhookUrl, setWebhookUrl] = React.useState<string>(() => getStoredWebhookUrl());

  /* Tool Gantt SharePoint */
  const [tgWebhookUrl, setTgWebhookUrl] = React.useState<string>(() => getToolGanttWebhookUrl());
  const storeSetStations = useToolGanttStore((s) => s.setStations);
  const handleTgData = React.useCallback((stations: StationRecord[]) => {
    storeSetStations(stations, 'SharePoint');
  }, [storeSetStations]);
  const { sync: tgSync, syncing: tgSyncing, lastSyncAt: tgLastSyncAt, lastError: tgLastError } = useToolGanttSync(handleTgData);
  const tgSyncedCount = useToolGanttStore((s) => s.stations?.length ?? null);

  React.useEffect(() => {
    form.setFieldsValue(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleValuesChange = (_: unknown, all: SettingsState) => {
    settings.update(all);
  };

  const reset = () => {
    settings.reset();
    form.setFieldsValue(DEFAULT_SETTINGS);
  };

  const handleSaveUrl = () => {
    setStoredWebhookUrl(webhookUrl.trim());
    message.success('Webhook URL 已儲存');
  };

  const handleSync = async () => {
    try {
      // Persist any unsaved URL edit before syncing.
      setStoredWebhookUrl(webhookUrl.trim());
      const result = await sync(webhookUrl.trim());
      if (result.missingMonth > 0) {
        message.warning(`已載入 ${result.count} 筆；其中 ${result.missingMonth} 筆缺少 Date 欄位，將不會出現在月份趨勢圖`);
      } else {
        message.success(`已從 SharePoint 載入 ${result.count} 筆資料`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      message.error(`同步失敗：${msg}`);
    }
  };

  const handleTgSaveUrl = () => {
    setToolGanttWebhookUrl(tgWebhookUrl.trim());
    message.success('Tool Gantt Webhook URL 已儲存');
  };

  const handleTgSync = async () => {
    try {
      setToolGanttWebhookUrl(tgWebhookUrl.trim());
      const result = await tgSync(tgWebhookUrl.trim());
      message.success(`已從 SharePoint 載入 ${result.count} 個站別資料，請切換到 Tool PO Tracking 頁面查看`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      message.error(`同步失敗：${msg}`);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card
        title={<><CloudDownloadOutlined style={{ color: '#1677ff' }} /> SharePoint 同步（只讀）</>}
        style={{ borderColor: '#e6efff' }}
      >
        <Alert
          type="info"
          showIcon
          message="從 Power Automate Webhook 載入 SharePoint 表格資料"
          description={
            <div style={{ fontSize: 12 }}>
              <div>• 按下「從 SharePoint 同步」會 <b>覆寫</b> 本機 records（localStorage）。</div>
              <div>• Webhook URL 只存在這台瀏覽器的 localStorage，<b>不會 commit 進 source code</b>。</div>
              <div>• SharePoint 表格需要包含 <code>Date</code> 欄位（yyyy-mm-dd），系統會自動轉成月份。沒有 Date 的列不會出現在月份趨勢圖。</div>
            </div>
          }
          style={{ marginBottom: 12 }}
        />
        <Row gutter={8}>
          <Col flex="auto">
            <Input.Password
              placeholder="貼上 Power Automate HTTP trigger URL（含 sig=...）"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              autoComplete="off"
              visibilityToggle
            />
          </Col>
          <Col>
            <Space>
              <Button onClick={handleSaveUrl}>儲存 URL</Button>
              <Popconfirm
                title="從 SharePoint 同步會覆寫本機資料，確定繼續？"
                onConfirm={handleSync}
                okText="同步"
                cancelText="取消"
              >
                <Button type="primary" icon={<CloudDownloadOutlined />} loading={syncing} disabled={!webhookUrl.trim()}>
                  從 SharePoint 同步
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
        <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
          {lastSyncAt && <span>最後同步：{new Date(lastSyncAt).toLocaleString()} </span>}
          {lastError && <span style={{ color: '#cf1322' }}>錯誤：{lastError}</span>}
        </div>
      </Card>

      <Card
        title={<><CloudDownloadOutlined style={{ color: '#52c41a' }} /> Tool PO Tracking — SharePoint 同步</>}
        style={{ borderColor: '#e6ffed' }}
      >
        <Alert
          type="success"
          showIcon
          message="從 Power Automate Webhook 載入 Tool PO Tracking Excel 資料"
          description={
            <div style={{ fontSize: 12 }}>
              <div>• 按下「從 SharePoint 同步」會 <b>覆寫</b> Tool Gantt 的資料（本機 session）。</div>
              <div>• Webhook URL 只存在這台瀏覽器的 localStorage，<b>不會 commit 進 source code</b>。</div>
              <div>• Control Plan Excel 需要包含：<code>Station for 300x300</code>、<code>Process Step</code>、<code>Move-in day</code>、<code>Setup Completed (HW)</code>、<code>Tuning Completed (Short loop)</code>、<code>Tuning Criteria</code>、<code>Qualify Completed (Qual lot)</code>、<code>Qualify Criteria</code> 欄位。</div>
              <div>• 同步後切換到 <b>Tool PO Tracking</b> 頁面即可看到更新的 Gantt 圖。</div>
            </div>
          }
          style={{ marginBottom: 12 }}
        />
        <Row gutter={8}>
          <Col flex="auto">
            <Input.Password
              placeholder="貼上 Power Automate HTTP trigger URL（含 sig=...）"
              value={tgWebhookUrl}
              onChange={(e) => setTgWebhookUrl(e.target.value)}
              autoComplete="off"
              visibilityToggle
            />
          </Col>
          <Col>
            <Space>
              <Button onClick={handleTgSaveUrl}>儲存 URL</Button>
              <Popconfirm
                title="從 SharePoint 同步會覆寫目前 Tool Gantt 資料，確定繼續？"
                onConfirm={handleTgSync}
                okText="同步"
                cancelText="取消"
              >
                <Button type="primary" icon={<CloudDownloadOutlined />} loading={tgSyncing} disabled={!tgWebhookUrl.trim()}>
                  從 SharePoint 同步
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
        <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
          {tgLastSyncAt && (
            <span>最後同步：{new Date(tgLastSyncAt).toLocaleString()}
              {tgSyncedCount != null && `（${tgSyncedCount} 個站別）`}
            </span>
          )}
          {tgLastError && <span style={{ color: '#cf1322' }}> 錯誤：{tgLastError}</span>}
        </div>
      </Card>

      <Card
        title={<><SettingOutlined style={{ color: '#1677ff' }} /> Targets / Specs / Alert Rules</>}
        style={{ borderColor: '#e6efff' }}
        extra={
          <Popconfirm title="Reset to defaults?" onConfirm={reset}>
            <Button icon={<ReloadOutlined />} size="small">Reset to defaults</Button>
          </Popconfirm>
        }
      >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        initialValues={settings}
      >
        <Title level={5} style={{ color: '#003a8c', marginTop: 0 }}>Through Yield Targets (%)</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Critical &lt; Warning &lt; Target; charts show these as reference lines, and alerts use them for evaluation.
        </Text>
        <Row gutter={12} style={{ marginTop: 8 }}>
          <Col span={8}>
            <Form.Item name={['throughYield', 'target']} label="Target (Green)">
              <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={['throughYield', 'warning']} label="Warning (Yellow)">
              <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={['throughYield', 'critical']} label="Critical (Red)">
              <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider />

        <Title level={5} style={{ color: '#003a8c' }}>Defect Failure Ratio Cap (%)</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          For each defect in a single record, a failure ratio above this cap triggers Warning; above 2x triggers Critical.
        </Text>
        <Row gutter={12} style={{ marginTop: 8 }}>
          {YIELD_METRICS.map((m) => (
            <Col xs={12} md={6} key={m}>
              <Form.Item name={['defectFailureRatioMax', m]} label={`${METRIC_LABELS[m]} cap`}>
                <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          ))}
        </Row>

        <Divider />

        <Title level={5} style={{ color: '#003a8c' }}>COPQ – Unit Cost</Title>
        <Row gutter={12}>
          <Col xs={12} md={6}>
            <Form.Item name="unitCost" label="Cost per defective unit ($)">
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider />

        <Title level={5} style={{ color: '#003a8c' }}>Spec Limits (for Cpk / SPC)</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Used for measurement analysis in Process Analytics; leave blank if that side has no Spec limit.
        </Text>
        <div style={{ marginTop: 8 }}>
          {YIELD_METRICS.map((m) => (
            <Card key={m} size="small" style={{ marginBottom: 8, background: '#fafbff', borderColor: '#e6efff' }}>
              <div style={{ fontWeight: 600, color: '#003a8c', marginBottom: 8 }}>
                {METRIC_LABELS[m]} ({METRIC_UNITS[m]})
              </div>
              <Row gutter={12}>
                <Col xs={8}>
                  <Form.Item name={['specs', m, 'lsl']} label="LSL">
                    <InputNumber step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={8}>
                  <Form.Item name={['specs', m, 'target']} label="Target">
                    <InputNumber step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={8}>
                  <Form.Item name={['specs', m, 'usl']} label="USL">
                    <InputNumber step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}
        </div>

        <Divider />

        <Title level={5} style={{ color: '#003a8c' }}>Alert Rules</Title>
        <Row gutter={12}>
          <Col xs={24} md={8}>
            <Form.Item name={['alertRules', 'enableThresholdBreach']} label="Enable: Threshold breach alerts" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['alertRules', 'enableMoMChange']} label="Enable: Major MoM drop alerts" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['alertRules', 'momChangeThreshold']} label="MoM Drop Threshold (%)">
              <InputNumber min={0} max={100} step={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['alertRules', 'enableWesternElectric']} label="Enable: Western Electric Rules" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ✓ All changes are automatically saved to localStorage. No manual Save is required.
          </Text>
        </Space>
      </Form>
      </Card>
    </Space>
  );
};
