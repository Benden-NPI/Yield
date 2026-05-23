import React from 'react';
import type { RefObject } from 'react';
import { Button, Tooltip } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { usePdfExport, type PdfExportOptions } from '../hooks/usePdfExport';

interface PdfExportButtonProps {
  /** Single DOM subtree to capture, OR an array of subtrees (one section per ref, each starting on a new page). */
  targetRef: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[];
  /** Filename prefix; the export adds `-YYYY-MM-DD.pdf`. */
  fileName: string;
  /** Button label, e.g. "Export Overview PDF". */
  label: string;
  /** Optional hooks to mount/unmount off-screen sections around capture. */
  beforeCapture?: PdfExportOptions['beforeCapture'];
  afterCapture?: PdfExportOptions['afterCapture'];
  prepareDelayMs?: PdfExportOptions['prepareDelayMs'];
}

export const PdfExportButton: React.FC<PdfExportButtonProps> = ({
  targetRef,
  fileName,
  label,
  beforeCapture,
  afterCapture,
  prepareDelayMs,
}) => {
  const { exportPdf, isExporting } = usePdfExport(targetRef, fileName, {
    beforeCapture,
    afterCapture,
    prepareDelayMs,
  });

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
