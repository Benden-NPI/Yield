import { create } from 'zustand';
import type { StationRecord } from '../components/toolgantt/types';

/**
 * Zustand store for Tool PO Tracking / Process Readiness Gantt.
 *
 * stations + source      → persisted to localStorage (survives page refresh).
 * completedElements      → per-element (diamond / bar) gray marks, localStorage.
 * notes                  → per-bar text notes, localStorage.
 *
 * Key format:
 *   "<stationName>|ms|<phaseKey>"   — milestone diamond
 *   "<stationName>|bar|<periodIdx>" — period bar
 */

/* ── Station data ── */
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

/* ── Completed elements ── */
const ELEMENTS_KEY = 'tool_gantt_completed_elements';

function loadElements(): Set<string> {
  try {
    const raw = localStorage.getItem(ELEMENTS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function saveElements(s: Set<string>): void {
  try { localStorage.setItem(ELEMENTS_KEY, JSON.stringify([...s])); } catch {}
}

/* ── Per-bar notes ── */
const NOTES_KEY = 'tool_gantt_notes';

function loadNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch { return {}; }
}

function saveNotes(n: Record<string, string>): void {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(n)); } catch {}
}

/* ── Store interface ── */
interface ToolGanttStore {
  stations: StationRecord[] | null;
  source: string;
  completedElements: Set<string>;
  notes: Record<string, string>;
  setStations: (stations: StationRecord[], source: string) => void;
  clearStations: () => void;
  toggleElement: (key: string) => void;
  clearElements: () => void;
  setNote: (key: string, text: string) => void;
  clearNotes: () => void;
}

const { stations: initStations, source: initSource } = loadStations();

export const useToolGanttStore = create<ToolGanttStore>((set) => ({
  stations: initStations,
  source: initSource,
  completedElements: loadElements(),
  notes: loadNotes(),

  setStations: (stations, source) => {
    saveStations(stations, source);
    set({ stations, source });
  },

  clearStations: () => {
    saveStations(null, '');
    set({ stations: null, source: '' });
  },

  toggleElement: (key) =>
    set((state) => {
      const next = new Set(state.completedElements);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveElements(next);
      return { completedElements: next };
    }),

  clearElements: () => {
    saveElements(new Set());
    set({ completedElements: new Set() });
  },

  setNote: (key, text) =>
    set((state) => {
      const next = { ...state.notes };
      if (text.trim()) next[key] = text.trim();
      else delete next[key];
      saveNotes(next);
      return { notes: next };
    }),

  clearNotes: () => {
    saveNotes({});
    set({ notes: {} });
  },
}));
