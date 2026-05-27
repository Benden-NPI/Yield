import { useCallback, useState } from 'react';
import type { ToolRecord } from '../components/toolgantt/types';

/**
 * Tool PO Tracking – SharePoint sync via a Power Automate HTTP-trigger Flow.
 *
 * The Flow is expected to:
 *   1. Be triggered via HTTP GET.
 *   2. Read the SharePoint Excel / List and return a JSON array in the Response.
 *
 * Expected row shape (column display names, tolerant matching):
 *   {
 *     "Item":        "1",           // tool sequence number
 *     "Tool":        "Brazing ...", // tool / equipment name
 *     "Vendor":      "ZTW",
 *     "Qty":         "2",
 *     "Move-In":     "2026-05-01", // OR "5/1/2026" etc.
 *     "Setup":       "2026-05-15",
 *     "Tuning":      "2026-06-01",
 *     "Qualify":     "2026-06-15",
 *   }
 *
 * The webhook URL is stored in localStorage so it never lands in source code.
 */

export const TOOL_GANTT_SP_URL_KEY = 'tool_gantt_sharepoint_webhook_url';

export function getToolGanttWebhookUrl(): string {
  try {
    return localStorage.getItem(TOOL_GANTT_SP_URL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToolGanttWebhookUrl(url: string): void {
  try {
    if (url) {
      localStorage.setItem(TOOL_GANTT_SP_URL_KEY, url);
    } else {
      localStorage.removeItem(TOOL_GANTT_SP_URL_KEY);
    }
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

type SPRow = Record<string, unknown>;

/** Normalize a key for tolerant comparison (lower-case, strip non-alphanumeric). */
function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Find the first matching value in `row` using normalized key candidates. */
function pickKey(row: SPRow, candidates: string[]): unknown {
  const wanted = candidates.map(normKey);
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(normKey(k))) return v;
  }
  return undefined;
}

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Parse a date value from SharePoint / Power Automate into "yyyy-mm-dd" or null.
 * Handles: ISO, "M/D/YYYY", "MM/DD/YYYY", "M/D" (current year), TBD/blank → null.
 */
function parseDate(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || /^(pending|tbd|n\/a|nan|—|-|#)/i.test(s)) return null;

  // ISO: yyyy-mm-dd (possibly followed by T...)
  const isoM = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoM) {
    const d = `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
    return d >= '2020-01-01' ? d : null;
  }

  // M/D/YYYY or MM/DD/YYYY
  const mdyM = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);
  if (mdyM) {
    const d = `${mdyM[3]}-${mdyM[1].padStart(2, '0')}-${mdyM[2].padStart(2, '0')}`;
    return d >= '2020-01-01' ? d : null;
  }

  // M/D (assume current year)
  const mdM = /^(\d{1,2})[\/](\d{1,2})$/.exec(s);
  if (mdM) {
    const mo = parseInt(mdM[1]), day = parseInt(mdM[2]);
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
      return `${CURRENT_YEAR}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Let JS engine try (for "May 1, 2026", "Fri May 01 2026", etc.)
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const ds = `${y}-${mo}-${dd}`;
    return ds >= '2020-01-01' ? ds : null;
  }

  return null;
}

/** Map a raw SharePoint row → ToolRecord (partial, missing fields use defaults). */
export function mapToolGanttRows(rows: SPRow[]): ToolRecord[] {
  return rows
    .map((row, idx): ToolRecord | null => {
      const toolVal = pickKey(row, ['Tool', 'ToolName', 'Tool Name', 'Equipment', '工具', 'tool']);
      if (!toolVal || !String(toolVal).trim()) return null;

      const itemVal  = pickKey(row, ['Item', 'Item #', 'Item#', 'No', 'No.', 'Seq', '#', '項次']);
      const vendorVal = pickKey(row, ['Vendor', 'Supplier', 'Manufacturer', '廠商', 'vendor']);
      const qtyVal    = pickKey(row, ['Qty', 'Quantity', 'Q\'ty', 'Count', '數量']);
      const moveInVal = pickKey(row, ['Move-In', 'MoveIn', 'Move In', 'ETD', 'ETA', 'Delivery', 'DeliveryDate', 'Delivery Date', '進廠', 'movein']);
      const setupVal  = pickKey(row, ['Setup', 'SetupDone', 'Setup Done', 'Setup Date', '安裝', 'setup']);
      const tuningVal = pickKey(row, ['Tuning', 'TuningDone', 'Tuning Done', 'Tuning Date', '調機', 'tuning']);
      const qualifyVal = pickKey(row, ['Qualify', 'QualifyDone', 'Qualify Done', 'Qualification', 'Qual', 'Qual Date', '認證', 'qualify', 'qualifyDone']);

      const qty = qtyVal != null ? parseInt(String(qtyVal)) : null;

      return {
        item:        itemVal != null ? String(itemVal).trim() : String(idx + 1),
        tool:        String(toolVal).trim().replace(/\n/g, ' '),
        vendor:      vendorVal != null ? String(vendorVal).trim() : '—',
        qty:         Number.isFinite(qty ?? NaN) ? qty : null,
        moveIn:      parseDate(moveInVal),
        setupDone:   parseDate(setupVal),
        tuningDone:  parseDate(tuningVal),
        qualifyDone: parseDate(qualifyVal),
      };
    })
    .filter((r): r is ToolRecord => r !== null);
}

export interface ToolGanttSyncResult {
  count: number;
}

export interface UseToolGanttSync {
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  sync: (url?: string) => Promise<ToolGanttSyncResult>;
}

export function useToolGanttSync(
  onData: (records: ToolRecord[]) => void,
): UseToolGanttSync {
  const [syncing, setSyncing]       = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastError, setLastError]   = useState<string | null>(null);

  const sync = useCallback(async (urlOverride?: string): Promise<ToolGanttSyncResult> => {
    const url = (urlOverride ?? getToolGanttWebhookUrl()).trim();
    if (!url) {
      const msg = '尚未設定 Tool Gantt Webhook URL';
      setLastError(msg);
      throw new Error(msg);
    }
    setSyncing(true);
    setLastError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const raw: unknown = await res.json();
      let rows: SPRow[];
      if (Array.isArray(raw)) {
        rows = raw as SPRow[];
      } else if (raw && typeof raw === 'object' && Array.isArray((raw as { value?: unknown }).value)) {
        rows = (raw as { value: SPRow[] }).value;
      } else {
        throw new Error('Response is not a JSON array');
      }

      // Debug aid
      if (rows.length > 0) {
        console.info('[ToolGanttSync] first row keys:', Object.keys(rows[0] as object));
      }

      const records = mapToolGanttRows(rows);
      onData(records);
      setLastSyncAt(Date.now());
      return { count: records.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [onData]);

  return { syncing, lastSyncAt, lastError, sync };
}
