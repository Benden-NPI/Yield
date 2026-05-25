import type { MilestonePhase, ToolRecord } from './types';

export const MILESTONE_PHASES: MilestonePhase[] = [
  { key: 'moveIn',      color: '#3B82F6', dot: '#1D4ED8', label: 'Move-in'  },
  { key: 'setupDone',   color: '#8B5CF6', dot: '#6D28D9', label: 'Setup'    },
  { key: 'tuningDone',  color: '#F59E0B', dot: '#D97706', label: 'Tuning'   },
  { key: 'qualifyDone', color: '#10B981', dot: '#059669', label: 'Qualify'  },
];

export const DEFAULT_DEADLINE = '2026-06-02';

export const DEFAULT_TOOLS: ToolRecord[] = [
  { item: '1',   tool: 'LiquidJet Diffusion Bond',               vendor: 'ZTW',            qty: 4, moveIn: '2026-04-15', setupDone: '2026-05-24', tuningDone: '2026-06-15', qualifyDone: '2026-06-30' },
  { item: '2',   tool: 'Stacking (Pick and Place)',               vendor: 'USUN',           qty: 2, moveIn: '2026-05-28', setupDone: '2026-06-15', tuningDone: '2026-06-30', qualifyDone: '2026-06-30' },
  { item: '2a',  tool: 'De-Stack',                                vendor: 'USUN',           qty: 1, moveIn: '2026-05-28', setupDone: '2026-06-15', tuningDone: '2026-06-30', qualifyDone: '2026-06-30' },
  { item: '3',   tool: 'Stacking with Tack welding for MCS',      vendor: 'USUN',           qty: 1, moveIn: '2026-07-13', setupDone: '2026-07-30', tuningDone: '2026-08-15', qualifyDone: '2026-08-15' },
  { item: '4',   tool: 'LiquidJet Clean Machine (w/ loader)',     vendor: 'Advcore',        qty: 1, moveIn: '2026-06-30', setupDone: '2026-07-15', tuningDone: '2026-07-30', qualifyDone: '2026-07-30' },
  { item: '5',   tool: 'LiquidJet Leakage Test (RD, 10k)',        vendor: 'HonPre',         qty: 1, moveIn: '2026-03-16', setupDone: '2026-04-08', tuningDone: '2026-04-20', qualifyDone: '2026-05-15' },
  { item: '5a',  tool: 'LiquidJet Leakage Test Semi Auto',        vendor: 'Collin',         qty: 1, moveIn: '2026-05-04', setupDone: '2026-05-20', tuningDone: '2026-05-30', qualifyDone: '2026-06-10' },
  { item: '6',   tool: 'V-Tech (Sampling/elongation)',            vendor: 'V-tech',         qty: 1, moveIn: '2026-04-23', setupDone: '2026-04-23', tuningDone: '2026-05-09', qualifyDone: '2026-05-15' },
  { item: '7',   tool: 'LiquidJet Thermal Test (RD)',             vendor: 'HonPre',         qty: 1, moveIn: '2026-04-08', setupDone: '2026-04-10', tuningDone: '2026-05-15', qualifyDone: '2026-05-30' },
  { item: '7a',  tool: 'LiquidJet Thermal Test single head',      vendor: 'HonPre',         qty: 1, moveIn: null,         setupDone: null,         tuningDone: null,         qualifyDone: null         },
  { item: '8',   tool: 'CT Scan for inline QC (FA)',              vendor: 'Zeiss',          qty: 1, moveIn: '2026-05-04', setupDone: '2026-05-24', tuningDone: '2026-06-15', qualifyDone: '2026-06-30' },
  { item: '9',   tool: 'AOI system for LiquidJet',               vendor: 'FRORE',          qty: 2, moveIn: '2026-04-30', setupDone: null,         tuningDone: null,         qualifyDone: null         },
  { item: '10a', tool: '2.5D inspection (etching, FineMatx)',     vendor: 'V-tech',         qty: 1, moveIn: '2026-04-30', setupDone: null,         tuningDone: null,         qualifyDone: null         },
  { item: '10b', tool: '2.5D inspection (etching, TGx)',          vendor: 'V-tech',         qty: 1, moveIn: '2026-04-30', setupDone: null,         tuningDone: null,         qualifyDone: null         },
  { item: '11',  tool: 'Baking after Thermal Test (100k)',        vendor: 'C-Sun',          qty: 1, moveIn: '2026-05-30', setupDone: '2026-05-30', tuningDone: '2026-06-10', qualifyDone: '2026-06-15' },
  { item: '11a', tool: 'Baking after Thermal Test (NPI)',         vendor: 'C-Sun',          qty: 1, moveIn: '2026-05-30', setupDone: '2026-05-30', tuningDone: '2026-06-10', qualifyDone: '2026-06-15' },
  { item: '12',  tool: 'Brazing Machine',                        vendor: 'ZTW',            qty: 1, moveIn: '2026-05-05', setupDone: '2026-05-30', tuningDone: '2026-06-20', qualifyDone: '2026-06-30' },
  { item: '13',  tool: 'Soldering + Reflow Machine (NPI)',        vendor: 'HaoBao',         qty: 1, moveIn: '2026-05-12', setupDone: '2026-05-30', tuningDone: '2026-06-20', qualifyDone: '2026-06-30' },
  { item: '14',  tool: 'Inline Brazing',                         vendor: 'Standard+U-Sun', qty: 2, moveIn: null,         setupDone: null,         tuningDone: null,         qualifyDone: null         },
  { item: '15',  tool: 'Singulation',                            vendor: 'Hymoson',        qty: 1, moveIn: '2026-05-15', setupDone: '2026-05-30', tuningDone: '2026-06-15', qualifyDone: '2026-06-30' },
  { item: '16',  tool: 'Packing Machine',                        vendor: '—',              qty: 2, moveIn: null,         setupDone: null,         tuningDone: null,         qualifyDone: null         },
  { item: '17',  tool: 'Lifter',                                 vendor: '—',              qty: 3, moveIn: '2026-05-15', setupDone: null,         tuningDone: null,         qualifyDone: null         },
  { item: '18',  tool: 'Facility (include warehouse)',           vendor: '—',              qty: 1, moveIn: '2026-05-20', setupDone: null,         tuningDone: null,         qualifyDone: null         },
  { item: '31',  tool: 'Burst test',                             vendor: 'HD',             qty: 2, moveIn: '2026-05-15', setupDone: '2026-05-30', tuningDone: '2026-06-10', qualifyDone: '2026-06-15' },
];
