import React, { useState } from 'react';
import {
  Card, Row, Col, Table, Tag, Button, Modal, Form, Input, Select, DatePicker,
  Space, Popconfirm, Typography, Empty, Segmented,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, AlertOutlined, ToolOutlined } from '@ant-design/icons';
import { useAlerts } from '../../hooks/useAlerts';
import type { AlertItem } from '../../hooks/useAlerts';
import { useCapaStore } from '../../hooks/useCapa';
import type { CapaItem, CapaStatus } from '../../hooks/useCapa';
import { METRIC_LABELS, YIELD_METRICS } from '../../types/yield';
import type { YieldMetric } from '../../types/yield';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;

const CAPA_STATUS_COLOR: Record<CapaStatus, string> = {
  open: 'red',
  in_progress: 'blue',
  closed: 'default',
};

const CAPA_STATUS_LABEL: Record<CapaStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
};

interface CapaFormValues {
  title: string;
  description?: string;
  pn?: string;
  defectMode?: YieldMetric;
  month?: string;
  owner?: string;
  dueDate?: Dayjs;
  status: CapaStatus;
  rootCause?: string;
  action?: string;
  verification?: string;
}

const SEVERITY_COLOR: Record<AlertItem['severity'], string> = {
  warning: 'orange',
  critical: 'red',
};

const KIND_LABEL: Record<AlertItem['kind'], string> = {
  threshold: 'Threshold',
  mom: 'MoM',
  we: 'WE-Rule',
};

export const AlertsAndCapaTab: React.FC = () => {
  const alerts = useAlerts();
  const capa = useCapaStore();
  const [statusFilter, setStatusFilter] = useState<'all' | CapaStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<CapaFormValues>();

  const openManualAdd = () => {
    form.setFieldsValue({ status: 'open', title: '' });
    setEditingId(null);
    setModalOpen(true);
  };

  const openFromAlert = (a: AlertItem) => {
    form.setFieldsValue({
      status: 'open',
      title: a.title,
      description: a.detail,
      pn: a.pn,
      defectMode: a.defectMode,
      month: a.month,
    });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (c: CapaItem) => {
    form.setFieldsValue({
      ...c,
      dueDate: c.dueDate ? dayjs(c.dueDate) : undefined,
    });
    setEditingId(c.id);
    setModalOpen(true);
  };

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const payload = {
        ...v,
        dueDate: v.dueDate ? v.dueDate.format('YYYY-MM-DD') : undefined,
        source: editingId ? capa.items.find((i) => i.id === editingId)?.source ?? 'manual' : 'manual' as const,
      };
      if (editingId) capa.update(editingId, payload);
      else capa.add(payload);
      setModalOpen(false);
    } catch { /* ignore */ }
  };

  const filteredCapa = statusFilter === 'all' ? capa.items : capa.items.filter((c) => c.status === statusFilter);

  const alertColumns: ColumnType<AlertItem>[] = [
    {
      title: 'Severity', dataIndex: 'severity', key: 'sev', width: 100,
      render: (v) => <Tag color={SEVERITY_COLOR[v as AlertItem['severity']]}>{v.toUpperCase()}</Tag>,
      filters: [{ text: 'Critical', value: 'critical' }, { text: 'Warning', value: 'warning' }],
      onFilter: (val, rec) => rec.severity === val,
    },
    {
      title: 'Kind', dataIndex: 'kind', key: 'kind', width: 100,
      render: (v) => <Tag>{KIND_LABEL[v as AlertItem['kind']]}</Tag>,
    },
    { title: 'Month', dataIndex: 'month', key: 'month', width: 110 },
    { title: 'PN', dataIndex: 'pn', key: 'pn', width: 130 },
    {
      title: 'Defect', dataIndex: 'defectMode', key: 'def', width: 110,
      render: (v) => v ? <Tag color="blue">{METRIC_LABELS[v as YieldMetric]}</Tag> : '—',
    },
    {
      title: 'Detail', key: 'detail', render: (_, r) => (
        <div>
          <Text strong>{r.title}</Text>
          <div style={{ fontSize: 12, color: '#666' }}>{r.detail}</div>
        </div>
      ),
    },
    {
      title: '', key: 'action', width: 130,
      render: (_, r) => (
        <Button size="small" icon={<ToolOutlined />} onClick={() => openFromAlert(r)}>
          建立 CAPA
        </Button>
      ),
    },
  ];

  const capaColumns: ColumnType<CapaItem>[] = [
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: (v: CapaStatus, r) => (
        <Select
          size="small"
          value={v}
          onChange={(s) => capa.setStatus(r.id, s)}
          options={(['open', 'in_progress', 'closed'] as CapaStatus[]).map((s) => ({
            label: <Tag color={CAPA_STATUS_COLOR[s]} style={{ marginRight: 0 }}>{CAPA_STATUS_LABEL[s]}</Tag>,
            value: s,
          }))}
          style={{ width: '100%' }}
        />
      ),
    },
    { title: 'Source', dataIndex: 'source', key: 'src', width: 90, render: (v) => <Tag>{v.toUpperCase()}</Tag> },
    {
      title: 'Title', key: 'title', render: (_, r) => (
        <div>
          <Text strong>{r.title}</Text>
          {r.description && <div style={{ fontSize: 11, color: '#666' }}>{r.description}</div>}
        </div>
      ),
    },
    {
      title: 'Context', key: 'ctx', width: 200, render: (_, r) => (
        <Space size={4} wrap>
          {r.month && <Tag color="blue">{r.month}</Tag>}
          {r.pn && <Tag color="geekblue">{r.pn}</Tag>}
          {r.defectMode && <Tag>{METRIC_LABELS[r.defectMode]}</Tag>}
        </Space>
      ),
    },
    { title: 'Owner', dataIndex: 'owner', key: 'own', width: 100, render: (v) => v || '—' },
    { title: 'Due', dataIndex: 'dueDate', key: 'due', width: 110, render: (v) => v || '—' },
    {
      title: 'Created', dataIndex: 'createdAt', key: 'cr', width: 150,
      render: (v) => v ? new Date(v).toLocaleString() : '—',
      sorter: (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    },
    {
      title: '', key: 'act', width: 96, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="刪除這項 CAPA？" onConfirm={() => capa.remove(r.id)}>
            <Button size="small" type="link" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card
            title={<><AlertOutlined style={{ color: '#1677ff' }} /> Active Alerts</>}
            style={{ borderColor: '#e6efff' }}
            styles={{ body: { padding: '12px 16px' } }}
            extra={<Text type="secondary">由 Yield 資料 + Settings 規則自動推算</Text>}
          >
            {alerts.length === 0 ? (
              <Empty description="目前沒有告警" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                dataSource={alerts}
                columns={alertColumns}
                pagination={{ pageSize: 8 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title={<><ToolOutlined style={{ color: '#1677ff' }} /> CAPA Tracker</>}
            style={{ borderColor: '#e6efff' }}
            styles={{ body: { padding: '12px 16px' } }}
            extra={
              <Space>
                <Segmented
                  size="small"
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as 'all' | CapaStatus)}
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Open', value: 'open' },
                    { label: 'In Progress', value: 'in_progress' },
                    { label: 'Closed', value: 'closed' },
                  ]}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={openManualAdd}>新增 CAPA</Button>
              </Space>
            }
          >
            <Table
              rowKey="id"
              size="small"
              dataSource={filteredCapa}
              columns={capaColumns}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1100 }}
              expandable={{
                expandedRowRender: (r) => (
                  <div style={{ background: '#fafbff', padding: 12, borderRadius: 4 }}>
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Text type="secondary">Root Cause</Text>
                        <div style={{ marginTop: 4 }}>{r.rootCause || <Text type="secondary">—</Text>}</div>
                      </Col>
                      <Col xs={24} md={8}>
                        <Text type="secondary">Action Taken</Text>
                        <div style={{ marginTop: 4 }}>{r.action || <Text type="secondary">—</Text>}</div>
                      </Col>
                      <Col xs={24} md={8}>
                        <Text type="secondary">Verification</Text>
                        <div style={{ marginTop: 4 }}>{r.verification || <Text type="secondary">—</Text>}</div>
                      </Col>
                    </Row>
                  </div>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingId ? '編輯 CAPA' : '新增 CAPA'}
        open={modalOpen}
        onOk={handleOk}
        onCancel={() => setModalOpen(false)}
        okText="儲存"
        cancelText="取消"
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: '請輸入標題' }]}>
            <Input placeholder="例如：May 63AA-LJ-0003 Leakage 高於 cap" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="pn" label="PN"><Input /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defectMode" label="Defect Mode">
                <Select allowClear options={YIELD_METRICS.map((m) => ({ label: METRIC_LABELS[m], value: m }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="month" label="Month"><Input placeholder="January / February / ..." /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="owner" label="Owner"><Input placeholder="負責人" /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dueDate" label="Due Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status" initialValue="open">
                <Select options={(['open', 'in_progress', 'closed'] as CapaStatus[]).map((s) => ({
                  label: CAPA_STATUS_LABEL[s], value: s,
                }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="rootCause" label="Root Cause"><Input.TextArea rows={2} /></Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="action" label="Action"><Input.TextArea rows={2} /></Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="verification" label="Verification"><Input.TextArea rows={2} /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
