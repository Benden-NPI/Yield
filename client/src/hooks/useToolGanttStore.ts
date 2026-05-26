import { create } from 'zustand';
import type { ToolRecord } from '../components/toolgantt/types';

/**
 * Lightweight Zustand store for Tool PO Tracking data.
 * Allows both ToolGanttTab and SettingsTab to share the same records.
 *
 * Not persisted to localStorage — data comes from the Excel file (IndexedDB
 * handle) or SharePoint sync (in-memory only, re-sync on page load).
 */

interface ToolGanttStore {
  records: ToolRecord[] | null;   // null = not yet loaded; load via Power Automate URL sync
  source: string;                  // display label: file name or 'SharePoint'
  setRecords: (records: ToolRecord[], source: string) => void;
  clearRecords: () => void;
}

export const useToolGanttStore = create<ToolGanttStore>((set) => ({
  records: null,
  source: '',
  setRecords: (records, source) => set({ records, source }),
  clearRecords: () => set({ records: null, source: '' }),
}));
