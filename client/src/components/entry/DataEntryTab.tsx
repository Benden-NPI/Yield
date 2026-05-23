import React from 'react';
import { Tabs, Card } from 'antd';
import { TableOutlined, ExperimentOutlined } from '@ant-design/icons';
import { YieldInputTable } from './YieldInputTable';
import { MeasurementInputTable } from './MeasurementInputTable';

export const DataEntryTab: React.FC = () => {
  return (
    <Card style={{ borderColor: '#e6efff' }} styles={{ body: { padding: '16px 20px' } }}>
      <Tabs
        defaultActiveKey="yield"
        items={[
          {
            key: 'yield',
            label: <span><TableOutlined /> 月度良率資料</span>,
            children: <YieldInputTable />,
          },
          {
            key: 'meas',
            label: <span><ExperimentOutlined /> 量測資料 (Process Analytics 用)</span>,
            children: <MeasurementInputTable />,
          },
        ]}
      />
    </Card>
  );
};
