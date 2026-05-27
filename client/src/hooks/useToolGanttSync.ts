import { useCallback, useState } from 'react';
import type { StationRecord } from '../components/toolgantt/types';

/**
 * Tool PO Tracking – SharePoint sync via a Power Automate HTTP GET trigger.
 *
 * The Flow is expected to:
 *   1. Be triggered via HTTP GET.
 *   2. Read the Control Plan Excel (List rows present in a table).
 *   3. Return a JSON array in the Response action.
 *
 * Expected column names (Control Plan "Process Flow" sheet):
 *   "Station for 300x300"          → station name ("ColdPlate 4", "Assembly 3")
 *   "Process Step"                 → process description
 *   "Move-in day"                  → yyyy-mm-dd or free text
 *   "Setup Completed (HW)"         → yyyy-mm-dd
 *   "Tuning Completed (Short loop)"→ yyyy-mm-dd
 *   "Tuning Criteria"              → criteria text
 *   "Qualify Completed (Qual lot)" → yyyy-mm-dd
 *   "Qualify Criteria"             → criteria text
 *
 * The webhook URL is stored in localStorage so it never lands in source code.
 */

export const TOOL_GANTT_SP_URL_KEY = 'tool_gantt_sharepoint_webhook_url';

export function getToolGanttWebhookUrl(): string {
  try { return localStorage.getItem(TOOL_GANTT_SP_URL_KEY) ?? ''; } catch { return ''; }
}

export function setToolGanttWebhookUrl(url: string): void {
  try {
    if (url) localStorage.setItem(TOOL_GANTT_SP_URL_KEY, url);
    else      localStorage.removeItem(TOOL_GANTT_SP_URL_KEY);
  } catch { /* ignore */ }
}

type SPRow = Record<string, unknown>;

/** Lower-case + strip non-alphanumeric for tolerant column name matching. */
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
 * Parse a single date string → "yyyy-mm-dd" or null.
 * Handles: ISO, "M/D/YYYY", "M/D", TBD/blank → null.
 */
function parseSingleDate(s: string): string | null {
  s = s.trim();
  if (!s || /^(pending|tbd|n\/a|nan|—|-|#|00:00:00)/i.test(s)) return null;

  const isoM = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoM) {
    const d = `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
    return d >= '2020-01-01' ? d : null;
  }
  // yyyy/mm/dd
  const ymdM = /(\d{4})[\/](\d{1,2})[\/](\d{1,2})/.exec(s);
  if (ymdM) {
    const d = `${ymdM[1]}-${ymdM[2].padStart(2,'0')}-${ymdM[3].padStart(2,'0')}`;
    return d >= '2020-01-01' ? d : null;
  }
  // M/D/YYYY
  const mdyM = /(\d{1,2})[\/](\d{1,2})[\/](\d{4})/.exec(s);
  if (mdyM) {
    const d = `${mdyM[3]}-${mdyM[1].padStart(2,'0')}-${mdyM[2].padStart(2,'0')}`;
    return d >= '2020-01-01' ? d : null;
  }
  // M/D (current year)
  const mdM = /^(\d{1,2})[\/](\d{1,2})$/.exec(s);
  if (mdM) {
    const mo = parseInt(mdM[1]), day = parseInt(mdM[2]);
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31)
      return `${CURRENT_YEAR}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
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

/**
 * Parse a possibly multi-line / multi-revision date cell.
 * e.g. "1st ETD: 2026/4/15\n2nd ETD: 2026/5/11\n3rd ETD: 2026/5/31"
 * Returns the LAST valid date found (most recent revision).
 */
function parseDate(val: unknown): string | null {
  if (val == null) return null;
  const raw = String(val);
  // Split by newline or semicolon
  const parts = raw.split(/[\n;]+/);
  let last: string | null = null;
  for (const part of parts) {
    const d = parseSingleDate(part);
    if (d) last = d;
  }
  return last;
}

/** Extract station type and numeric order from a station label. */
function parseStationInfo(station: string): { stationType: 'coldplate' | 'loop'; stationNo: number } {
  const cp = /^ColdPlate\s*(\d+)/i.exec(station);
  if (cp) return { stationType: 'coldplate', stationNo: parseInt(cp[1]) };
  const asm = /^Assembly\s*(\d+)/i.exec(station);
  if (asm) return { stationType: 'loop', stationNo: parseInt(asm[1]) };
  return { stationType: 'coldplate', stationNo: 0 };
}

/**
 * Map raw SharePoint rows (from Control Plan Excel) → StationRecord[].
 * Rows without a station name are skipped.
 * Result is sorted: ColdPlate ascending → Loop ascending.
 */
export function mapStationRows(rows: SPRow[]): StationRecord[] {
  const stations: StationRecord[] = rows
    .map((row): StationRecord | null => {
      const stationVal = pickKey(row, [
        'Station for 300x300', 'Station', 'Station Name', 'StationFor300x300',
      ]);
      if (!stationVal || !String(stationVal).trim()) return null;

      const station = String(stationVal).trim();
      const { stationType, stationNo } = parseStationInfo(station);

      const stepVal = pickKey(row, ['Process Step', 'ProcessStep', 'Step', 'Process']);
      const moveInVal  = pickKey(row, ['Move-in day', 'Move-in Day', 'Moveinday', 'MoveIn', 'Move-in', 'ETD', 'ETA']);
      const setupVal   = pickKey(row, [
        'Setup Completed (HW)', 'Setup Completed\n(HW)', 'Setup Completed HW',
        'SetupCompletedHW', 'Setup', 'SetupDone',
      ]);
      const tuningVal  = pickKey(row, [
        'Tuning Completed (Short loop)', 'Tuning Completed\n(Short loop)',
        'Tuning Completed Short loop', 'TuningCompletedShortloop',
        'Tuning Completed', 'Tuning', 'TuningDone',
      ]);
      const tCritVal   = pickKey(row, ['Tuning Criteria', 'TuningCriteria']);
      const qualifyVal = pickKey(row, [
        'Qualify Completed (Qual lot)', 'Qualify Completed\n(Qual lot)',
        'Qualify Completed Qual lot', 'QualifyCompletedQuallot',
        'Qualify Completed', 'Qualify', 'QualifyDone',
      ]);
      const qCritVal   = pickKey(row, ['Qualify Criteria', 'QualifyCriteria']);

      return {
        station,
        stationType,
        stationNo,
        processStep: stepVal != null ? String(stepVal).trim().replace(/\n/g, ' ') : '',
        moveIn:      parseDate(moveInVal),
        setupDone:   parseDate(setupVal),
        tuningDone:  parseDate(tuningVal),
        qualifyDone: parseDate(qualifyVal),
        tuningCriteria:  tCritVal  != null ? String(tCritVal).trim()  : '',
        qualifyCriteria: qCritVal  != null ? String(qCritVal).trim()  : '',
      };
    })
    .filter((r): r is StationRecord => r !== null);

  // Sort: ColdPlate (ascending) → Loop (ascending)
  return stations.sort((a, b) => {
    if (a.stationType !== b.stationType)
      return a.stationType === 'coldplate' ? -1 : 1;
    return a.stationNo - b.stationNo;
  });
}

export interface ToolGanttSyncResult { count: number }

export interface UseToolGanttSync {
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  sync: (url?: string) => Promise<ToolGanttSyncResult>;
}

export function useToolGanttSync(
  onData: (stations: StationRecord[]) => void,
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000); // 90 s hard cap
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });

      const text = await res.text();
      console.info('[ToolGanttSync] HTTP', res.status, '| body preview:', text.slice(0, 300));

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} | body: ${text.slice(0, 200)}`);

      let raw: unknown;
      try { raw = JSON.parse(text); }
      catch { throw new Error(`Response is not valid JSON. Raw: ${text.slice(0, 300)}`); }

      let rows: SPRow[];
      if (Array.isArray(raw)) {
        rows = raw as SPRow[];
      } else if (raw && typeof raw === 'object' && Array.isArray((raw as { value?: unknown }).value)) {
        rows = (raw as { value: SPRow[] }).value;
      } else {
        throw new Error(`Response is not a JSON array. Got: ${text.slice(0, 300)}`);
      }

      if (rows.length > 0) {
        console.info('[ToolGanttSync] first row keys:', Object.keys(rows[0] as object));
        console.info('[ToolGanttSync] first row sample:', JSON.stringify(rows[0]).slice(0, 300));
      } else {
        console.warn('[ToolGanttSync] Power Automate returned 0 rows');
      }

      const stations = mapStationRows(rows);
      onData(stations);
      setLastSyncAt(Date.now());
      return { count: stations.length };
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const msg = isAbort
        ? '同步逾時（超過 90 秒），請確認 Power Automate Flow 是否正常運作'
        : err instanceof Error ? err.message : String(err);
      setLastError(msg);
      throw new Error(msg);
    } finally {
      clearTimeout(timeoutId);
      setSyncing(false);
    }
  }, [onData]);

  return { syncing, lastSyncAt, lastError, sync };
}
