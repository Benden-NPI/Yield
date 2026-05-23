import React from 'react';
import { Row, Col, Card } from 'antd';
import { FilterPanel } from '../FilterPanel';
import { ThroughYieldTrend } from './ThroughYieldTrend';
import { ThroughYieldByPnChart } from './ThroughYieldByPnChart';
import { DefectFailureRatioChart } from './DefectFailureRatioChart';
import { ParetoChart } from './ParetoChart';
import { DefectHeatmap } from './DefectHeatmap';
import { DefectComposition } from './DefectComposition';

export const YieldReportsTab: React.FC = () => {
  return (
    <div>
      <Card size="small" style={{ marginBottom: 16, borderColor: '#e6efff' }}>
        <FilterPanel />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <ThroughYieldTrend />
        </Col>
        <Col xs={24}>
          <ThroughYieldByPnChart />
        </Col>
        <Col xs={24} lg={14}>
          <ParetoChart />
        </Col>
        <Col xs={24} lg={10}>
          <DefectHeatmap />
        </Col>
        <Col xs={24}>
          <DefectFailureRatioChart />
        </Col>
        <Col xs={24}>
          <DefectComposition />
        </Col>
      </Row>
    </div>
  );
};
