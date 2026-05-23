import React from 'react';
import { Empty } from 'antd';

export const EmptyHint: React.FC<{ text?: string; height?: number | string }> = ({ text = 'No data yet. Add records in Data Entry first', height = 240 }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height }}>
    <Empty description={text} />
  </div>
);
