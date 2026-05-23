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
        message="Process Analytics uses Measurement Data (piece-level continuous measurements). Enter data in Data Entry -> Measurement Data first."
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
