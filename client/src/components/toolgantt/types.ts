export interface ToolRecord {
  item: string;
  tool: string;
  vendor: string;
  qty: number | null;
  moveIn: string | null;
  setupDone: string | null;
  tuningDone: string | null;
  qualifyDone: string | null;
}

export type MilestoneKey = 'moveIn' | 'setupDone' | 'tuningDone' | 'qualifyDone';
export type FilterMode = 'all' | 'normal' | 'tbd' | 'late';
export type SortMode = 'item' | 'qualify';

export interface MilestonePhase {
  key: MilestoneKey;
  color: string;
  dot: string;
  label: string;
}
