import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button, Space, DatePicker, Segmented, Tag, Tooltip, message, Divider,
} from 'antd';
import {
  FileExcelOutlined, ReloadOutlined, CameraOutlined, SortAscendingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas-pro';
import GanttTable from './GanttTable';
import { readExcelFile } from './parse';
import { idbSaveHandle, idbLoadHandle } from './idb';
import { DEFAULT_TOOLS, DEFAULT_DEADLINE, MILESTONE_PHASES } from './constants';
import type { ToolRecord, FilterMode, SortMode } from './types';

/* ── FS API availability ── */
const HAS_FS_API = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/* ── Helper ── */
function getToolStatus(t: ToolRecord, deadline: Date): 'normal' | 'tbd' | 'late' {
  const dates = MILESTONE_PHASES
    .map(p => t[p.key])
    .filter(Boolean)
    .map(d => new Date(d!));
  if (dates.length === 0) return 'tbd';
  if (dates.every(d => d > deadline)) return 'late';
  return 'normal';
}

/* ── Component ── */
const ToolGanttTab: React.FC = () => {
  const [toolData,   setToolData]   = useState<ToolRecord[] | null>(null);
  const [fileName,   setFileName]   = useState<string>('');
  const [filter,     setFilter]     = useState<FilterMode>('all');
  const [sortMode,   setSortMode]   = useState<SortMode>('item');
  const [deadline,   setDeadline]   = useState<string>(DEFAULT_DEADLINE);
  const [loading,    setLoading]    = useState(false);
  const [msgApi,     msgCtx]        = message.useMessage();
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  // Restore handle from IDB on mount
  useEffect(() => {
    (async () => {
      try {
        const h = await idbLoadHandle();
        if (!h) return;
        const perm = await (h as any).queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          const file = await (h as any).getFile();
          const data = await readExcelFile(file);
          if (data && data.length > 0) {
            handleRef.current = h;
            setFileName(file.name);
            setToolData(data);
          }
        } else {
          // Store handle so Reload can request permission later
          handleRef.current = h;
        }
      } catch { /* no saved handle or permission denied */ }
    })();
  }, []);

  /* ── File operations ── */
  const openExcel = useCallback(async () => {
    if (HAS_FS_API) {
      try {
        const [h] = await (window as any).showOpenFilePicker({
          types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
        }) as [FileSystemFileHandle];
        const file = await (h as any).getFile();
        const data = await readExcelFile(file);
        if (!data || data.length === 0) { msgApi.error('Cannot parse Excel data'); return; }
        handleRef.current = h;
        setFileName(file.name);
        setToolData(data);
        await idbSaveHandle(h);
      } catch (e: any) {
        if (e?.name !== 'AbortError') msgApi.error('Cannot open file: ' + e?.message);
      }
    } else {
      // Fallback: <input>
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.xlsx';
      inp.onchange = async () => {
        const file = inp.files?.[0]; if (!file) return;
        const data = await readExcelFile(file);
        if (!data || data.length === 0) { msgApi.error('Cannot parse Excel data'); return; }
        handleRef.current = null; // no FS handle in fallback
        setFileName(file.name);
        setToolData(data);
      };
      inp.click();
    }
  }, [msgApi]);

  const reloadExcel = useCallback(async () => {
    setLoading(true);
    try {
      // Try to recover handle from IDB if not in memory
      if (!handleRef.current) {
        const h = await idbLoadHandle().catch(() => null);
        if (h) {
          const perm = await (h as any).requestPermission({ mode: 'read' });
          if (perm === 'granted') handleRef.current = h;
        }
      }
      if (!handleRef.current) { await openExcel(); setLoading(false); return; }

      // Ensure permission
      const perm = await (handleRef.current as any).queryPermission({ mode: 'read' });
      if (perm !== 'granted') {
        const p2 = await (handleRef.current as any).requestPermission({ mode: 'read' });
        if (p2 !== 'granted') { setLoading(false); return; }
      }

      const file = await (handleRef.current as any).getFile();
      const data = await readExcelFile(file);
      if (!data || data.length === 0) { msgApi.error('Cannot parse Excel data'); setLoading(false); return; }
      setFileName(file.name);
      setToolData(data);
      msgApi.success('Reloaded');
    } catch (e: any) {
      msgApi.error('Reload failed: ' + e?.message);
    }
    setLoading(false);
  }, [msgApi, openExcel]);

  /* ── Screenshot ── */
  const takeScreenshot = useCallback(async () => {
    const el = captureRef.current;
    if (!el) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const link = document.createElement('a');
      link.download = `tool-gantt-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e: any) {
      msgApi.error('Screenshot failed: ' + e?.message);
    }
    setLoading(false);
  }, [msgApi]);

  /* ── Derived display data ── */
  const allTools   = toolData ?? DEFAULT_TOOLS;
  const deadlineD  = (() => { const d = new Date(deadline); d.setHours(0, 0, 0, 0); return d; })();
  const counts     = { all: allTools.length, normal: 0, tbd: 0, late: 0 };
  for (const t of allTools) counts[getToolStatus(t, deadlineD)]++;

  let filtered = filter === 'all' ? [...allTools] : allTools.filter(t => getToolStatus(t, deadlineD) === filter);

  if (sortMode === 'qualify') {
    filtered = filtered.sort((a, b) => {
      const da = a.qualifyDone, db = b.qualifyDone;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }

  const connected = !!fileName;
  const deadlineFmt = `${deadlineD.getMonth() + 1}/${deadlineD.getDate()}`;

  return (
    <>
      {msgCtx}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Toolbar ── */}
        <div style={toolbarStyle}>
          <Space size={8} wrap>
            {/* File status */}
            <Space size={6}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: connected ? '#22C55E' : '#EF4444',
                display: 'inline-block',
              }} />
              <span style={{ fontSize: 12, color: connected ? '#374151' : '#9CA3AF' }}>
                {connected ? fileName : 'Using default data'}
              </span>
            </Space>
            <Divider type="vertical" />

            {/* File buttons */}
            <Button size="small" icon={<FileExcelOutlined />} onClick={openExcel}>
              {connected ? 'Change Excel' : 'Open Excel'}
            </Button>
            {connected && (
              <Button size="small" icon={<ReloadOutlined />} onClick={reloadExcel} loading={loading}>
                Reload
              </Button>
            )}

            <Divider type="vertical" />

            {/* Deadline */}
            <Space size={4}>
              <span style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>Deadline</span>
              <DatePicker
                size="small"
                value={dayjs(deadline)}
                format="YYYY-MM-DD"
                onChange={v => v && setDeadline(v.format('YYYY-MM-DD'))}
                allowClear={false}
              />
            </Space>

            <Divider type="vertical" />

            {/* Screenshot */}
            <Tooltip title="Screenshot (PNG)">
              <Button size="small" icon={<CameraOutlined />} onClick={takeScreenshot} loading={loading}>
                Screenshot
              </Button>
            </Tooltip>
          </Space>
        </div>

        {/* ── Filter + Sort bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '4px 0' }}>
          {/* Filter */}
          <Segmented
            size="small"
            value={filter}
            onChange={v => setFilter(v as FilterMode)}
            options={[
              { label: `All (${counts.all})`,             value: 'all'    },
              { label: `Normal (${counts.normal})`,        value: 'normal' },
              { label: `TBD (${counts.tbd})`,              value: 'tbd'    },
              { label: `After Deadline (${counts.late})`,  value: 'late'   },
            ]}
          />

          <Divider type="vertical" style={{ height: 20, margin: 0 }} />

          {/* Sort */}
          <Space size={6}>
            <SortAscendingOutlined style={{ color: '#9CA3AF', fontSize: 14 }} />
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>Sort:</span>
            <Segmented
              size="small"
              value={sortMode}
              onChange={v => setSortMode(v as SortMode)}
              options={[
                { label: '# Tool No.',      value: 'item'    },
                { label: '📅 Qualify Date', value: 'qualify' },
              ]}
            />
          </Space>
        </div>

        {/* ── Legend + Gantt (captured for screenshot) ── */}
        <div ref={captureRef} style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB' }}>
          {/* Legend row 1: status + reference lines */}
          <div style={legendRowStyle}>
            {[
              { dot: '#374151', label: 'Normal' },
              { dot: '#DC2626', label: 'TBD', labelColor: '#DC2626' },
              { dot: '#2563EB', label: 'After Deadline', labelColor: '#2563EB', bold: true },
            ].map(({ dot, label, labelColor, bold }) => (
              <span key={label} style={legItemStyle}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{ color: labelColor, fontWeight: bold ? 700 : 400 }}>{label}</span>
              </span>
            ))}
            <span style={{ width: 1, height: 16, background: '#E5E7EB', margin: '0 6px' }} />
            <span style={legItemStyle}>
              <span style={{ width: 2, height: 14, background: '#D1D5DB', flexShrink: 0 }} />
              Today
            </span>
            <span style={legItemStyle}>
              <span style={{ width: 2, height: 14, background: '#EF4444', flexShrink: 0 }} />
              Deadline ({deadlineFmt})
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '.68rem', color: '#9CA3AF', fontWeight: 600 }}>
              {filtered.length} tools
            </span>
          </div>

          {/* Legend row 2: phase milestones + periods */}
          <div style={{ ...legendRowStyle, marginBottom: 10 }}>
            {MILESTONE_PHASES.map((p, pi) => (
              <React.Fragment key={p.key}>
                <span style={legItemStyle}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                  {p.label}
                </span>
                {pi < MILESTONE_PHASES.length - 1 && (
                  <span style={legItemStyle}>
                    <span style={{ width: 14, height: 8, borderRadius: 2, background: MILESTONE_PHASES[pi + 1].color, opacity: .7, flexShrink: 0 }} />
                    {MILESTONE_PHASES[pi + 1].label} period
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Gantt table */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#CBD5E1', padding: '40px 0', fontSize: '.85rem' }}>
              No tools match the current filter
            </div>
          ) : (
            <div style={{ overflow: 'hidden', border: '1px solid #E5E7EB', borderRadius: 6 }}>
              <GanttTable tools={filtered} deadline={deadline} />
            </div>
          )}
        </div>

        {/* Status tags */}
        {!toolData && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag color="orange">Using built-in default data</Tag>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Open an Excel file with "Tool", "Item", "Move-In", "Setup", "Tuning", "Qualify" columns</span>
          </div>
        )}
      </div>
    </>
  );
};

export default ToolGanttTab;

/* ── Styles ── */
const toolbarStyle: React.CSSProperties = {
  background: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
};

const legendRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  fontSize: '.72rem',
  color: '#374151',
  marginBottom: 4,
};

const legItemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  whiteSpace: 'nowrap',
};
