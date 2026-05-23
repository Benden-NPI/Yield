import React from 'react';
import { Empty } from 'antd';

export const EmptyHint: React.FC<{ text?: string; height?: number | string }> = ({ text = '暫無資料，請先在「資料輸入」頁新增', height = 240 }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height }}>
    <Empty description={text} />
  </div>
);
