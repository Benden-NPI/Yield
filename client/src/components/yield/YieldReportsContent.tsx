import React from 'react';
import { Row, Col } from 'antd';
import { ThroughYieldTrend } from './ThroughYieldTrend';
import { ThroughYieldByPnChart } from './ThroughYieldByPnChart';
import { DefectFailureRatioChart } from './DefectFailureRatioChart';
import { ParetoChart } from './ParetoChart';
import { DefectHeatmap } from './DefectHeatmap';
import { DefectComposition } from './DefectComposition';

/**
 * Pure chart layout for the Yield Reports tab. No filter panel, no export
 * button — those are tab-level concerns. Re-used by `YieldReportsTab` for the
 * normal view and by `OverviewTab` for the combined PDF export so a single PDF
 * can contain both Overview and Yield Reports sections.
 */
export const YieldReportsContent: React.FC = () => (
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
);
