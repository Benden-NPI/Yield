import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StationRecord } from './types';
import { MILESTONE_PHASES, MILESTONE_PERIODS } from './constants';
import type { ElementStatus } from '../../hooks/useToolGanttStore';

/* ── Constants ── */
const DAY = 86_400_000;
const STATION_COL_W = 240;
const OWNER_COL_W = 76;
const WEEK_W = 28;
const MAX_WEEKS = 130; // ~2.5 years; prevents runaway ranges from bad date data

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
  let weeks = buildWeeks(start, end);
  if (weeks.length > MAX_WEEKS) {
    weeks = weeks.slice(0, MAX_WEEKS); // safety cap
    const cappedEnd = new Date(weeks[weeks.length - 1].getTime() + 7 * DAY);
    return { weeks, months: buildMonths(start, cappedEnd, weeks) };
  }
  return { weeks, months: buildMonths(start, end, weeks) };
}

function fmtInt(s: string): string {
  if (!s) return '';
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? s : Math.round(n).toLocaleString();
}

function fmtPct(s: string): string {
  if (!s) return '';
  const n = parseFloat(s.replace('%', '').replace(/,/g, '').trim());
  if (isNaN(n)) return s;
  // SharePoint percentage columns return 0-1 decimals; plain number columns return e.g. 85
  const pct = n <= 1.5 ? Math.round(n * 100) : Math.round(n);
  return `${pct}%`;
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

/* ── Bar edit popup state ── */
interface EditBar {
  key: string;
  label: string;
  criteria: string;
  x: number;
  y: number;
  draft: string;
}

/* ── Props ── */
interface Props {
  stations: StationRecord[];
  deadline: string;
  completedElements: Record<string, ElementStatus>;
  onToggleElement: (key: string) => void;
  notes: Record<string, string>;
  onSetNote: (key: string, text: string) => void;
}

/* ── Component ── */
const GanttTable: React.FC<Props> = ({ stations, deadline, completedElements, onToggleElement, notes, onSetNote }) => {
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [editBar, setEditBar] = useState<EditBar | null>(null);

  /* Close popup on click-outside or Escape */
  useEffect(() => {
    if (!editBar) return;
    const onDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node))
        setEditBar(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditBar(null); };
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [editBar]);

  const saveNote = useCallback(() => {
    if (!editBar) return;
    onSetNote(editBar.key, editBar.draft);
    setEditBar(null);
  }, [editBar, onSetNote]);

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
            s.stationType === 'coldplate' ? 'ColdPlate'
            : s.stationType === 'base' ? 'Base'
            : 'Loop (Assembly)',
        });
      }
      result.push({ kind: 'station', station: s });
      lastType = s.stationType;
    }
    return result;
  }, [stations]);

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Frozen header — sticky so it stays visible when scrolling down ── */}
      <div ref={headRef} style={{ overflow: 'hidden', position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStationStyle} rowSpan={2}>
                Station / Process
              </th>
              <th style={thOwnerStyle} rowSpan={2}>UPH</th>
              <th style={thOwnerStyle} rowSpan={2}>Cap.</th>
              <th style={thOwnerStyle} rowSpan={2}>Eff.</th>
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
                    <td style={tdSepCellStyle} />
                    <td style={tdSepCellStyle} />
                    <td style={tdSepCellStyle} />
                    {weeks.map((_, wi) => (
                      <td key={wi} style={tdSepCellStyle} />
                    ))}
                  </tr>
                );
              }

              /* ── Station row ── */
              const { station: s } = row;
              const phaseDone = MILESTONE_PHASES.map(
                (p) => `${s.station}|ms|${p.key}` in completedElements,
              );
              const hasInconsistency = phaseDone.some(
                (done, i) => done && i > 0 && !phaseDone[i - 1],
              );

              return (
                <tr key={s.station}>
                  {/* Left sticky cell */}
                  <td style={tdStationStyle}>
                    <div style={stationNameStyle}>
                      {s.station}
                      {hasInconsistency && (
                        <span
                          title="完成標記順序異常：有前置階段尚未完成"
                          style={{ color: '#F59E0B', marginLeft: 4, fontSize: '.72rem' }}
                        >
                          ⚠
                        </span>
                      )}
                    </div>
                    {s.processStep && (
                      <div style={processStepStyle}>{s.processStep}</div>
                    )}
                  </td>

                  {/* Capacity cells */}
                  <td style={tdOwnerStyle}>{s.uph}</td>
                  <td style={tdOwnerStyle}>{fmtInt(s.capacity)}</td>
                  <td style={tdOwnerStyle}>{fmtPct(s.efficiency)}</td>

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
                    MILESTONE_PERIODS.forEach((period) => {
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

                      const barElemKey = `${s.station}|bar|${period.fromKey}-${period.toKey}`;
                      const barDone = barElemKey in completedElements;
                      const isBarLate = !barDone && dB < today;
                      const barNote = notes[barElemKey] ?? '';
                      const tipDetail = barNote
                        ? barNote
                        : isBarLate
                          ? `${criteria ? criteria + ' ▪ ' : ''}⚠ Period end passed`
                          : criteria;

                      elems.push(
                        <div
                          key={`bar-${period.fromKey}`}
                          style={{
                            ...phaseBarStyle,
                            left: `${barL}%`,
                            width: `${barR - barL}%`,
                            background: barDone ? '#B0B7C3' : period.color,
                            opacity: barDone ? 0.35 : 0.65,
                            cursor: 'pointer',
                            outline: barNote
                              ? '1.5px solid rgba(255,255,255,0.75)'
                              : isBarLate
                                ? '1.5px solid #EF4444'
                                : 'none',
                            outlineOffset: '-1px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTip(null);
                            setEditBar({
                              key: barElemKey,
                              label: period.label,
                              criteria,
                              x: e.clientX,
                              y: e.clientY + 10,
                              draft: barNote,
                            });
                          }}
                          data-tip-type="period"
                          data-tip-title={period.label}
                          data-tip-detail={tipDetail}
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

                      const msElemKey = `${s.station}|ms|${phase.key}`;
                      const msDone = msElemKey in completedElements;
                      const isLate = !msDone && d < today;
                      const slipDays = isLate
                        ? Math.round((today.getTime() - d.getTime()) / DAY)
                        : 0;

                      elems.push(
                        <div
                          key={`ms-${pi}`}
                          style={{
                            ...msDiamondStyle,
                            left: `${pct}%`,
                            background: msDone ? '#C4C4C4' : phase.dot,
                            cursor: 'pointer',
                            outline: isLate ? '2px solid #EF4444' : 'none',
                            outlineOffset: '2px',
                          }}
                          onClick={(e) => { e.stopPropagation(); onToggleElement(msElemKey); }}
                          data-tip-type="milestone"
                          data-tip-title={phase.label}
                          data-tip-detail={
                            isLate
                              ? `Planned: ${fmtDate(d)} ▪ ⚠ Slipped ${slipDays} days`
                              : fmtDate(d)
                          }
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

      {/* ── Bar note / done popup ── */}
      {editBar && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            left: Math.min(editBar.x, window.innerWidth - 288),
            top: Math.min(editBar.y, window.innerHeight - 220),
            zIndex: 1001,
            background: '#fff',
            border: '1px solid #D1D5DB',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.14)',
            padding: '12px 14px',
            width: 272,
          }}
          onMouseMove={(e) => e.stopPropagation()} /* prevent table tooltip while popup open */
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '.74rem', color: '#374151' }}>{editBar.label}</span>
            <button
              onClick={() => setEditBar(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '.85rem', lineHeight: 1, padding: 2 }}
            >✕</button>
          </div>

          {/* Done toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: '.7rem', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={editBar.key in completedElements}
              onChange={() => onToggleElement(editBar.key)}
              style={{ accentColor: '#10B981', width: 14, height: 14 }}
            />
            標記為完成
          </label>

          {/* Note textarea */}
          <div style={{ fontSize: '.65rem', color: '#6B7280', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>備註</div>
          <textarea
            autoFocus
            rows={3}
            placeholder="新增備註..."
            value={editBar.draft}
            onChange={(e) => setEditBar(prev => prev ? { ...prev, draft: e.target.value } : null)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveNote(); }}
            style={{
              width: '100%',
              resize: 'vertical',
              fontSize: '.72rem',
              padding: '6px 8px',
              borderRadius: 5,
              border: '1px solid #E5E7EB',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              minHeight: 56,
              boxSizing: 'border-box',
              color: '#1F2937',
            }}
          />

          {/* Excel criteria (read-only hint) */}
          {editBar.criteria && (
            <div style={{ fontSize: '.62rem', color: '#9CA3AF', marginTop: 4, lineHeight: 1.4 }}>
              Criteria: {editBar.criteria}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
            <button
              onClick={() => setEditBar(null)}
              style={{ padding: '4px 12px', fontSize: '.68rem', border: '1px solid #E5E7EB', borderRadius: 5, cursor: 'pointer', background: '#fff', color: '#374151' }}
            >
              取消
            </button>
            <button
              onClick={saveNote}
              style={{ padding: '4px 12px', fontSize: '.68rem', border: 'none', borderRadius: 5, cursor: 'pointer', background: '#3B82F6', color: '#fff', fontWeight: 600 }}
            >
              儲存
            </button>
          </div>
        </div>
      )}

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

const thOwnerStyle: React.CSSProperties = {
  width: OWNER_COL_W,
  minWidth: OWNER_COL_W,
  padding: '4px 6px',
  background: '#F8FAFC',
  border: '1px solid #E5E7EB',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '.6rem',
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '.4px',
  lineHeight: 1.3,
};

const tdOwnerStyle: React.CSSProperties = {
  width: OWNER_COL_W,
  minWidth: OWNER_COL_W,
  maxWidth: OWNER_COL_W,
  padding: '4px 6px',
  fontSize: '.68rem',
  color: '#374151',
  borderBottom: '1px solid #F0F0F0',
  borderRight: '1px solid #E5E7EB',
  verticalAlign: 'middle',
  textAlign: 'center',
  wordBreak: 'break-word',
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
  fontSize: '.6rem',
  color: '#9CA3AF',
  marginTop: 2,
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const processStepStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '.76rem',
  color: '#1F2937',
  lineHeight: 1.3,
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
