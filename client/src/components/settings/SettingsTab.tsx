import React from 'react';
import { Card, Form, InputNumber, Switch, Button, Row, Col, Divider, Typography, Space, Popconfirm } from 'antd';
import { SettingOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSettingsStore, DEFAULT_SETTINGS } from '../../hooks/useSettings';
import type { SettingsState } from '../../hooks/useSettings';
import { METRIC_LABELS, METRIC_UNITS, YIELD_METRICS } from '../../types/yield';

const { Title, Text } = Typography;

export const SettingsTab: React.FC = () => {
  const settings = useSettingsStore();
  const [form] = Form.useForm<SettingsState>();

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

  return (
    <Card
      title={<><SettingOutlined style={{ color: '#1677ff' }} /> 目標 / 規格 / 告警規則</>}
      style={{ borderColor: '#e6efff' }}
      extra={
        <Popconfirm title="恢復為預設值？" onConfirm={reset}>
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
        <Title level={5} style={{ color: '#003a8c', marginTop: 0 }}>Through Yield 三線目標 (%)</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Critical &lt; Warning &lt; Target；圖表會以參考線呈現，告警會依此判斷。
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

        <Title level={5} style={{ color: '#003a8c' }}>Defect Failure Ratio 上限 (%)</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          每種 defect 在單筆紀錄中，failure ratio 超過此值會觸發 Warning，超過兩倍會觸發 Critical。
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

        <Title level={5} style={{ color: '#003a8c' }}>Spec Limits（Cpk / SPC 用）</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          用於 Process Analytics 的量測值分析；留空代表沒有該側規格。
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
            <Form.Item name={['alertRules', 'enableThresholdBreach']} label="啟用：閾值超出告警" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['alertRules', 'enableMoMChange']} label="啟用：MoM 大幅下降告警" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['alertRules', 'momChangeThreshold']} label="MoM 下降閾值 (%)">
              <InputNumber min={0} max={100} step={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['alertRules', 'enableWesternElectric']} label="啟用：Western Electric Rules" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ✓ 所有變更已自動儲存於本機 localStorage，無需手動 Save。
          </Text>
        </Space>
      </Form>
    </Card>
  );
};
