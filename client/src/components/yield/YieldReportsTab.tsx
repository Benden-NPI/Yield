import React, { useRef } from 'react';
import { Row, Col, Card, Space } from 'antd';
import { FilterPanel } from '../FilterPanel';
import { PdfExportButton } from '../PdfExportButton';
import { ThroughYieldTrend } from './ThroughYieldTrend';
import { ThroughYieldByPnChart } from './ThroughYieldByPnChart';
import { DefectFailureRatioChart } from './DefectFailureRatioChart';
import { ParetoChart } from './ParetoChart';
import { DefectHeatmap } from './DefectHeatmap';
import { DefectComposition } from './DefectComposition';

export const YieldReportsTab: React.FC = () => {
  const reportRef = useRef<HTMLDivElement | null>(null);

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16, borderColor: '#e6efff' }}>
        <FilterPanel />
      </Card>

      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 12 }}>
        <PdfExportButton
          targetRef={reportRef}
          fileName="yield-report"
          label="Export Yield Report PDF"
        />
      </Space>

      <div ref={reportRef} style={{ background: '#f4f6fa', padding: 1 }}>
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
    </div>
  );
};
