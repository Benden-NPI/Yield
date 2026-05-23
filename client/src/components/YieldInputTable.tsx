import React, { useState } from 'react';
import {
  Table, Button, Form, InputNumber, Select, Popconfirm,
  Space, Typography, Tag,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useYieldStore, computeYieldFromLoss } from '../hooks/useYieldData';
import type { YieldRecord } from '../types/yield';
import { MONTHS, KNOWN_PNS } from '../types/yield';

const { Text } = Typography;

type EditableRecord = YieldRecord;
type EditableDataIndex =
  | 'month'
  | 'pn'
  | 'input'
  | 'leakageLoss'
  | 'flatnessLoss'
  | 'pressureDropLoss'
  | 'ttvLoss';

function clampLoss(input: number, loss: number): number {
  if (!Number.isFinite(input) || input <= 0) return Math.max(0, Math.round(loss));
  return Math.min(Math.max(0, Math.round(loss)), Math.round(input));
}

const YieldCell: React.FC<{
  editing: boolean;
  dataIndex: EditableDataIndex;
  children: React.ReactNode;
}> = ({ editing, dataIndex, children }) => {
  if (!editing) return <td>{children}</td>;

  if (dataIndex === 'month') {
    return (
      <td>
        <Form.Item name={dataIndex} style={{ margin: 0 }} rules={[{ required: true }]}>
          <Select options={MONTHS.map((m) => ({ label: m, value: m }))} style={{ width: 110 }} />
        </Form.Item>
      </td>
    );
  }

  if (dataIndex === 'pn') {
    return (
      <td>
        <Form.Item name={dataIndex} style={{ margin: 0 }} rules={[{ required: true }]}>
          <Select
            options={KNOWN_PNS.map((p) => ({ label: p, value: p }))}
            showSearch
            style={{ width: 150 }}
          />
        </Form.Item>
      </td>
    );
  }

  return (
    <td>
      <Form.Item name={dataIndex} style={{ margin: 0 }} rules={[{ required: true }]}>
        <InputNumber min={0} precision={0} style={{ width: 96 }} />
      </Form.Item>
    </td>
  );
};

function renderYieldTag(value: number | null): React.ReactNode {
  if (value == null) return '—';
  const status: 'success' | 'warning' | 'error' = value >= 95 ? 'success' : value >= 85 ? 'warning' : 'error';
  const color = status === 'success' ? 'green' : status === 'warning' ? 'gold' : 'red';
  return <Tag color={color}>{value}%</Tag>;
}

export const YieldInputTable: React.FC = () => {
  const { filteredRecords, addRecord, updateRecord, deleteRecord } = useYieldStore();
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const records = filteredRecords();

  const isEditing = (record: EditableRecord) => record.id === editingId;

  const startEdit = (record: EditableRecord) => {
    form.setFieldsValue({ ...record });
    setEditingId(record.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    try {
      const values = await form.validateFields();
      const normalizedInput = Math.max(0, Math.round(Number(values.input) || 0));
      const updates: Partial<Omit<YieldRecord, 'id'>> = {
        month: values.month,
        pn: values.pn,
        input: normalizedInput,
        leakageLoss: clampLoss(normalizedInput, Number(values.leakageLoss) || 0),
        flatnessLoss: clampLoss(normalizedInput, Number(values.flatnessLoss) || 0),
        pressureDropLoss: clampLoss(normalizedInput, Number(values.pressureDropLoss) || 0),
        ttvLoss: clampLoss(normalizedInput, Number(values.ttvLoss) || 0),
      };
      updateRecord(id, updates);
      setEditingId(null);
    } catch {
      // validation failed
    }
  };

  const handleAdd = () => {
    addRecord({
      month: MONTHS[new Date().getMonth()],
      pn: KNOWN_PNS[0],
      input: 0,
      leakageLoss: 0,
      flatnessLoss: 0,
      pressureDropLoss: 0,
      ttvLoss: 0,
    });
  };

  const columns: ColumnType<EditableRecord>[] = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 110,
      sorter: (a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month),
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'month' } as any),
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'PN (料號)',
      dataIndex: 'pn',
      key: 'pn',
      width: 160,
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'pn' } as any),
      render: (val) => <Text code>{val}</Text>,
    },
    {
      title: 'Input',
      dataIndex: 'input',
      key: 'input',
      width: 96,
      sorter: (a, b) => a.input - b.input,
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'input' } as any),
      render: (val) => val?.toLocaleString() ?? 0,
    },
    {
      title: 'Leakage Loss',
      dataIndex: 'leakageLoss',
      key: 'leakageLoss',
      width: 118,
      sorter: (a, b) => a.leakageLoss - b.leakageLoss,
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'leakageLoss' } as any),
    },
    {
      title: 'Leakage 良率',
      key: 'leakageYield',
      width: 112,
      sorter: (a, b) => (computeYieldFromLoss(a.input, a.leakageLoss) ?? -1) - (computeYieldFromLoss(b.input, b.leakageLoss) ?? -1),
      render: (_, record) => renderYieldTag(computeYieldFromLoss(record.input, record.leakageLoss)),
    },
    {
      title: 'Flatness Loss',
      dataIndex: 'flatnessLoss',
      key: 'flatnessLoss',
      width: 118,
      sorter: (a, b) => a.flatnessLoss - b.flatnessLoss,
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'flatnessLoss' } as any),
    },
    {
      title: 'Flatness 良率',
      key: 'flatnessYield',
      width: 112,
      sorter: (a, b) => (computeYieldFromLoss(a.input, a.flatnessLoss) ?? -1) - (computeYieldFromLoss(b.input, b.flatnessLoss) ?? -1),
      render: (_, record) => renderYieldTag(computeYieldFromLoss(record.input, record.flatnessLoss)),
    },
    {
      title: 'Pressure Drop Loss',
      dataIndex: 'pressureDropLoss',
      key: 'pressureDropLoss',
      width: 148,
      sorter: (a, b) => a.pressureDropLoss - b.pressureDropLoss,
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'pressureDropLoss' } as any),
    },
    {
      title: 'Pressure Drop 良率',
      key: 'pressureDropYield',
      width: 130,
      sorter: (a, b) => (computeYieldFromLoss(a.input, a.pressureDropLoss) ?? -1) - (computeYieldFromLoss(b.input, b.pressureDropLoss) ?? -1),
      render: (_, record) => renderYieldTag(computeYieldFromLoss(record.input, record.pressureDropLoss)),
    },
    {
      title: 'TTV Loss',
      dataIndex: 'ttvLoss',
      key: 'ttvLoss',
      width: 102,
      sorter: (a, b) => a.ttvLoss - b.ttvLoss,
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'ttvLoss' } as any),
    },
    {
      title: 'TTV 良率',
      key: 'ttvYield',
      width: 100,
      sorter: (a, b) => (computeYieldFromLoss(a.input, a.ttvLoss) ?? -1) - (computeYieldFromLoss(b.input, b.ttvLoss) ?? -1),
      render: (_, record) => renderYieldTag(computeYieldFromLoss(record.input, record.ttvLoss)),
    },
    {
      title: '操作',
      key: 'action',
      width: 96,
      fixed: 'right',
      render: (_: unknown, record: EditableRecord) => {
        if (isEditing(record)) {
          return (
            <Space>
              <Button
                type="link"
                icon={<CheckOutlined />}
                onClick={() => saveEdit(record.id)}
                size="small"
              />
              <Button
                type="link"
                icon={<CloseOutlined />}
                onClick={cancelEdit}
                size="small"
                danger
              />
            </Space>
          );
        }
        return (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => startEdit(record)}
              size="small"
              disabled={editingId !== null}
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
                disabled={editingId !== null}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 16 }}>
          良率資料表 <Tag>{records.length} 筆</Tag>
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增資料列
        </Button>
      </div>
      <Form form={form} component={false}>
        <Table
          components={{ body: { cell: YieldCell } }}
          dataSource={records}
          columns={columns}
          rowKey="id"
          bordered
          size="middle"
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 筆` }}
        />
      </Form>
    </div>
  );
};
