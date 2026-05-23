import React, { useState } from 'react';
import {
  Table, Button, Form, InputNumber, Select, Popconfirm,
  Space, Typography, Tag,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useYieldStore } from '../hooks/useYieldData';
import type { YieldRecord } from '../types/yield';
import { MONTHS, KNOWN_PNS } from '../types/yield';

const { Text } = Typography;

type EditableRecord = YieldRecord & { isNew?: boolean };

const YieldCell: React.FC<{
  editing: boolean;
  dataIndex: keyof YieldRecord;
  children: React.ReactNode;
}> = ({ editing, dataIndex, children }) => {
  if (!editing) return <td>{children}</td>;

  let inputNode: React.ReactNode;

  if (dataIndex === 'month') {
    inputNode = (
      <Form.Item name={dataIndex} style={{ margin: 0 }} rules={[{ required: true }]}>
        <Select options={MONTHS.map((m) => ({ label: m, value: m }))} style={{ width: 110 }} />
      </Form.Item>
    );
  } else if (dataIndex === 'pn') {
    inputNode = (
      <Form.Item name={dataIndex} style={{ margin: 0 }} rules={[{ required: true }]}>
        <Select
          options={KNOWN_PNS.map((p) => ({ label: p, value: p }))}
          showSearch
          style={{ width: 150 }}
        />
      </Form.Item>
    );
  } else if (dataIndex === 'input') {
    inputNode = (
      <Form.Item name={dataIndex} style={{ margin: 0 }} rules={[{ required: true }]}>
        <InputNumber min={0} precision={0} style={{ width: 80 }} />
      </Form.Item>
    );
  } else {
    inputNode = (
      <Form.Item name={dataIndex} style={{ margin: 0 }}>
        <InputNumber min={0} max={100} precision={2} style={{ width: 80 }} addonAfter="%" />
      </Form.Item>
    );
  }

  return <td>{inputNode}</td>;
};

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
      updateRecord(id, values);
      setEditingId(null);
    } catch {
      // validation failed
    }
  };

  const handleAdd = () => {
    const newRecord = {
      month: MONTHS[new Date().getMonth()],
      pn: KNOWN_PNS[0],
      leakage: null,
      flatness: null,
      pressureDrop: null,
      ttv: null,
      input: 0,
    };
    addRecord(newRecord);
  };

  const columns: ColumnType<EditableRecord>[] = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 120,
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
      title: 'Leakage 良率',
      dataIndex: 'leakage',
      key: 'leakage',
      width: 130,
      sorter: (a, b) => (a.leakage ?? -1) - (b.leakage ?? -1),
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'leakage' } as any),
      render: (val) => val != null ? <Text type={val >= 95 ? 'success' : val >= 85 ? undefined : 'danger'}>{val}%</Text> : '—',
    },
    {
      title: 'Flatness 良率',
      dataIndex: 'flatness',
      key: 'flatness',
      width: 130,
      sorter: (a, b) => (a.flatness ?? -1) - (b.flatness ?? -1),
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'flatness' } as any),
      render: (val) => val != null ? <Text type={val >= 95 ? 'success' : val >= 85 ? undefined : 'danger'}>{val}%</Text> : '—',
    },
    {
      title: 'Pressure Drop 良率',
      dataIndex: 'pressureDrop',
      key: 'pressureDrop',
      width: 150,
      sorter: (a, b) => (a.pressureDrop ?? -1) - (b.pressureDrop ?? -1),
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'pressureDrop' } as any),
      render: (val) => val != null ? <Text type={val >= 95 ? 'success' : val >= 85 ? undefined : 'danger'}>{val}%</Text> : '—',
    },
    {
      title: 'TTV 良率',
      dataIndex: 'ttv',
      key: 'ttv',
      width: 110,
      sorter: (a, b) => (a.ttv ?? -1) - (b.ttv ?? -1),
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'ttv' } as any),
      render: (val) => val != null ? <Text type={val >= 95 ? 'success' : val >= 85 ? undefined : 'danger'}>{val}%</Text> : '—',
    },
    {
      title: 'Input 數量',
      dataIndex: 'input',
      key: 'input',
      width: 100,
      sorter: (a, b) => a.input - b.input,
      onCell: (record) => ({ editing: isEditing(record), dataIndex: 'input' } as any),
      render: (val) => val?.toLocaleString() ?? 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
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
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 筆` }}
        />
      </Form>
    </div>
  );
};
