import React from 'react';
import { Row, Col, Alert } from 'antd';
import { SpcChart } from './SpcChart';
import { CpkPanel } from './CpkPanel';
import { ScatterPanel } from './ScatterPanel';
import { DistributionPanel } from './DistributionPanel';

export const ProcessAnalyticsTab: React.FC = () => {
  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Process Analytics 使用「量測資料」(逐片連續量測值)，請先到「資料輸入 → 量測資料」分頁鍵入。"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <SpcChart />
        </Col>
        <Col xs={24}>
          <CpkPanel />
        </Col>
        <Col xs={24} lg={14}>
          <ScatterPanel />
        </Col>
        <Col xs={24} lg={10}>
          <DistributionPanel />
        </Col>
      </Row>
    </div>
  );
};
