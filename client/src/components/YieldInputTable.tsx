import React, { useState } from 'react';
import {
  Table, Button, Form, InputNumber, Select, Popconfirm,
  Space, Typography, Tag, Modal, Divider,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useYieldStore, computeYieldFromLoss } from '../hooks/useYieldData';
import type { YieldRecord } from '../types/yield';
import { MONTHS, KNOWN_PNS } from '../types/yield';

const { Text } = Typography;

type EditableRecord = YieldRecord;

function clampLoss(input: number, loss: number): number {
  if (!Number.isFinite(input) || input <= 0) return Math.max(0, Math.round(loss));
  return Math.min(Math.max(0, Math.round(loss)), Math.round(input));
}

function renderYieldTag(value: number | null): React.ReactNode {
  if (value == null) return '—';
  const status: 'success' | 'warning' | 'error' = value >= 95 ? 'success' : value >= 85 ? 'warning' : 'error';
  const color = status === 'success' ? 'green' : status === 'warning' ? 'gold' : 'red';
  return <Tag color={color}>{value}%</Tag>;
}

export const YieldInputTable: React.FC = () => {
  const { filteredRecords, addRecord, updateRecord, deleteRecord } = useYieldStore();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const records = filteredRecords();

  const openAdd = () => {
    form.setFieldsValue({
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

  const openEdit = (record: EditableRecord) => {
    form.setFieldsValue({ ...record });
    setEditingId(record.id);
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const normalizedInput = Math.max(0, Math.round(Number(values.input) || 0));
      const data: Omit<YieldRecord, 'id'> = {
        month: values.month,
        pn: values.pn,
        input: normalizedInput,
        leakageLoss: clampLoss(normalizedInput, Number(values.leakageLoss) || 0),
        flatnessLoss: clampLoss(normalizedInput, Number(values.flatnessLoss) || 0),
        pressureDropLoss: clampLoss(normalizedInput, Number(values.pressureDropLoss) || 0),
        ttvLoss: clampLoss(normalizedInput, Number(values.ttvLoss) || 0),
      };
      if (editingId) {
        updateRecord(editingId, data);
      } else {
        addRecord(data);
      }
      setModalOpen(false);
    } catch {
      // validation failed
    }
  };

  const handleModalCancel = () => {
    setModalOpen(false);
  };

  const columns: ColumnType<EditableRecord>[] = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 120,
      sorter: (a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month),
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'PN (料號)',
      dataIndex: 'pn',
      key: 'pn',
      width: 160,
      render: (val) => <Text code>{val}</Text>,
    },
    {
      title: 'Leakage 良率',
      key: 'leakageYield',
      width: 120,
      sorter: (a, b) => (computeYieldFromLoss(a.input, a.leakageLoss) ?? -1) - (computeYieldFromLoss(b.input, b.leakageLoss) ?? -1),
      render: (_, record) => renderYieldTag(computeYieldFromLoss(record.input, record.leakageLoss)),
    },
    {
      title: 'Flatness 良率',
      key: 'flatnessYield',
      width: 120,
      sorter: (a, b) => (computeYieldFromLoss(a.input, a.flatnessLoss) ?? -1) - (computeYieldFromLoss(b.input, b.flatnessLoss) ?? -1),
      render: (_, record) => renderYieldTag(computeYieldFromLoss(record.input, record.flatnessLoss)),
    },
    {
      title: 'Pressure Drop 良率',
      key: 'pressureDropYield',
      width: 140,
      sorter: (a, b) => (computeYieldFromLoss(a.input, a.pressureDropLoss) ?? -1) - (computeYieldFromLoss(b.input, b.pressureDropLoss) ?? -1),
      render: (_, record) => renderYieldTag(computeYieldFromLoss(record.input, record.pressureDropLoss)),
    },
    {
      title: 'TTV 良率',
      key: 'ttvYield',
      width: 110,
      sorter: (a, b) => (computeYieldFromLoss(a.input, a.ttvLoss) ?? -1) - (computeYieldFromLoss(b.input, b.ttvLoss) ?? -1),
      render: (_, record) => renderYieldTag(computeYieldFromLoss(record.input, record.ttvLoss)),
    },
    {
      title: 'Input 數量',
      dataIndex: 'input',
      key: 'input',
      width: 100,
      sorter: (a, b) => a.input - b.input,
      render: (val) => val?.toLocaleString() ?? 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 96,
      fixed: 'right',
      render: (_: unknown, record: EditableRecord) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
            size="small"
          />
          <Popconfirm
            title="確定刪除此資料列？"
            onConfirm={() => deleteRecord(record.id)}
            okText="刪除"
            cancelText="取消"
          >
            <Button
              type="link"
              icon={<DeleteOutlined />}
              danger
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 16 }}>
          良率資料表 <Tag>{records.length} 筆</Tag>
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          新增資料列
        </Button>
      </div>

      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        bordered
        size="middle"
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 筆` }}
      />

      <Modal
        title={editingId ? '編輯良率資料' : '新增良率資料'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="儲存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="month" label="Month" rules={[{ required: true, message: '請選擇月份' }]}>
            <Select options={MONTHS.map((m) => ({ label: m, value: m }))} />
          </Form.Item>
          <Form.Item name="pn" label="PN (料號)" rules={[{ required: true, message: '請選擇料號' }]}>
            <Select
              options={KNOWN_PNS.map((p) => ({ label: p, value: p }))}
              showSearch
            />
          </Form.Item>
          <Form.Item name="input" label="Input 數量" rules={[{ required: true, message: '請輸入投入數量' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Divider plain style={{ fontSize: 13, color: '#888' }}>
            各 Defect Loss 數量
          </Divider>
          <Form.Item name="leakageLoss" label="Leakage Loss 數量" rules={[{ required: true, message: '請輸入 Leakage Loss 數量' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="flatnessLoss" label="Flatness Loss 數量" rules={[{ required: true, message: '請輸入 Flatness Loss 數量' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pressureDropLoss" label="Pressure Drop Loss 數量" rules={[{ required: true, message: '請輸入 Pressure Drop Loss 數量' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ttvLoss" label="TTV Loss 數量" rules={[{ required: true, message: '請輸入 TTV Loss 數量' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
