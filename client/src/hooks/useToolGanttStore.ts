import { create } from 'zustand';
import type { StationRecord } from '../components/toolgantt/types';

/**
 * Zustand store for Tool PO Tracking (station-by-station Gantt).
 *
 * stations + source → persisted to localStorage so data survives page refresh.
 * completedStations  → persisted to localStorage (separate key).
 */

/* ── Station data persistence ── */
const STATIONS_KEY = 'tool_gantt_stations';

function loadStations(): { stations: StationRecord[] | null; source: string } {
  try {
    const raw = localStorage.getItem(STATIONS_KEY);
    if (!raw) return { stations: null, source: '' };
    const parsed = JSON.parse(raw) as { stations: StationRecord[]; source: string };
    if (!Array.isArray(parsed.stations)) return { stations: null, source: '' };
    return { stations: parsed.stations, source: parsed.source ?? '' };
  } catch { return { stations: null, source: '' }; }
}

function saveStations(stations: StationRecord[] | null, source: string): void {
  try {
    if (stations === null) localStorage.removeItem(STATIONS_KEY);
    else localStorage.setItem(STATIONS_KEY, JSON.stringify({ stations, source }));
  } catch {}
}

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

const { stations: initStations, source: initSource } = loadStations();

export const useToolGanttStore = create<ToolGanttStore>((set) => ({
  stations: initStations,
  source: initSource,
  completedStations: loadCompleted(),

  setStations: (stations, source) => {
    saveStations(stations, source);
    set({ stations, source });
  },

  clearStations: () => {
    saveStations(null, '');
    set({ stations: null, source: '' });
  },

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
