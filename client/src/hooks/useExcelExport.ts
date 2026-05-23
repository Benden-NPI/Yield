import { useCallback } from 'react';
import { useYieldStore } from './useYieldData';
import { exportToExcel } from '../utils/excelExport';

export function useExcelExport() {
  const { filteredRecords } = useYieldStore();

  const handleExport = useCallback(() => {
    const records = filteredRecords();
    exportToExcel(records);
  }, [filteredRecords]);

  return { handleExport };
}
