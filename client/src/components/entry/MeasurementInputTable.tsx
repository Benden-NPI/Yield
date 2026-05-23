import React, { useState } from 'react';
import {
  Table, Button, Form, InputNumber, Select, Popconfirm, Input,
  Space, Typography, Tag, Modal, DatePicker, Row, Col, Switch,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMeasurementStore } from '../../hooks/useMeasurements';
import type { MeasurementRecord } from '../../hooks/useMeasurements';
import { METRIC_LABELS, METRIC_UNITS, KNOWN_PNS, YIELD_METRICS } from '../../types/yield';
import type { YieldMetric, Shift } from '../../types/yield';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;

interface FormValues {
  date: Dayjs;
  pn: string;
  shift?: Shift;
  machine?: string;
  operator?: string;
  woNo?: string;
  materialLot?: string;
  leakage?: number | null;
  flatness?: number | null;
  pressureDrop?: number | null;
  ttv?: number | null;
  pass: boolean;
  failModes?: YieldMetric[];
  note?: string;
}

export const MeasurementInputTable: React.FC = () => {
  const items = useMeasurementStore((s) => s.records);
  const { add, update, remove } = useMeasurementStore();
  const [form] = Form.useForm<FormValues>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openAdd = () => {
    form.setFieldsValue({
      date: dayjs(),
      pn: KNOWN_PNS[0],
      pass: true,
      failModes: [],
    });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (r: MeasurementRecord) => {
    form.setFieldsValue({
      ...r,
      date: r.date ? dayjs(r.date) : dayjs(),
      leakage: r.leakage ?? undefined,
      flatness: r.flatness ?? undefined,
      pressureDrop: r.pressureDrop ?? undefined,
      ttv: r.ttv ?? undefined,
    });
    setEditingId(r.id);
    setModalOpen(true);
  };

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const payload: Omit<MeasurementRecord, 'id'> = {
        date: v.date.format('YYYY-MM-DD'),
        pn: v.pn,
        shift: v.shift,
        machine: v.machine?.trim() || undefined,
        operator: v.operator?.trim() || undefined,
        woNo: v.woNo?.trim() || undefined,
        materialLot: v.materialLot?.trim() || undefined,
        leakage: v.leakage ?? null,
        flatness: v.flatness ?? null,
        pressureDrop: v.pressureDrop ?? null,
        ttv: v.ttv ?? null,
        pass: !!v.pass,
        failModes: v.pass ? [] : (v.failModes ?? []),
        note: v.note?.trim() || undefined,
      };
      if (editingId) update(editingId, payload);
      else add(payload);
      setModalOpen(false);
    } catch {
      /* ignore */
    }
  };

  const columns: ColumnType<MeasurementRecord>[] = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: 110, sorter: (a, b) => a.date.localeCompare(b.date) },
    { title: 'PN', dataIndex: 'pn', key: 'pn', width: 130, render: (v) => <Text code>{v}</Text> },
    {
      title: 'Dimensions', key: 'dim', width: 200, render: (_, r) => (
        <Space size={4} wrap>
          {r.shift && <Tag>S{r.shift}</Tag>}
          {r.machine && <Tag color="geekblue">{r.machine}</Tag>}
          {r.materialLot && <Tag color="cyan">Lot {r.materialLot}</Tag>}
        </Space>
      ),
    },
    {
      title: `Leakage (${METRIC_UNITS.leakage})`,
      dataIndex: 'leakage', key: 'leak', width: 110,
      render: (v: number | null) => v == null ? '—' : v,
      sorter: (a, b) => (a.leakage ?? 0) - (b.leakage ?? 0),
    },
    {
      title: `Flatness (${METRIC_UNITS.flatness})`,
      dataIndex: 'flatness', key: 'flat', width: 110,
      render: (v: number | null) => v == null ? '—' : v,
      sorter: (a, b) => (a.flatness ?? 0) - (b.flatness ?? 0),
    },
    {
      title: `PD (${METRIC_UNITS.pressureDrop})`,
      dataIndex: 'pressureDrop', key: 'pd', width: 100,
      render: (v: number | null) => v == null ? '—' : v,
      sorter: (a, b) => (a.pressureDrop ?? 0) - (b.pressureDrop ?? 0),
    },
    {
      title: `TTV (${METRIC_UNITS.ttv})`,
      dataIndex: 'ttv', key: 'ttv', width: 100,
      render: (v: number | null) => v == null ? '—' : v,
      sorter: (a, b) => (a.ttv ?? 0) - (b.ttv ?? 0),
    },
    {
      title: 'Status', key: 'status', width: 130,
      render: (_, r) => r.pass
        ? <Tag color="blue">PASS</Tag>
        : (
          <Space size={4} wrap>
            <Tag color="red">FAIL</Tag>
            {r.failModes.map((m) => <Tag key={m}>{METRIC_LABELS[m]}</Tag>)}
          </Space>
        ),
    },
    {
      title: '',
      key: 'action',
      width: 88,
      fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)} size="small" />
          <Popconfirm title="Delete this item?" onConfirm={() => remove(r.id)} okText="Delete" cancelText="Cancel">
            <Button type="link" icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong style={{ fontSize: 16, color: '#003a8c' }}>
            Measurements <Tag color="blue">{items.length} records</Tag>
          </Text>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            SPC / Cpk / Scatter charts in Process Analytics use this piece-level measurement dataset.
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Measurement</Button>
      </div>

      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        bordered
        size="middle"
        scroll={{ x: 1180 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} records` }}
      />

      <Modal
        title={editingId ? 'Edit Measurement' : 'Add Measurement'}
        open={modalOpen}
        onOk={handleOk}
        onCancel={() => setModalOpen(false)}
        okText="Save"
        cancelText="Cancel"
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Enter the measurement date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pn" label="PN" rules={[{ required: true, message: 'Select a PN' }]}>
                <Select
                  options={KNOWN_PNS.map((p) => ({ label: p, value: p }))}
                  showSearch
                  mode="tags"
                  maxCount={1}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="shift" label="Shift">
                <Select allowClear options={[{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'C', value: 'C' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="machine" label="Machine"><Input placeholder="M-01" /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="materialLot" label="Material Lot"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="operator" label="Operator"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="woNo" label="WO No."><Input /></Form.Item>
            </Col>

            {YIELD_METRICS.map((m) => (
              <Col span={12} key={m}>
                <Form.Item name={m} label={`${METRIC_LABELS[m]} (${METRIC_UNITS[m]})`}>
                  <InputNumber style={{ width: '100%' }} step={0.01} />
                </Form.Item>
              </Col>
            ))}

            <Col span={12}>
              <Form.Item name="pass" label="Pass?" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="PASS" unCheckedChildren="FAIL" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="failModes" label="Fail Modes (required for FAIL only)">
                <Select mode="multiple" allowClear
                  options={YIELD_METRICS.map((m) => ({ label: METRIC_LABELS[m], value: m }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="Note"><Input.TextArea rows={2} /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
