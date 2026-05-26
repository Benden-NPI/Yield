import React, { useCallback, useRef, useState } from 'react';
import {
  Button, Space, DatePicker, Segmented, Tooltip, message, Divider, Popconfirm, Typography,
} from 'antd';
import {
  CameraOutlined, SortAscendingOutlined, CloudDownloadOutlined, SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas-pro';
import GanttTable from './GanttTable';
import { DEFAULT_DEADLINE, MILESTONE_PHASES } from './constants';
import type { FilterMode, SortMode, ToolRecord } from './types';
import { useToolGanttSync, getToolGanttWebhookUrl } from '../../hooks/useToolGanttSync';
import { useToolGanttStore } from '../../hooks/useToolGanttStore';

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
  const { records, source, setRecords } = useToolGanttStore();

  const [filter,   setFilter]   = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('item');
  const [deadline, setDeadline] = useState<string>(DEFAULT_DEADLINE);
  const [loading,  setLoading]  = useState(false);
  const [msgApi,   msgCtx]      = message.useMessage();
  const captureRef              = useRef<HTMLDivElement>(null);

  /* ── SharePoint sync ── */
  const handleSpData = useCallback((data: ToolRecord[]) => {
    setRecords(data, 'SharePoint');
  }, [setRecords]);
  const { sync: spSync, syncing: spSyncing, lastSyncAt } = useToolGanttSync(handleSpData);

  const hasUrl = !!getToolGanttWebhookUrl();

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      msgApi.error('Screenshot failed: ' + msg);
    }
    setLoading(false);
  }, [msgApi]);

  /* ── Derived display data ── */
  const deadlineD = (() => { const d = new Date(deadline); d.setHours(0, 0, 0, 0); return d; })();
  const deadlineFmt = `${deadlineD.getMonth() + 1}/${deadlineD.getDate()}`;

  if (!records) {
    /* ── Empty state ── */
    return (
      <>
        {msgCtx}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 16 }}>
          <CloudDownloadOutlined style={{ fontSize: 48, color: '#D1D5DB' }} />
          <Typography.Title level={4} style={{ color: '#6B7280', margin: 0 }}>
            尚未載入 Tool PO Tracking 資料
          </Typography.Title>
          <Typography.Text type="secondary" style={{ textAlign: 'center', maxWidth: 420 }}>
            請先到 <strong>Settings</strong> 頁面設定 Power Automate Webhook URL，
            再點「從 SharePoint 同步」載入資料。
          </Typography.Text>
          <Space>
            {hasUrl ? (
              <Popconfirm
                title="從 SharePoint 同步資料？"
                onConfirm={async () => {
                  try {
                    const res = await spSync();
                    msgApi.success(`已載入 ${res.count} 筆工具資料`);
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    msgApi.error('同步失敗：' + msg);
                  }
                }}
                okText="同步"
                cancelText="取消"
              >
                <Button type="primary" icon={<CloudDownloadOutlined />} loading={spSyncing}>
                  從 SharePoint 同步
                </Button>
              </Popconfirm>
            ) : (
              <Tooltip title="請先在 Settings 頁面貼上 Webhook URL">
                <Button type="primary" icon={<CloudDownloadOutlined />} disabled>
                  從 SharePoint 同步
                </Button>
              </Tooltip>
            )}
            <Button icon={<SettingOutlined />} onClick={() => {
              // Trigger tab switch to Settings via custom event
              window.dispatchEvent(new CustomEvent('yield-nav', { detail: 'settings' }));
            }}>
              前往 Settings
            </Button>
          </Space>
        </div>
      </>
    );
  }

  /* ── Loaded state ── */
  const counts = { all: records.length, normal: 0, tbd: 0, late: 0 };
  for (const t of records) counts[getToolStatus(t, deadlineD)]++;

  let filtered = filter === 'all' ? [...records] : records.filter(t => getToolStatus(t, deadlineD) === filter);
  if (sortMode === 'qualify') {
    filtered = filtered.sort((a, b) => {
      const da = a.qualifyDone, db = b.qualifyDone;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }

  return (
    <>
      {msgCtx}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Toolbar ── */}
        <div style={toolbarStyle}>
          <Space size={8} wrap>
            {/* Source indicator */}
            <Space size={6}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#374151' }}>{source}</span>
              {lastSyncAt && (
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  · 最後同步 {new Date(lastSyncAt).toLocaleTimeString()}
                </span>
              )}
            </Space>
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

            <Divider type="vertical" />

            {/* SharePoint sync */}
            {hasUrl ? (
              <Popconfirm
                title="從 SharePoint 同步會覆寫目前資料，確定繼續？"
                onConfirm={async () => {
                  try {
                    const res = await spSync();
                    msgApi.success(`已從 SharePoint 載入 ${res.count} 筆工具資料`);
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    msgApi.error('同步失敗：' + msg);
                  }
                }}
                okText="同步"
                cancelText="取消"
              >
                <Button size="small" icon={<CloudDownloadOutlined />} loading={spSyncing}>
                  SharePoint 同步
                </Button>
              </Popconfirm>
            ) : (
              <Tooltip title="請先在 Settings 頁面貼上 Webhook URL">
                <Button size="small" icon={<CloudDownloadOutlined />} disabled>
                  SharePoint 同步
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>

        {/* ── Filter + Sort bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '4px 0' }}>
          <Segmented
            size="small"
            value={filter}
            onChange={v => setFilter(v as FilterMode)}
            options={[
              { label: `All (${counts.all})`,            value: 'all'    },
              { label: `Normal (${counts.normal})`,       value: 'normal' },
              { label: `TBD (${counts.tbd})`,             value: 'tbd'    },
              { label: `After Deadline (${counts.late})`, value: 'late'   },
            ]}
          />
          <Divider type="vertical" style={{ height: 20, margin: 0 }} />
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
          {/* Legend row 1 */}
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
