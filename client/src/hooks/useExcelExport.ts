import { useCallback } from 'react';
import { useFilteredRecords } from './useYieldData';
import { exportToExcel } from '../utils/excelExport';

export function useExcelExport() {
  const records = useFilteredRecords();

  const handleExport = useCallback(() => {
    exportToExcel(records);
  }, [records]);

  return { handleExport };
}
