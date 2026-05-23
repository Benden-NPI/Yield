import React, { useState } from 'react';
import {
  Table, Button, Form, InputNumber, Select, Popconfirm, Input,
  Space, Typography, Tag, Modal, Divider, DatePicker, Row, Col,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useYieldStore, computeYieldFromLoss, computeThroughYield, useFilteredRecords } from '../../hooks/useYieldData';
import type { YieldRecord, Shift } from '../../types/yield';
import { MONTHS, KNOWN_PNS } from '../../types/yield';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;

interface FormValues {
  date?: Dayjs;
  month?: string;
  pn: string;
  shift?: Shift;
  machine?: string;
  operator?: string;
  materialLot?: string;
  woNo?: string;
  reworkCount?: number;
  input: number;
  leakageLoss: number;
  flatnessLoss: number;
  pressureDropLoss: number;
  ttvLoss: number;
}

function clampLoss(input: number, loss: number): number {
  if (!Number.isFinite(input) || input <= 0) return Math.max(0, Math.round(loss));
  return Math.min(Math.max(0, Math.round(loss)), Math.round(input));
}

function renderTyTag(value: number | null): React.ReactNode {
  if (value == null) return '—';
  const color = value >= 95 ? 'blue' : value >= 85 ? 'gold' : 'red';
  return <Tag color={color}>{value}%</Tag>;
}

export const YieldInputTable: React.FC = () => {
  const { addRecord, updateRecord, deleteRecord } = useYieldStore();
  const records = useFilteredRecords();
  const [form] = Form.useForm<FormValues>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openAdd = () => {
    form.setFieldsValue({
      date: dayjs(),
      month: MONTHS[new Date().getMonth()],
      pn: KNOWN_PNS[0],
      input: 0,
      leakageLoss: 0,
      flatnessLoss: 0,
      pressureDropLoss: 0,
      ttvLoss: 0,
    });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (record: YieldRecord) => {
    form.setFieldsValue({
      ...record,
      date: record.date ? dayjs(record.date) : undefined,
    });
    setEditingId(record.id);
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const normalizedInput = Math.max(0, Math.round(Number(values.input) || 0));
      const date = values.date ? values.date.format('YYYY-MM-DD') : undefined;
      const month = date ? MONTHS[new Date(date).getMonth()] : (values.month ?? MONTHS[new Date().getMonth()]);

      const data: Omit<YieldRecord, 'id'> = {
        month,
        pn: values.pn,
        input: normalizedInput,
        leakageLoss: clampLoss(normalizedInput, Number(values.leakageLoss) || 0),
        flatnessLoss: clampLoss(normalizedInput, Number(values.flatnessLoss) || 0),
        pressureDropLoss: clampLoss(normalizedInput, Number(values.pressureDropLoss) || 0),
        ttvLoss: clampLoss(normalizedInput, Number(values.ttvLoss) || 0),
        date,
        shift: values.shift,
        machine: values.machine?.trim() || undefined,
        operator: values.operator?.trim() || undefined,
        materialLot: values.materialLot?.trim() || undefined,
        woNo: values.woNo?.trim() || undefined,
        reworkCount: values.reworkCount != null ? Math.max(0, Math.round(values.reworkCount)) : undefined,
      };
      if (editingId) updateRecord(editingId, data);
      else addRecord(data);
      setModalOpen(false);
    } catch {
      /* validation failed */
    }
  };

  const columns: ColumnType<YieldRecord>[] = [
    {
      title: 'Date / Month',
      key: 'date',
      width: 130,
      sorter: (a, b) => {
        const ax = a.date ?? `${MONTHS.indexOf(a.month)}`;
        const bx = b.date ?? `${MONTHS.indexOf(b.month)}`;
        return ax.localeCompare(bx);
      },
      render: (_, r) => (
        <div>
          {r.date && <div style={{ fontSize: 11, color: '#666' }}>{r.date}</div>}
          <Tag color="blue">{r.month}</Tag>
        </div>
      ),
    },
    {
      title: 'PN',
      dataIndex: 'pn',
      key: 'pn',
      width: 140,
      render: (val) => <Text code>{val}</Text>,
    },
    {
      title: 'Dimensions',
      key: 'dims',
      width: 220,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.shift && <Tag>Shift {r.shift}</Tag>}
          {r.machine && <Tag color="geekblue">{r.machine}</Tag>}
          {r.materialLot && <Tag color="cyan">Lot {r.materialLot}</Tag>}
          {r.woNo && <Tag>WO {r.woNo}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Input',
      dataIndex: 'input',
      key: 'input',
      width: 90,
      sorter: (a, b) => a.input - b.input,
      render: (v) => v?.toLocaleString() ?? 0,
    },
    {
      title: 'Leakage',
      dataIndex: 'leakageLoss',
      key: 'leak',
      width: 90,
      render: (v, r) => `${v} (${computeYieldFromLoss(r.input, v) ?? '—'}%)`,
    },
    {
      title: 'Flatness',
      dataIndex: 'flatnessLoss',
      key: 'flat',
      width: 90,
      render: (v, r) => `${v} (${computeYieldFromLoss(r.input, v) ?? '—'}%)`,
    },
    {
      title: 'PD',
      dataIndex: 'pressureDropLoss',
      key: 'pd',
      width: 90,
      render: (v, r) => `${v} (${computeYieldFromLoss(r.input, v) ?? '—'}%)`,
    },
    {
      title: 'TTV',
      dataIndex: 'ttvLoss',
      key: 'ttv',
      width: 90,
      render: (v, r) => `${v} (${computeYieldFromLoss(r.input, v) ?? '—'}%)`,
    },
    {
      title: 'Through Yield',
      key: 'ty',
      width: 120,
      sorter: (a, b) => (computeThroughYield(a) ?? -1) - (computeThroughYield(b) ?? -1),
      render: (_, r) => renderTyTag(computeThroughYield(r)),
    },
    {
      title: '',
      key: 'action',
      width: 96,
      fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)} size="small" />
          <Popconfirm title="確定刪除？" onConfirm={() => deleteRecord(r.id)} okText="刪除" cancelText="取消">
            <Button type="link" icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 16, color: '#003a8c' }}>
          Yield Records <Tag color="blue">{records.length} 筆</Tag>
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增資料列</Button>
      </div>

      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        bordered
        size="middle"
        scroll={{ x: 1200 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 筆` }}
      />

      <Modal
        title={editingId ? '編輯良率資料' : '新增良率資料'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        okText="儲存"
        cancelText="取消"
        destroyOnClose
        width={680}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="date" label="Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="month" label="Month (若未填 Date)" rules={[{ required: true, message: '請選擇月份' }]}>
                <Select options={MONTHS.map((m) => ({ label: m, value: m }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pn" label="PN (料號)" rules={[{ required: true, message: '請選擇料號' }]}>
                <Select
                  options={KNOWN_PNS.map((p) => ({ label: p, value: p }))}
                  showSearch
                  mode="tags"
                  maxCount={1}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="shift" label="Shift">
                <Select allowClear options={[
                  { label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'C', value: 'C' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="machine" label="Machine">
                <Input placeholder="例如 M-01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="operator" label="Operator">
                <Input placeholder="操作員代號" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="materialLot" label="Material Lot">
                <Input placeholder="原料批號" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="woNo" label="WO No.">
                <Input placeholder="工單號" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reworkCount" label="Rework Count">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="input" label="Input 數量" rules={[{ required: true, message: '請輸入投入數量' }]}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain style={{ fontSize: 13, color: '#888' }}>各 Defect Loss 數量</Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="leakageLoss" label="Leakage Loss" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="flatnessLoss" label="Flatness Loss" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pressureDropLoss" label="Pressure Drop Loss" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ttvLoss" label="TTV Loss" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
