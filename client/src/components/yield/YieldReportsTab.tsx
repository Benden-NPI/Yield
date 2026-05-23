import React, { useRef } from 'react';
import { Card, Space } from 'antd';
import { FilterPanel } from '../FilterPanel';
import { PdfExportButton } from '../PdfExportButton';
import { YieldReportsContent } from './YieldReportsContent';

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
        <YieldReportsContent />
      </div>
    </div>
  );
};
