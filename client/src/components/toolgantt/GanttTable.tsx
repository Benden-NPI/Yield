import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { StationRecord } from './types';
import { MILESTONE_PHASES, MILESTONE_PERIODS } from './constants';

/* ── Constants ── */
const DAY = 86_400_000;
const STATION_COL_W = 240;
const WEEK_W = 28;

/* ── Date / layout helpers ── */
function buildWeeks(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  let cur = new Date(start);
  while (cur < end) {
    weeks.push(new Date(cur));
    cur = new Date(cur.getTime() + 7 * DAY);
  }
  return weeks;
}

function buildMonths(
  start: Date,
  end: Date,
  weeks: Date[],
): { label: string; span: number }[] {
  const months: { label: string; span: number }[] = [];
  let mCur = new Date(start);
  while (mCur < end) {
    const mStart = new Date(mCur);
    const mEnd = new Date(mCur.getFullYear(), mCur.getMonth() + 1, 1);
    const wStart = weeks.findIndex(w => w >= mStart);
    const wEnd = weeks.findIndex(w => w >= mEnd);
    const span =
      (wEnd === -1 ? weeks.length : wEnd) - (wStart === -1 ? 0 : wStart);
    if (span > 0)
      months.push({
        label: `${mStart.getFullYear()}/${mStart.getMonth() + 1}`,
        span,
      });
    mCur = mEnd;
  }
  return months;
}

function allMilestoneDates(s: StationRecord): Date[] {
  return MILESTONE_PHASES.map(p => s[p.key])
    .filter(Boolean)
    .map(d => new Date(d!))
    .filter(d => !isNaN(d.getTime()));
}

function computeRange(stations: StationRecord[]) {
  let minT = Infinity,
    maxT = -Infinity;
  for (const s of stations) {
    for (const d of allMilestoneDates(s)) {
      minT = Math.min(minT, d.getTime());
      maxT = Math.max(maxT, d.getTime());
    }
  }
  if (!isFinite(minT)) {
    const start = new Date('2026-02-01');
    const end = new Date('2026-10-01');
    const weeks = buildWeeks(start, end);
    return { weeks, months: buildMonths(start, end, weeks) };
  }
  const start = new Date(minT);
  start.setDate(1);
  const end = new Date(maxT);
  end.setMonth(end.getMonth() + 2);
  end.setDate(1);
  const weeks = buildWeeks(start, end);
  return { weeks, months: buildMonths(start, end, weeks) };
}

function fmtDate(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
}

/* ── Row model ── */
type RowItem =
  | { kind: 'separator'; label: string }
  | { kind: 'station'; station: StationRecord };

/* ── Tooltip ── */
interface TipState {
  x: number;
  y: number;
  tipType: string;
  title: string;
  detail: string;
}

/* ── Props ── */
interface Props {
  stations: StationRecord[];
  deadline: string;
}

/* ── Component ── */
const GanttTable: React.FC<Props> = ({ stations, deadline }) => {
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const { weeks, months } = useMemo(() => computeRange(stations), [stations]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const deadlineD = useMemo(() => {
    const d = new Date(deadline);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [deadline]);

  /* Scroll sync: body drives header */
  useEffect(() => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const onScroll = () => {
      head.scrollLeft = body.scrollLeft;
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, [weeks]);

  /* Build rows with group separators */
  const rows = useMemo((): RowItem[] => {
    const result: RowItem[] = [];
    let lastType: string | null = null;
    for (const s of stations) {
      if (lastType === null || lastType !== s.stationType) {
        result.push({
          kind: 'separator',
          label:
            s.stationType === 'coldplate' ? 'ColdPlate' : 'Loop (Assembly)',
        });
      }
      result.push({ kind: 'station', station: s });
      lastType = s.stationType;
    }
    return result;
  }, [stations]);

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Frozen header ── */}
      <div ref={headRef} style={{ overflow: 'hidden' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStationStyle} rowSpan={2}>
                Station / Process
              </th>
              {months.map((m, i) => (
                <th key={i} colSpan={m.span} style={thMonthStyle}>
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              {weeks.map((w, i) => (
                <th key={i} style={thWeekStyle}>
                  {w.getDate()}
                </th>
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
          const el = (e.target as HTMLElement).closest<HTMLElement>(
            '[data-tip-type]',
          );
          if (!el) {
            setTip(null);
            return;
          }
          setTip({
            x: e.clientX + 14,
            y: e.clientY + 14,
            tipType: el.dataset.tipType ?? '',
            title: el.dataset.tipTitle ?? '',
            detail: el.dataset.tipDetail ?? '',
          });
        }}
        onMouseLeave={() => setTip(null)}
      >
        <table style={tableStyle}>
          <tbody>
            {rows.map((row, ri) => {
              /* ── Separator / group header ── */
              if (row.kind === 'separator') {
                return (
                  <tr key={`sep-${ri}`}>
                    <td style={tdSepLabelStyle}>{row.label}</td>
                    {weeks.map((_, wi) => (
                      <td key={wi} style={tdSepCellStyle} />
                    ))}
                  </tr>
                );
              }

              /* ── Station row ── */
              const { station: s } = row;

              return (
                <tr key={s.station}>
                  {/* Left sticky cell */}
                  <td style={tdStationStyle}>
                    <div style={stationNameStyle}>{s.station}</div>
                    {s.processStep && (
                      <div style={processStepStyle}>{s.processStep}</div>
                    )}
                  </td>

                  {/* Gantt cells */}
                  {weeks.map((wStart, wi) => {
                    const wEnd = new Date(wStart.getTime() + 7 * DAY);
                    const elems: React.ReactNode[] = [];

                    /* Today line */
                    if (today >= wStart && today < wEnd) {
                      const pct =
                        ((today.getTime() - wStart.getTime()) / (7 * DAY)) *
                        100;
                      elems.push(
                        <div
                          key="today"
                          style={{
                            ...refLineStyle,
                            left: `${pct}%`,
                            background: '#D1D5DB',
                          }}
                        />,
                      );
                    }

                    /* Deadline line */
                    if (deadlineD >= wStart && deadlineD < wEnd) {
                      const pct =
                        ((deadlineD.getTime() - wStart.getTime()) /
                          (7 * DAY)) *
                        100;
                      elems.push(
                        <div
                          key="dl"
                          style={{
                            ...refLineStyle,
                            left: `${pct}%`,
                            background: '#EF4444',
                          }}
                        />,
                      );
                    }

                    /* Period bars (setup / tuning / qualify) */
                    MILESTONE_PERIODS.forEach((period, pi) => {
                      const dA = s[period.fromKey]
                        ? new Date(s[period.fromKey]!)
                        : null;
                      const dB = s[period.toKey]
                        ? new Date(s[period.toKey]!)
                        : null;
                      if (
                        !dA ||
                        !dB ||
                        isNaN(dA.getTime()) ||
                        isNaN(dB.getTime()) ||
                        dB <= dA
                      )
                        return;
                      if (dA >= wEnd || dB < wStart) return;

                      const barL = Math.max(
                        0,
                        ((dA.getTime() - wStart.getTime()) / (7 * DAY)) * 100,
                      );
                      const barR = Math.min(
                        100,
                        ((dB.getTime() - wStart.getTime()) / (7 * DAY)) * 100,
                      );
                      if (barR <= barL) return;

                      const criteria = period.criteriaKey
                        ? s[period.criteriaKey] || ''
                        : '';

                      elems.push(
                        <div
                          key={`bar-${pi}`}
                          style={{
                            ...phaseBarStyle,
                            left: `${barL}%`,
                            width: `${barR - barL}%`,
                            background: period.color,
                          }}
                          data-tip-type="period"
                          data-tip-title={period.label}
                          data-tip-detail={criteria}
                        />,
                      );
                    });

                    /* Diamond milestones */
                    MILESTONE_PHASES.forEach((phase, pi) => {
                      const d = s[phase.key] ? new Date(s[phase.key]!) : null;
                      if (!d || isNaN(d.getTime())) return;
                      if (d < wStart || d >= wEnd) return;

                      const pct =
                        ((d.getTime() - wStart.getTime()) / (7 * DAY)) * 100;
                      elems.push(
                        <div
                          key={`ms-${pi}`}
                          style={{
                            ...msDiamondStyle,
                            left: `${pct}%`,
                            background: phase.dot,
                          }}
                          data-tip-type="milestone"
                          data-tip-title={phase.label}
                          data-tip-detail={fmtDate(d)}
                        />,
                      );
                    });

                    return (
                      <td key={wi} style={tdCellStyle}>
                        {elems.length > 0 && (
                          <div
                            style={{
                              position: 'relative',
                              width: '100%',
                              height: '100%',
                            }}
                          >
                            {elems}
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

      {/* ── Tooltip ── */}
      {tip && (
        <div style={{ ...tooltipStyle, left: tip.x, top: tip.y }}>
          <strong style={{ display: 'block', marginBottom: 3, fontSize: '.7rem', color: '#CBD5E1' }}>
            {tip.title}
          </strong>
          {tip.tipType === 'milestone' ? (
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#93C5FD' }}>
              {tip.detail}
            </span>
          ) : (
            <span style={{ fontSize: '.68rem', color: '#E2E8F0', lineHeight: 1.5 }}>
              {tip.detail || (
                <em style={{ color: '#64748B' }}>No criteria specified</em>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default GanttTable;

/* ── Inline styles ── */
const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  minWidth: '100%',
  background: '#fff',
  fontSize: '.72rem',
};

const thStationStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 4,
  width: STATION_COL_W,
  minWidth: STATION_COL_W,
  padding: '6px 10px',
  background: '#F8FAFC',
  border: '1px solid #E5E7EB',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '.65rem',
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '.6px',
  borderRight: '2px solid #CBD5E1',
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

const tdStationStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: '#fff',
  borderRight: '2px solid #CBD5E1',
  boxShadow: '2px 0 6px -2px rgba(0,0,0,.07)',
  padding: '5px 10px',
  verticalAlign: 'top',
  width: STATION_COL_W,
  minWidth: STATION_COL_W,
  maxWidth: STATION_COL_W,
  borderBottom: '1px solid #F0F0F0',
};

const stationNameStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '.75rem',
  color: '#1F2937',
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
};

const processStepStyle: React.CSSProperties = {
  fontSize: '.62rem',
  color: '#9CA3AF',
  marginTop: 1,
  lineHeight: 1.25,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
};

const tdSepLabelStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: '#EFF6FF',
  borderRight: '2px solid #BFDBFE',
  padding: '4px 10px',
  fontSize: '.63rem',
  fontWeight: 700,
  color: '#3B82F6',
  textTransform: 'uppercase',
  letterSpacing: '.7px',
  width: STATION_COL_W,
  minWidth: STATION_COL_W,
  borderBottom: '1px solid #DBEAFE',
};

const tdSepCellStyle: React.CSSProperties = {
  background: '#EFF6FF',
  height: 22,
  border: '1px solid #DBEAFE',
};

const tdCellStyle: React.CSSProperties = {
  width: WEEK_W,
  minWidth: WEEK_W,
  height: 38,
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
  pointerEvents: 'none',
};

const phaseBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: '30%',
  height: '40%',
  zIndex: 1,
  borderRadius: 2,
  opacity: 0.65,
  cursor: 'default',
};

const msDiamondStyle: React.CSSProperties = {
  position: 'absolute',
  width: 9,
  height: 9,
  top: '50%',
  transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
  zIndex: 3,
  cursor: 'default',
};

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  background: 'rgba(15,23,42,.93)',
  color: '#F8FAFC',
  padding: '7px 11px',
  borderRadius: 6,
  fontSize: '.72rem',
  pointerEvents: 'none',
  maxWidth: 360,
  lineHeight: 1.5,
};
