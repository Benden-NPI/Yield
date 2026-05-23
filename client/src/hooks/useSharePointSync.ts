import { useCallback, useState } from 'react';
import type { YieldRecord } from '../types/yield';
import { MONTHS } from '../types/yield';
import { useYieldStore } from './useYieldData';

/**
 * SharePoint read-only sync via a Power Automate HTTP-trigger Flow.
 *
 * The Flow is expected to:
 *   1. Be triggered via HTTP (POST, manual trigger).
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

interface SharePointRow {
  ItemInternalId?: string;
  PN?: string;
  Date?: string;
  Month?: string;
  Input?: string | number;
  'Leak Fail'?: string | number;
  'Flatness Fail'?: string | number;
  'Pressure drop Fail'?: string | number;
  'TTV Fail'?: string | number;
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deriveMonth(row: SharePointRow): { month: string; date?: string } {
  // Prefer explicit Date (yyyy-mm-dd or ISO); fall back to Month name.
  const rawDate = row.Date ? String(row.Date).trim() : '';
  if (rawDate) {
    // Accept "2026-05-01" or full ISO "2026-05-01T00:00:00Z".
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate);
    if (m) {
      const monthIdx = Number(m[2]) - 1;
      if (monthIdx >= 0 && monthIdx <= 11) {
        return { month: MONTHS[monthIdx], date: `${m[1]}-${m[2]}-${m[3]}` };
      }
    }
  }
  const rawMonth = row.Month ? String(row.Month).trim() : '';
  if (rawMonth && MONTHS.includes(rawMonth)) {
    return { month: rawMonth };
  }
  return { month: '' };
}

export function mapSharePointRows(rows: SharePointRow[]): Array<Partial<YieldRecord>> {
  return rows.map((row) => {
    const { month, date } = deriveMonth(row);
    return {
      id: row.ItemInternalId ? String(row.ItemInternalId) : undefined,
      pn: row.PN ? String(row.PN) : '',
      month,
      date,
      input: toNumber(row.Input),
      leakageLoss: toNumber(row['Leak Fail']),
      flatnessLoss: toNumber(row['Flatness Fail']),
      pressureDropLoss: toNumber(row['Pressure drop Fail']),
      ttvLoss: toNumber(row['TTV Fail']),
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
