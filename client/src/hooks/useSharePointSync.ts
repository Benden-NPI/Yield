import { useCallback, useState } from 'react';
import type { YieldRecord } from '../types/yield';
import { MONTHS } from '../types/yield';
import { useYieldStore } from './useYieldData';

/**
 * SharePoint read-only sync via a Power Automate HTTP-trigger Flow.
 *
 * The Flow is expected to:
 *   1. Be triggered via HTTP POST.
 *   2. Read the SharePoint list and produce a JSON array body in the Response action.
 *
 * Expected SharePoint row shape (column display names in the Response JSON):
 *   {
 *     "ItemInternalId": "<guid>",     // used as the record id
 *     "PN":             "<string>",
 *     "Date":           "yyyy-mm-dd", // OR "Month": "May"
 *     "Input":          "<number-as-string>",
 *     "Leak Fail":      "<number-as-string>",
 *     "Flatness Fail":  "<number-as-string>",
 *     "Pressure drop Fail": "<number-as-string>",
 *     "TTV Fail":       "<number-as-string>"
 *     // Yield ratio columns (Leakage / Flatness / Pressure drop / TTV) are ignored;
 *     // the frontend recomputes yield from input/loss.
 *   }
 *
 * The webhook URL is stored in localStorage (NOT in source code) since it
 * contains a `sig=` token. Each user pastes it once in the Settings tab.
 */

export const SHAREPOINT_URL_STORAGE_KEY = 'yield_sharepoint_webhook_url';

export function getStoredWebhookUrl(): string {
  try {
    return localStorage.getItem(SHAREPOINT_URL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredWebhookUrl(url: string): void {
  try {
    if (url) {
      localStorage.setItem(SHAREPOINT_URL_STORAGE_KEY, url);
    } else {
      localStorage.removeItem(SHAREPOINT_URL_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

type SharePointRow = Record<string, unknown>;

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalize a key for tolerant comparison:
 *   - lower-case
 *   - strip all non-alphanumeric chars (spaces, underscores, SharePoint
 *     hex escapes like `_x0020_`, `OData__x0044_` prefixes, etc.)
 */
function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Find the first value in `row` whose key — after normalization — matches any
 * of the given normalized candidates. Returns `undefined` if none match.
 *
 * SharePoint / Power Automate often mangles column names:
 *   - "Date" (reserved-ish) → internal name `Date0` or `OData__x0044_ate`
 *   - "Leak Fail" → `Leak_x0020_Fail`
 *   - display vs. internal name mismatch depending on how the Flow projects
 *     the row (Get items vs. Select / Compose).
 * So we match by a normalized form rather than exact string.
 */
function pickKey(row: SharePointRow, candidates: string[]): unknown {
  const wanted = candidates.map(normKey);
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(normKey(k))) {
      return v;
    }
  }
  return undefined;
}

/** Candidate column names for the row's Date field. */
const DATE_KEY_CANDIDATES = [
  'Date',
  'Date0',
  'Date1',
  'OData__x0044_ate',
  'EventDate',
  'Event Date',
  'RecordDate',
  'Record Date',
  'ReportDate',
  'Report Date',
  'DateTime',
  'Date Time',
  'ProductionDate',
  'Production Date',
  'Created',
  'Modified',
  'Title',
  '日期',
];

function deriveMonth(row: SharePointRow): { month: string; date?: string } {
  // Prefer explicit Date (yyyy-mm-dd or ISO); fall back to Month name.
  const rawDateVal = pickKey(row, DATE_KEY_CANDIDATES);
  const rawDate = rawDateVal != null ? String(rawDateVal).trim() : '';
  if (rawDate) {
    // Fast path: "2026-05-01" or full ISO "2026-05-01T00:00:00Z".
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate);
    if (m) {
      const monthIdx = Number(m[2]) - 1;
      if (monthIdx >= 0 && monthIdx <= 11) {
        return { month: MONTHS[monthIdx], date: `${m[1]}-${m[2]}-${m[3]}` };
      }
    }
    // Fallback: let the JS engine parse other formats Power Automate / SharePoint
    // may emit (e.g. "5/1/2026", "5/1/2026 12:00:00 AM", "2026/05/01",
    // "Fri, 01 May 2026 00:00:00 GMT"). Use UTC getters so a date-only value
    // isn't shifted across the day boundary by the local timezone.
    const d = new Date(rawDate);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const mo = d.getUTCMonth();
      const day = d.getUTCDate();
      if (mo >= 0 && mo <= 11) {
        const mm = String(mo + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return { month: MONTHS[mo], date: `${y}-${mm}-${dd}` };
      }
    }
  }
  const rawMonthVal = pickKey(row, ['Month']);
  const rawMonth = rawMonthVal != null ? String(rawMonthVal).trim() : '';
  if (rawMonth && MONTHS.includes(rawMonth)) {
    return { month: rawMonth };
  }
  return { month: '' };
}

export function mapSharePointRows(rows: SharePointRow[]): Array<Partial<YieldRecord>> {
  return rows.map((row) => {
    const { month, date } = deriveMonth(row);
    const id = pickKey(row, ['ItemInternalId', 'ID', 'Id']);
    const pn = pickKey(row, ['PN', 'P/N', 'PartNumber']);
    return {
      id: id != null ? String(id) : undefined,
      pn: pn != null ? String(pn) : '',
      month,
      date,
      input: toNumber(pickKey(row, ['Input'])),
      leakageLoss: toNumber(pickKey(row, ['Leak Fail', 'LeakFail', 'Leakage Fail'])),
      flatnessLoss: toNumber(pickKey(row, ['Flatness Fail', 'FlatnessFail'])),
      pressureDropLoss: toNumber(
        pickKey(row, ['Pressure drop Fail', 'PressureDropFail', 'Pressure Drop Fail']),
      ),
      ttvLoss: toNumber(pickKey(row, ['TTV Fail', 'TTVFail'])),
    };
  });
}

export interface SyncResult {
  count: number;
  missingMonth: number;
}

export interface UseSharePointSync {
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  sync: (url?: string) => Promise<SyncResult>;
}

export function useSharePointSync(): UseSharePointSync {
  const replaceRecords = useYieldStore((s) => s.replaceRecords);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const sync = useCallback(async (urlOverride?: string): Promise<SyncResult> => {
    const url = (urlOverride ?? getStoredWebhookUrl()).trim();
    if (!url) {
      const msg = '尚未設定 SharePoint Webhook URL';
      setLastError(msg);
      throw new Error(msg);
    }
    setSyncing(true);
    setLastError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const raw: unknown = await res.json();
      // Accept either a bare array or { value: [...] }.
      let rows: SharePointRow[];
      if (Array.isArray(raw)) {
        rows = raw as SharePointRow[];
      } else if (raw && typeof raw === 'object' && Array.isArray((raw as { value?: unknown }).value)) {
        rows = (raw as { value: SharePointRow[] }).value;
      } else {
        throw new Error('Response is not a JSON array');
      }
      const mapped = mapSharePointRows(rows);
      const missingMonth = mapped.filter((r) => !r.month).length;
      // Debug aid: when Date mapping fails, log the actual keys + a JSON dump
      // of the first row so the user can see what SharePoint named the column.
      // We stringify so the console shows real values instead of a collapsed
      // `Array(n)` / `Object` placeholder that the user can't expand from a
      // copy-pasted log.
      if (rows.length > 0 && missingMonth > 0) {
        const firstRow = rows[0] as object;
        const keys = Object.keys(firstRow);
        let sample = '';
        try {
          sample = JSON.stringify(firstRow);
        } catch {
          sample = '[unserializable]';
        }
        console.warn(
          `[SharePoint sync] missing Date on ${missingMonth} of ${mapped.length} rows. ` +
            `First raw row keys = [${keys.join(', ')}] first raw row = ${sample}`,
        );
      }
      replaceRecords(mapped);
      const now = Date.now();
      setLastSyncAt(now);
      return { count: mapped.length, missingMonth };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [replaceRecords]);

  return { syncing, lastSyncAt, lastError, sync };
}
