import React from 'react';
import type { RefObject } from 'react';
import { Button, Tooltip } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { usePdfExport } from '../hooks/usePdfExport';

interface PdfExportButtonProps {
  /** DOM subtree to capture into the PDF. */
  targetRef: RefObject<HTMLElement | null>;
  /** Filename prefix; the export adds `-YYYY-MM-DD.pdf`. */
  fileName: string;
  /** Button label, e.g. "Export Overview PDF". */
  label: string;
}

export const PdfExportButton: React.FC<PdfExportButtonProps> = ({ targetRef, fileName, label }) => {
  const { exportPdf, isExporting } = usePdfExport(targetRef, fileName);

  return (
    <Tooltip title={isExporting ? 'Generating PDF…' : 'Export the current view as a PDF report'}>
      <Button
        icon={<FilePdfOutlined />}
        onClick={exportPdf}
        loading={isExporting}
        style={{ borderColor: '#b7280f', color: '#b7280f' }}
      >
        {label}
      </Button>
    </Tooltip>
  );
};
