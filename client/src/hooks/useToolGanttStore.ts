import { create } from 'zustand';
import type { StationRecord } from '../components/toolgantt/types';

/**
 * Zustand store for Tool PO Tracking (station-by-station Gantt).
 * Not persisted — data comes from SharePoint sync via Power Automate.
 * null = not yet loaded (shows empty-state prompt in ToolGanttTab).
 */

interface ToolGanttStore {
  stations: StationRecord[] | null;
  source: string;
  setStations: (stations: StationRecord[], source: string) => void;
  clearStations: () => void;
}

export const useToolGanttStore = create<ToolGanttStore>((set) => ({
  stations: null,
  source: '',
  setStations: (stations, source) => set({ stations, source }),
  clearStations: () => set({ stations: null, source: '' }),
}));
