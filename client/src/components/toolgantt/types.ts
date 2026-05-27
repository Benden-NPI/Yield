export interface StationRecord {
  station: string;           // "ColdPlate 4" | "Assembly 3"
  stationType: 'coldplate' | 'loop';
  stationNo: number;         // numeric sort key
  processStep: string;
  moveIn: string | null;     // yyyy-mm-dd
  setupDone: string | null;
  tuningDone: string | null;
  qualifyDone: string | null;
  tuningCriteria: string;
  qualifyCriteria: string;
}

export type MilestoneKey = 'moveIn' | 'setupDone' | 'tuningDone' | 'qualifyDone';

export interface MilestonePhase {
  key: MilestoneKey;
  color: string;
  dot: string;
  label: string;
}

export interface PeriodDef {
  fromKey: MilestoneKey;
  toKey: MilestoneKey;
  color: string;
  label: string;
  criteriaKey?: 'tuningCriteria' | 'qualifyCriteria';
}

// Kept for backward-compat with parse.ts (local Excel upload, currently unused)
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
