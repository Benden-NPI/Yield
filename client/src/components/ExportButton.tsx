import React from 'react';
import { Button, Tooltip } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { useExcelExport } from '../hooks/useExcelExport';
import { useFilteredRecords } from '../hooks/useYieldData';

export const ExportButton: React.FC = () => {
  const { handleExport } = useExcelExport();
  const count = useFilteredRecords().length;

  return (
    <Tooltip title={count === 0 ? 'No data to export' : `Export ${count} records`}>
      <Button
        type="primary"
        icon={<FileExcelOutlined />}
        onClick={handleExport}
        disabled={count === 0}
        style={{ background: count > 0 ? '#217346' : undefined, borderColor: count > 0 ? '#217346' : undefined }}
      >
        Export Excel
      </Button>
    </Tooltip>
  );
};
