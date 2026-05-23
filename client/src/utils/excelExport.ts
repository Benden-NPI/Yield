import * as XLSX from 'xlsx';
import type { YieldRecord } from '../types/yield';

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function exportToExcel(records: YieldRecord[]): void {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Raw data ---
  const headers = ['Month', 'PN', 'Leakage %', 'Flatness %', 'Pressure Drop %', 'TTV %', 'Input'];

  const rows = records.map((r) => [
    r.month,
    r.pn,
    r.leakage != null ? r.leakage / 100 : '',
    r.flatness != null ? r.flatness / 100 : '',
    r.pressureDrop != null ? r.pressureDrop / 100 : '',
    r.ttv != null ? r.ttv / 100 : '',
    r.input,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Apply percentage format to columns C–F (indices 2–5)
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 2; C <= 5; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddr];
      if (cell && typeof cell.v === 'number') {
        cell.z = '0.00%';
      }
    }
  }

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, // Month
    { wch: 16 }, // PN
    { wch: 14 }, // Leakage
    { wch: 14 }, // Flatness
    { wch: 18 }, // Pressure Drop
    { wch: 12 }, // TTV
    { wch: 10 }, // Input
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
        match?.leakage != null ? match.leakage / 100 : '',
        match?.flatness != null ? match.flatness / 100 : '',
        match?.pressureDrop != null ? match.pressureDrop / 100 : '',
        match?.ttv != null ? match.ttv / 100 : '',
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
