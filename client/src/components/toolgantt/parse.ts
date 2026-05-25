import * as XLSX from 'xlsx';
import type { ToolRecord } from './types';

const YEAR = new Date().getFullYear();

function parseExcelDate(val: unknown): string[] {
  if (val == null) return [];
  if (val instanceof Date && !isNaN(val.getTime())) return [val.toISOString().slice(0, 10)];
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return [`${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`];
    return [];
  }
  const s = String(val).trim();
  if (!s || /^(pending|tbd|nan|#n\/a)/i.test(s)) return [];

  const dates: string[] = [];

  const isoRe = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = isoRe.exec(s)) !== null)
    dates.push(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);

  const mdyRe = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
  while ((m = mdyRe.exec(s)) !== null) {
    const ds = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    if (!dates.includes(ds)) dates.push(ds);
  }
  if (dates.length > 0) return dates;

  const shortRe = /\b(\d{1,2})[\/](\d{1,2})\b/g;
  while ((m = shortRe.exec(s)) !== null) {
    const month = parseInt(m[1]), day = parseInt(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
      dates.push(`${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  const endRe = /(\d{1,2})\/E\b/gi;
  while ((m = endRe.exec(s)) !== null) {
    const month = parseInt(m[1]);
    if (month >= 1 && month <= 12)
      dates.push(`${YEAR}-${String(month).padStart(2, '0')}-${new Date(YEAR, month, 0).getDate()}`);
  }
  return dates;
}

function parseSingleDate(val: unknown): string | null {
  const dates = parseExcelDate(val).filter(d => d >= '2020-01-01');
  return dates.length ? dates[0] : null;
}

export function parseExcelSheet(wb: XLSX.WorkBook): ToolRecord[] | null {
  const sheetName = wb.SheetNames.find(n => /PO\s*track/i.test(n)) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd',
  }) as (unknown[])[];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const row = rows[i];
    if (row?.some(c => String(c).trim() === 'Tool') && row.some(c => String(c).trim() === 'Item')) {
      headerIdx = i; break;
    }
  }
  if (headerIdx < 0) headerIdx = 1;

  const hdr = rows[headerIdx] as (string | null)[];
  const col = (re: RegExp) => hdr.findIndex(c => re.test(String(c ?? '').trim()));

  const colItem    = col(/^Item$/i);
  const colTool    = col(/^Tool$/i);
  const colQty     = col(/Q.*ty/i);
  const colVendor  = col(/Vendor/i);
  const colMoveIn  = col(/move.?in/i);
  const colSetup   = col(/setup/i);
  const colTuning  = col(/tuning/i);
  const colQualify = col(/qualif/i);
  const colEtd     = col(/ETD|ETA/i);

  if (colTool < 0) return null;

  const tools: ToolRecord[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const toolName = row[colTool];
    if (!toolName || !String(toolName).trim()) continue;

    const item   = colItem   >= 0 ? row[colItem]   : tools.length + 1;
    const qty    = colQty    >= 0 ? row[colQty]    : null;
    const vendor = colVendor >= 0 ? (row[colVendor] ?? '—') : '—';

    tools.push({
      item: String(item ?? tools.length + 1).trim(),
      tool: String(toolName).trim().replace(/\n/g, ' '),
      vendor: String(vendor).trim(),
      qty: qty ? parseInt(String(qty)) : null,
      moveIn:      parseSingleDate(colMoveIn  >= 0 ? row[colMoveIn]  : (colEtd >= 0 ? row[colEtd] : null)),
      setupDone:   parseSingleDate(colSetup   >= 0 ? row[colSetup]   : null),
      tuningDone:  parseSingleDate(colTuning  >= 0 ? row[colTuning]  : null),
      qualifyDone: parseSingleDate(colQualify >= 0 ? row[colQualify] : null),
    });
  }
  return tools;
}

export async function readExcelFile(file: File): Promise<ToolRecord[] | null> {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
  return parseExcelSheet(wb);
}
