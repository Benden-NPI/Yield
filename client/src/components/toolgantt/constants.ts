import type { MilestonePhase } from './types';

export const MILESTONE_PHASES: MilestonePhase[] = [
  { key: 'moveIn',      color: '#3B82F6', dot: '#1D4ED8', label: 'Move-in'  },
  { key: 'setupDone',   color: '#8B5CF6', dot: '#6D28D9', label: 'Setup'    },
  { key: 'tuningDone',  color: '#F59E0B', dot: '#D97706', label: 'Tuning'   },
  { key: 'qualifyDone', color: '#10B981', dot: '#059669', label: 'Qualify'  },
];

export const DEFAULT_DEADLINE = '2026-06-02';
