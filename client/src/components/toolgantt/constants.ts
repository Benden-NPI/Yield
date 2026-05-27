import type { MilestonePhase, PeriodDef } from './types';

export const MILESTONE_PHASES: MilestonePhase[] = [
  { key: 'moveIn',      color: '#3B82F6', dot: '#1D4ED8', label: 'Move-in' },
  { key: 'setupDone',   color: '#8B5CF6', dot: '#6D28D9', label: 'Setup'   },
  { key: 'tuningDone',  color: '#F59E0B', dot: '#D97706', label: 'Tuning'  },
  { key: 'qualifyDone', color: '#10B981', dot: '#059669', label: 'Qualify' },
];

// Period bars: color matches the DESTINATION milestone ("leading-to" logic)
export const MILESTONE_PERIODS: PeriodDef[] = [
  {
    fromKey: 'moveIn',     toKey: 'setupDone',
    color: '#8B5CF6', label: 'Setup period',
    criteriaKey: undefined,
  },
  {
    fromKey: 'setupDone',  toKey: 'tuningDone',
    color: '#F59E0B', label: 'Tuning period',
    criteriaKey: 'tuningCriteria',
  },
  {
    fromKey: 'tuningDone', toKey: 'qualifyDone',
    color: '#10B981', label: 'Qualify period',
    criteriaKey: 'qualifyCriteria',
  },
];

export const DEFAULT_DEADLINE = '2026-09-30';
