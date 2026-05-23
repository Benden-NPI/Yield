import React from 'react';
import { Card, Typography, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface Props {
  title: string;
  subtitle?: string;
  info?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  bodyPadding?: string | number;
}

export const ChartCard: React.FC<Props> = ({ title, subtitle, info, extra, children, bodyPadding = '16px 20px' }) => {
  return (
    <Card
      data-pdf-block="true"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderColor: '#e6efff' }}
      styles={{ body: { padding: bodyPadding } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space size={8} align="baseline">
          <Title level={5} style={{ margin: 0, color: '#003a8c' }}>{title}</Title>
          {subtitle && <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>}
          {info && (
            <Tooltip title={info}>
              <InfoCircleOutlined style={{ color: '#1677ff' }} />
            </Tooltip>
          )}
        </Space>
        {extra}
      </div>
      {children}
    </Card>
  );
};
