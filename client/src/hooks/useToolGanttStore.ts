import { create } from 'zustand';
import type { StationRecord } from '../components/toolgantt/types';

/**
 * Zustand store for Tool PO Tracking (station-by-station Gantt).
 * Station data: not persisted — comes from SharePoint sync via Power Automate.
 * Completed stations: persisted to localStorage so marks survive page refresh.
 */

/* ── Completed-station persistence ── */
const COMPLETED_KEY = 'tool_gantt_completed_stations';

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function saveCompleted(s: Set<string>): void {
  try { localStorage.setItem(COMPLETED_KEY, JSON.stringify([...s])); } catch {}
}

/* ── Store interface ── */
interface ToolGanttStore {
  stations: StationRecord[] | null;
  source: string;
  completedStations: Set<string>;
  setStations: (stations: StationRecord[], source: string) => void;
  clearStations: () => void;
  toggleCompleted: (stationName: string) => void;
  clearCompleted: () => void;
}

export const useToolGanttStore = create<ToolGanttStore>((set) => ({
  stations: null,
  source: '',
  completedStations: loadCompleted(),

  setStations: (stations, source) => set({ stations, source }),
  clearStations: () => set({ stations: null, source: '' }),

  toggleCompleted: (name) =>
    set((state) => {
      const next = new Set(state.completedStations);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      saveCompleted(next);
      return { completedStations: next };
    }),

  clearCompleted: () => {
    saveCompleted(new Set());
    set({ completedStations: new Set() });
  },
}));
