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

/**
 * Parse a Power Automate error body and return a human-readable message.
 * Detects Excel file-lock errors specifically so the user knows to close the file.
 */
function parsePowerAutomateError(body: string, status: number): string {
  const lower = body.toLowerCase();

  // Excel file locked / checked out / being edited
  if (
    lower.includes('resourcelocked') ||
    lower.includes('locked for editing') ||
    lower.includes('checked out') ||
    lower.includes('lockedbyuser') ||
    lower.includes('file is locked') ||
    lower.includes('editmode') ||
    (lower.includes('lock') && lower.includes('excel'))
  ) {
    return (
      'Excel 檔案目前被占用（OneDrive 同步中或有人正在開啟編輯）。\n' +
      '請確認 Control_Plan.xlsx 已關閉，或等 OneDrive 同步完成後再試。'
    );
  }

  // Power Automate / SharePoint throttling
  if (
    lower.includes('throttl') ||
    lower.includes('too many requests') ||
    status === 429
  ) {
    return 'SharePoint / Power Automate 請求頻率過高（Throttling），請稍候幾分鐘後再同步。';
  }

  // Flow not enabled / trigger disabled
  if (
    lower.includes('workflowtriggerisnotenabled') ||
    lower.includes('trigger is not enabled') ||
    lower.includes('flow is disabled')
  ) {
    return 'Power Automate Flow 未啟用，請到 Power Automate 網頁確認 Flow 狀態為「開啟」。';
  }

  // Try to extract the inner "message" field from PA error JSON
  try {
    const obj = JSON.parse(body) as Record<string, unknown>;
    const inner =
      (obj.error as { message?: string } | undefined)?.message ||
      (obj.message as string | undefined) ||
      '';
    if (inner) return `HTTP ${status}：${inner}`;
  } catch { /* not JSON */ }

  return `HTTP ${status} | ${body.slice(0, 250)}`;
}

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

  // Excel serial number (e.g. 46000). Power Automate sometimes returns raw
  // numeric cell values instead of formatted date strings.
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial > 40000 && serial < 60000) {
      const d = new Date((serial - 25569) * 86_400_000);
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const ds = `${y}-${mo}-${dd}`;
      return ds >= '2020-01-01' && ds <= '2035-12-31' ? ds : null;
    }
  }

  const isoM = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoM) {
    const d = `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
    return d >= '2020-01-01' && d <= '2035-12-31' ? d : null;
  }
  // yyyy/mm/dd
  const ymdM = /(\d{4})[\/](\d{1,2})[\/](\d{1,2})/.exec(s);
  if (ymdM) {
    const d = `${ymdM[1]}-${ymdM[2].padStart(2,'0')}-${ymdM[3].padStart(2,'0')}`;
    return d >= '2020-01-01' && d <= '2035-12-31' ? d : null;
  }
  // M/D/YYYY
  const mdyM = /(\d{1,2})[\/](\d{1,2})[\/](\d{4})/.exec(s);
  if (mdyM) {
    const d = `${mdyM[3]}-${mdyM[1].padStart(2,'0')}-${mdyM[2].padStart(2,'0')}`;
    return d >= '2020-01-01' && d <= '2035-12-31' ? d : null;
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
    return ds >= '2020-01-01' && ds <= '2035-12-31' ? ds : null;
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

/**
 * Extract station type and numeric order from a station label.
 * Returns null for non-matching names (Source, IQC, REL Lab, offline, etc.)
 * so they are filtered out of the Gantt.
 */
function parseStationInfo(station: string): { stationType: 'coldplate' | 'base' | 'loop'; stationNo: number } | null {
  const cp = /ColdPlate\s*(\d+)/i.exec(station);
  if (cp) return { stationType: 'coldplate', stationNo: parseInt(cp[1]) };
  const base = /Base\s*(\d+)/i.exec(station);
  if (base) return { stationType: 'base', stationNo: parseInt(base[1]) };
  const asm = /Assembly\s*(\d+)/i.exec(station);
  if (asm) return { stationType: 'loop', stationNo: parseInt(asm[1]) };
  return null; // Unrecognised station (Source, IQC, REL Lab, offline …) → skip
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
      const info = parseStationInfo(station);
      if (!info) return null; // Skip Source, IQC, REL Lab, offline, etc.
      const { stationType, stationNo } = info;

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
      const qCritVal         = pickKey(row, ['Qualify Criteria', 'QualifyCriteria']);
      const surveyToolVal    = pickKey(row, [
        'Owner - Survey Tool', 'Owner-Survey Tool', 'Survey Tool Owner',
        'OwnerSurveyTool', 'Survey Tool', 'SurveyTool',
      ]);
      const eeVal            = pickKey(row, [
        'Owner - EE', 'Owner-EE', 'EE Owner', 'OwnerEE', 'EE',
      ]);
      const npiVal           = pickKey(row, [
        'Owner - NPI', 'Owner-NPI', 'NPI Owner', 'OwnerNPI', 'NPI',
      ]);

      return {
        station,
        stationType,
        stationNo,
        processStep:     stepVal        != null ? String(stepVal).trim().replace(/\n/g, ' ') : '',
        moveIn:          parseDate(moveInVal),
        setupDone:       parseDate(setupVal),
        tuningDone:      parseDate(tuningVal),
        qualifyDone:     parseDate(qualifyVal),
        tuningCriteria:  tCritVal       != null ? String(tCritVal).trim()       : '',
        qualifyCriteria: qCritVal       != null ? String(qCritVal).trim()       : '',
        ownerSurveyTool: surveyToolVal  != null ? String(surveyToolVal).trim()  : '',
        ownerEE:         eeVal          != null ? String(eeVal).trim()          : '',
        ownerNPI:        npiVal         != null ? String(npiVal).trim()         : '',
      };
    })
    .filter((r): r is StationRecord => r !== null);

  const TYPE_ORDER: Record<string, number> = { coldplate: 0, base: 1, loop: 2 };
  return stations.sort((a, b) => {
    const od = (TYPE_ORDER[a.stationType] ?? 9) - (TYPE_ORDER[b.stationType] ?? 9);
    if (od !== 0) return od;
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

      if (!res.ok) throw new Error(parsePowerAutomateError(text, res.status));

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
        const allKeys = Object.keys(rows[0] as object);
        console.info('[ToolGanttSync] first row keys:', allKeys);
        console.info('[ToolGanttSync] first row sample:', JSON.stringify(rows[0]).slice(0, 500));

        // Debug owner columns: show which keys matched and what values were found
        const ownerCandidates = {
          'Owner-SurveyTool': ['Owner - Survey Tool','Owner-Survey Tool','Survey Tool Owner','OwnerSurveyTool','Survey Tool','SurveyTool'],
          'Owner-EE':         ['Owner - EE','Owner-EE','EE Owner','OwnerEE','EE'],
          'Owner-NPI':        ['Owner - NPI','Owner-NPI','NPI Owner','OwnerNPI','NPI'],
        };
        for (const [label, cands] of Object.entries(ownerCandidates)) {
          const wanted = cands.map(normKey);
          const matched = allKeys.filter(k => wanted.includes(normKey(k)));
          const sampleVal = matched.length > 0
            ? String((rows[0] as Record<string,unknown>)[matched[0]] ?? '(empty)')
            : '(no match)';
          console.info(`[ToolGanttSync] ${label}: matched key=${matched[0] ?? 'none'}, sample="${sampleVal}"`);
        }
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
        ? '同步逾時（超過 90 秒）。常見原因：\n' +
          '① Control_Plan.xlsx 被 OneDrive 同步或有人開啟編輯中\n' +
          '② Power Automate Flow 長時間未使用需冷啟動（再試一次通常會成功）\n' +
          '③ Flow 未啟用，請至 Power Automate 確認'
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
