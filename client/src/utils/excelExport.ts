import * as XLSX from 'xlsx';
import type { YieldRecord } from '../types/yield';
import { computeYieldFromLoss } from '../hooks/useYieldData';

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function exportToExcel(records: YieldRecord[]): void {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Raw data ---
  const headers = [
    'Month', 'PN', 'Input',
    'Leakage Loss', 'Leakage Yield %',
    'Flatness Loss', 'Flatness Yield %',
    'Pressure Drop Loss', 'Pressure Drop Yield %',
    'TTV Loss', 'TTV Yield %',
  ];

  const rows = records.map((r) => [
    r.month,
    r.pn,
    r.input,
    r.leakageLoss,
    computeYieldFromLoss(r.input, r.leakageLoss) != null ? (computeYieldFromLoss(r.input, r.leakageLoss) as number) / 100 : '',
    r.flatnessLoss,
    computeYieldFromLoss(r.input, r.flatnessLoss) != null ? (computeYieldFromLoss(r.input, r.flatnessLoss) as number) / 100 : '',
    r.pressureDropLoss,
    computeYieldFromLoss(r.input, r.pressureDropLoss) != null ? (computeYieldFromLoss(r.input, r.pressureDropLoss) as number) / 100 : '',
    r.ttvLoss,
    computeYieldFromLoss(r.input, r.ttvLoss) != null ? (computeYieldFromLoss(r.input, r.ttvLoss) as number) / 100 : '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Apply percentage format to yield columns E/G/I/K
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (const C of [4, 6, 8, 10]) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddr];
      if (cell && typeof cell.v === 'number') {
        cell.z = '0.00%';
      }
    }
  }

  // Column widths
  ws['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Yield Data');

  // --- Sheet 2: Summary pivot by Month x PN ---
  const months = Array.from(new Set(records.map((r) => r.month)));
  const pns = Array.from(new Set(records.map((r) => r.pn)));

  const summaryHeaders = ['Month', ...pns.flatMap((p) => [
    `${p} Leakage%`, `${p} Flatness%`, `${p} PD%`, `${p} TTV%`,
  ])];

  const summaryRows = months.map((month) => {
    const row: (string | number)[] = [month];
    for (const pn of pns) {
      const match = records.find((r) => r.month === month && r.pn === pn);
      row.push(
        match ? ((computeYieldFromLoss(match.input, match.leakageLoss) ?? 0) / 100) : '',
        match ? ((computeYieldFromLoss(match.input, match.flatnessLoss) ?? 0) / 100) : '',
        match ? ((computeYieldFromLoss(match.input, match.pressureDropLoss) ?? 0) / 100) : '',
        match ? ((computeYieldFromLoss(match.input, match.ttvLoss) ?? 0) / 100) : '',
      );
    }
    return row;
  });

  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);

  // Apply percentage format to all non-Month columns
  const sumRange = XLSX.utils.decode_range(wsSummary['!ref'] ?? 'A1');
  for (let R = 1; R <= sumRange.e.r; R++) {
    for (let C = 1; C <= sumRange.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = wsSummary[cellAddr];
      if (cell && typeof cell.v === 'number') {
        cell.z = '0.00%';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Yield Summary');

  const fileName = `Yield_Report_${formatDate(new Date())}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
