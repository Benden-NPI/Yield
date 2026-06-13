import { create } from 'zustand';
import type { StationRecord } from '../components/toolgantt/types';
import { enqueuePush, getUserName } from './useReadinessRemote';

/**
 * Zustand store for Process Readiness Gantt.
 *
 * completedElements: Record<string, { completedAt: string; by?: string }>
 *   — upgraded from Set<string> in v1.12.0 to carry audit-trail metadata.
 *   — loadElements() migrates old string-array format transparently.
 *   — write-back: each toggle/note fires enqueuePush() (fire-and-forget).
 *
 * Key format:
 *   "<stationName>|ms|<phaseKey>"   — milestone diamond
 *   "<stationName>|bar|<periodIdx>" — period bar
 */

export interface ElementStatus {
  completedAt: string;
  by?: string;
}

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

function loadElements(): Record<string, ElementStatus> {
  try {
    const raw = localStorage.getItem(ELEMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Migration: v1.11 stored string[] — upgrade to Record<string, ElementStatus>
    if (Array.isArray(parsed)) {
      const now = new Date().toISOString();
      const migrated: Record<string, ElementStatus> = {};
      for (const key of parsed as string[]) {
        migrated[key] = { completedAt: now };
      }
      return migrated;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, ElementStatus>;
    }
    return {};
  } catch { return {}; }
}

function saveElements(m: Record<string, ElementStatus>): void {
  try { localStorage.setItem(ELEMENTS_KEY, JSON.stringify(m)); } catch {}
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
  completedElements: Record<string, ElementStatus>;
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
      const next = { ...state.completedElements };
      const nowCompleted = !(key in next);
      if (nowCompleted) {
        next[key] = { completedAt: new Date().toISOString(), by: getUserName() || undefined };
      } else {
        delete next[key];
      }
      saveElements(next);
      enqueuePush({
        key,
        completed: nowCompleted,
        note: state.notes[key] ?? '',
        by: getUserName(),
        updatedAt: new Date().toISOString(),
      });
      return { completedElements: next };
    }),

  clearElements: () => {
    saveElements({});
    set({ completedElements: {} });
  },

  setNote: (key, text) =>
    set((state) => {
      const next = { ...state.notes };
      if (text.trim()) next[key] = text.trim();
      else delete next[key];
      saveNotes(next);
      enqueuePush({
        key,
        completed: key in state.completedElements,
        note: text.trim(),
        by: getUserName(),
        updatedAt: new Date().toISOString(),
      });
      return { notes: next };
    }),

  clearNotes: () => {
    saveNotes({});
    set({ notes: {} });
  },
}));
