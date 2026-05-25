import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ToolRecord } from './types';
import { MILESTONE_PHASES } from './constants';

/* ── Date / layout helpers ── */
const DAY = 86_400_000;

function buildWeeks(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  let cur = new Date(start);
  while (cur < end) { weeks.push(new Date(cur)); cur = new Date(cur.getTime() + 7 * DAY); }
  return weeks;
}

function buildMonths(start: Date, end: Date, weeks: Date[]): { label: string; span: number }[] {
  const months: { label: string; span: number }[] = [];
  let mCur = new Date(start);
  while (mCur < end) {
    const mStart = new Date(mCur);
    const mEnd   = new Date(mCur.getFullYear(), mCur.getMonth() + 1, 1);
    const wStart = weeks.findIndex(w => w >= mStart);
    const wEnd   = weeks.findIndex(w => w >= mEnd);
    const span   = (wEnd === -1 ? weeks.length : wEnd) - (wStart === -1 ? 0 : wStart);
    if (span > 0) months.push({ label: `${mStart.getFullYear()}/${mStart.getMonth() + 1}`, span });
    mCur = mEnd;
  }
  return months;
}

function allDates(t: ToolRecord): Date[] {
  return MILESTONE_PHASES
    .map(p => t[p.key])
    .filter(Boolean)
    .map(d => new Date(d!))
    .filter(d => !isNaN(d.getTime()));
}

function computeRange(tools: ToolRecord[]) {
  let minT = Infinity, maxT = -Infinity;
  for (const t of tools) {
    for (const d of allDates(t)) {
      minT = Math.min(minT, d.getTime());
      maxT = Math.max(maxT, d.getTime());
    }
  }
  if (!isFinite(minT)) {
    const s = new Date('2026-02-01');
    const e = new Date('2026-09-01');
    const weeks  = buildWeeks(s, e);
    const months = buildMonths(s, e, weeks);
    return { start: s, end: e, weeks, months };
  }
  const start = new Date(minT); start.setDate(1);
  const end   = new Date(maxT); end.setMonth(end.getMonth() + 2); end.setDate(1);
  const weeks  = buildWeeks(start, end);
  const months = buildMonths(start, end, weeks);
  return { start, end, weeks, months };
}

function fmtDate(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
}

/* ── Types ── */
interface TooltipState { x: number; y: number; name: string; dates: string; milestones: string }

interface Props {
  tools: ToolRecord[];
  deadline: string;
}

/* ── Component ── */
const GanttTable: React.FC<Props> = ({ tools, deadline }) => {
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const { weeks, months } = useMemo(() => computeRange(tools), [tools]);

  const today    = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const deadlineD = useMemo(() => { const d = new Date(deadline); d.setHours(0, 0, 0, 0); return d; }, [deadline]);

  // Scroll sync: body drives header
  useEffect(() => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const onScroll = () => { head.scrollLeft = body.scrollLeft; };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, [weeks]);

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Frozen header ── */}
      <div ref={headRef} style={{ overflow: 'hidden' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thToolStyle} rowSpan={2}>Tool</th>
              {months.map((m, i) => (
                <th key={i} colSpan={m.span} style={thMonthStyle}>{m.label}</th>
              ))}
            </tr>
            <tr>
              {weeks.map((w, i) => (
                <th key={i} style={thWeekStyle}>{w.getDate()}</th>
              ))}
            </tr>
          </thead>
          <tbody />
        </table>
      </div>

      {/* ── Scrollable body ── */}
      <div
        ref={bodyRef}
        style={{ overflowX: 'auto', overflowY: 'visible' }}
        onMouseMove={e => {
          const bar = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
          if (!bar) { setTip(null); return; }
          const [name, dates, milestones] = (bar.dataset.tip ?? '').split('|');
          setTip({ x: e.clientX + 14, y: e.clientY + 14, name, dates, milestones });
        }}
        onMouseLeave={() => setTip(null)}
      >
        <table style={tableStyle}>
          <tbody>
            {tools.map((t, ti) => {
              const dates    = allDates(t);
              const hasDate  = dates.length > 0;
              const allLate  = hasDate && dates.every(d => d > deadlineD);
              const msTip    = MILESTONE_PHASES
                .filter(p => t[p.key])
                .map(p => `${p.label}: ${fmtDate(t[p.key]!)}`)
                .join(' | ');

              return (
                <tr key={ti}>
                  {/* Tool name cell */}
                  <td style={{
                    ...tdToolStyle,
                    color: !hasDate ? '#DC2626' : allLate ? '#2563EB' : '#1F2937',
                  }}>
                    <span style={{ fontSize: '.62rem', color: '#9CA3AF', marginRight: 4 }}>#{t.item}</span>
                    {t.tool}
                    {t.vendor && t.vendor !== '—' && (
                      <span style={{ fontSize: '.6rem', background: '#F1F5F9', color: '#64748B', borderRadius: 3, padding: '1px 5px', marginLeft: 4 }}>
                        {t.vendor}
                      </span>
                    )}
                    {t.qty && (
                      <span style={{ fontSize: '.6rem', color: '#94A3B8', marginLeft: 3 }}>×{t.qty}</span>
                    )}
                    {!hasDate && <span style={tbdTagStyle}>TBD</span>}
                    {allLate  && <span style={lateTagStyle}>LATE</span>}
                  </td>

                  {/* Gantt cells */}
                  {weeks.map((wStart, wi) => {
                    const wEnd = new Date(wStart.getTime() + 7 * DAY);
                    const elements: React.ReactNode[] = [];

                    // Today line
                    if (today >= wStart && today < wEnd) {
                      const pct = ((today.getTime() - wStart.getTime()) / (7 * DAY)) * 100;
                      elements.push(
                        <div key="today" style={{ ...refLineStyle, left: `${pct}%`, background: '#D1D5DB' }} />
                      );
                    }
                    // Deadline line
                    if (deadlineD >= wStart && deadlineD < wEnd) {
                      const pct = ((deadlineD.getTime() - wStart.getTime()) / (7 * DAY)) * 100;
                      elements.push(
                        <div key="dl" style={{ ...refLineStyle, left: `${pct}%`, background: '#EF4444' }} />
                      );
                    }

                    // Phase period bars
                    MILESTONE_PHASES.forEach((phase, pi) => {
                      if (pi >= MILESTONE_PHASES.length - 1) return;
                      const dA = t[phase.key] ? new Date(t[phase.key]!) : null;
                      const nextPhase = MILESTONE_PHASES[pi + 1];
                      const dB = t[nextPhase.key] ? new Date(t[nextPhase.key]!) : null;
                      if (!dA || !dB || isNaN(dA.getTime()) || isNaN(dB.getTime()) || dB <= dA) return;
                      if (dA < wEnd && dB >= wStart) {
                        const barL = Math.max(0, (dA.getTime() - wStart.getTime()) / (7 * DAY) * 100);
                        const barR = Math.min(100, (dB.getTime() - wStart.getTime()) / (7 * DAY) * 100);
                        if (barR > barL) {
                          elements.push(
                            <div
                              key={`bar-${pi}`}
                              style={{ ...phaseBarStyle, left: `${barL}%`, width: `${barR - barL}%`, background: nextPhase.color, opacity: .55 }}
                              data-tip={`${t.tool}|${nextPhase.label} period: ${fmtDate(dA)} → ${fmtDate(dB)}|${msTip}`}
                            />
                          );
                        }
                      }
                    });

                    // Milestone dots
                    MILESTONE_PHASES.forEach((phase, pi) => {
                      const d = t[phase.key] ? new Date(t[phase.key]!) : null;
                      if (!d || isNaN(d.getTime())) return;
                      if (d >= wStart && d < wEnd) {
                        const pct = ((d.getTime() - wStart.getTime()) / (7 * DAY)) * 100;
                        elements.push(
                          <div
                            key={`dot-${pi}`}
                            style={{ ...msDotStyle, left: `${pct}%`, background: phase.dot }}
                            data-tip={`${t.tool}|${phase.label}: ${fmtDate(d)}|${msTip}`}
                          />
                        );
                      }
                    });

                    return (
                      <td key={wi} style={tdCellStyle}>
                        {elements.length > 0 && (
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {elements}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tip && (
        <div style={{ ...tooltipStyle, left: tip.x, top: tip.y }}>
          <strong style={{ display: 'block', marginBottom: 2 }}>{tip.name}</strong>
          <span>{tip.dates}</span>
          {tip.milestones && (
            <span style={{ display: 'block', color: '#94A3B8', fontSize: '.68rem', marginTop: 2 }}>{tip.milestones}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default GanttTable;

/* ── Styles (inline, no CSS file dependency) ── */
const WEEK_W = 28; // px per week column

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  minWidth: '100%',
  background: '#fff',
  fontSize: '.72rem',
};

const thToolStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 4,
  width: 220,
  minWidth: 220,
  padding: '6px 10px',
  background: '#F8FAFC',
  border: '1px solid #E5E7EB',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '.65rem',
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '.6px',
  borderRight: '2px solid #E5E7EB',
};

const thMonthStyle: React.CSSProperties = {
  padding: '5px 4px',
  background: '#F8FAFC',
  border: '1px solid #E5E7EB',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '.65rem',
  color: '#374151',
  whiteSpace: 'nowrap',
};

const thWeekStyle: React.CSSProperties = {
  width: WEEK_W,
  minWidth: WEEK_W,
  padding: '3px 2px',
  background: '#F8FAFC',
  border: '1px solid #E5E7EB',
  textAlign: 'center',
  fontWeight: 500,
  fontSize: '.6rem',
  color: '#9CA3AF',
};

const tdToolStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: '#fff',
  borderRight: '2px solid #E5E7EB',
  boxShadow: '2px 0 6px -2px rgba(0,0,0,.07)',
  padding: '5px 10px',
  fontSize: '.72rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  maxWidth: 220,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  borderBottom: '1px solid #F0F0F0',
};

const tdCellStyle: React.CSSProperties = {
  width: WEEK_W,
  minWidth: WEEK_W,
  height: 32,
  padding: 0,
  border: '1px solid #F3F4F6',
  position: 'relative',
  verticalAlign: 'middle',
};

const refLineStyle: React.CSSProperties = {
  position: 'absolute',
  width: 2,
  top: 0,
  bottom: 0,
  zIndex: 1,
};

const phaseBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: '25%',
  height: '50%',
  zIndex: 1,
  borderRadius: 2,
  pointerEvents: 'none',
};

const msDotStyle: React.CSSProperties = {
  position: 'absolute',
  width: 8,
  height: 8,
  borderRadius: '50%',
  top: '50%',
  transform: 'translateY(-50%) translateX(-50%)',
  zIndex: 2,
  cursor: 'default',
};

const tbdTagStyle: React.CSSProperties = {
  marginLeft: 5,
  fontSize: '.58rem',
  background: '#FEF2F2',
  color: '#DC2626',
  border: '1px solid #FECACA',
  borderRadius: 3,
  padding: '0 4px',
  fontWeight: 700,
};

const lateTagStyle: React.CSSProperties = {
  marginLeft: 5,
  fontSize: '.58rem',
  background: '#EFF6FF',
  color: '#2563EB',
  border: '1px solid #BFDBFE',
  borderRadius: 3,
  padding: '0 4px',
  fontWeight: 700,
};

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  background: 'rgba(15,23,42,.92)',
  color: '#F8FAFC',
  padding: '6px 10px',
  borderRadius: 6,
  fontSize: '.72rem',
  pointerEvents: 'none',
  maxWidth: 320,
  lineHeight: 1.5,
};
