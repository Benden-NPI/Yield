import React, { useCallback, useMemo, useRef, useState, Component } from 'react';
import {
  Button, Space, DatePicker, Tooltip, message, Divider, Popconfirm, Typography,
} from 'antd';
import { CameraOutlined, CloudDownloadOutlined, LoadingOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas-pro';
import GanttTable from './GanttTable';
import { DEFAULT_DEADLINE, MILESTONE_PHASES, MILESTONE_PERIODS } from './constants';
import type { StationRecord } from './types';
import { useToolGanttSync, getToolGanttWebhookUrl } from '../../hooks/useToolGanttSync';
import { useToolGanttStore } from '../../hooks/useToolGanttStore';
import { useReadinessFlush } from '../../hooks/useReadinessRemote';

/* ── Error boundary: catches GanttTable render crashes ── */
interface EBState { error: string | null }
class GanttErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error): EBState {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '24px 16px', background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6 }}>
          <strong style={{ color: '#cf1322' }}>Gantt 圖表發生錯誤：</strong>
          <pre style={{ marginTop: 8, fontSize: 12, color: '#434343', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error}
          </pre>
          <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
            請開啟 DevTools Console（F12）查看詳細錯誤，或清除資料後重新同步。
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Helper: show multi-line error message ── */
type MsgApi = ReturnType<typeof message.useMessage>[0];

function showSyncError(msgApi: MsgApi, rawMsg: string) {
  const lines = rawMsg.split('\n').filter(Boolean);
  msgApi.open({
    type: 'error',
    duration: 10,
    content: (
      <div style={{ maxWidth: 400 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ lineHeight: 1.6, fontSize: i === 0 ? 13 : 12, color: i === 0 ? undefined : '#595959' }}>
            {line}
          </div>
        ))}
      </div>
    ),
  });
}

/* ── Component ── */
const ToolGanttTab: React.FC = () => {
  useReadinessFlush();
  const { stations, source, setStations, completedElements, toggleElement, notes, setNote } = useToolGanttStore();

  const [deadline, setDeadline] = useState<string>(DEFAULT_DEADLINE);
  const [loading, setLoading] = useState(false);
  const [msgApi, msgCtx] = message.useMessage();
  const captureRef = useRef<HTMLDivElement>(null);

  /* ── SharePoint sync ── */
  const handleSpData = useCallback(
    (data: StationRecord[]) => {
      setStations(data, 'SharePoint');
    },
    [setStations],
  );
  const { sync: spSync, syncing: spSyncing, lastSyncAt } =
    useToolGanttSync(handleSpData);

  const hasUrl = !!getToolGanttWebhookUrl();

  /* ── Progress summary ── */
  const summary = useMemo(() => {
    if (!stations || stations.length === 0) return null;
    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })();
    let qualifyTotal = 0, qualifyDone = 0, overdueCount = 0, dueSoonCount = 0;
    for (const s of stations) {
      if (s.qualifyDone) {
        qualifyTotal++;
        if (`${s.station}|ms|qualifyDone` in completedElements) qualifyDone++;
      }
      for (const phase of MILESTONE_PHASES) {
        const d = s[phase.key as keyof typeof s] as string | null;
        if (!d) continue;
        const k = `${s.station}|ms|${phase.key}`;
        if (d < todayStr && !(k in completedElements)) overdueCount++;
        else if (d >= todayStr && d <= sevenStr && !(k in completedElements)) dueSoonCount++;
      }
    }
    return { qualifyTotal, qualifyDone, overdueCount, dueSoonCount };
  }, [stations, completedElements]);

  /* ── Screenshot ── */
  const takeScreenshot = useCallback(async () => {
    const el = captureRef.current;
    if (!el) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `station-gantt-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      msgApi.error('Screenshot failed: ' + msg);
    }
    setLoading(false);
  }, [msgApi]);

  /* ── Deadline display ── */
  const deadlineD = (() => {
    const d = new Date(deadline);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const deadlineFmt = `${deadlineD.getMonth() + 1}/${deadlineD.getDate()}`;

  /* ── Empty state ── */
  if (!stations) {
    /* Syncing in progress → show prominent loading screen */
    if (spSyncing) {
      return (
        <>
          {msgCtx}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 24px',
              gap: 20,
            }}
          >
            <LoadingOutlined style={{ fontSize: 52, color: '#3B82F6' }} spin />
            <Typography.Title level={4} style={{ color: '#3B82F6', margin: 0 }}>
              正在從 SharePoint 載入資料…
            </Typography.Title>
            <Typography.Text type="secondary" style={{ textAlign: 'center' }}>
              Power Automate Flow 執行中，請稍候。若超過 90 秒未回應，系統將自動中斷並顯示錯誤。
            </Typography.Text>
          </div>
        </>
      );
    }

    return (
      <>
        {msgCtx}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
            gap: 16,
          }}
        >
          <CloudDownloadOutlined style={{ fontSize: 48, color: '#D1D5DB' }} />
          <Typography.Title level={4} style={{ color: '#6B7280', margin: 0 }}>
            尚未載入 Process Readiness 資料
          </Typography.Title>
          <Typography.Text
            type="secondary"
            style={{ textAlign: 'center', maxWidth: 440 }}
          >
            請先到 <strong>Settings</strong> 頁面設定 Power Automate Webhook URL，
            再點「從 SharePoint 同步」載入各站別的工程進度資料。
          </Typography.Text>
          <Space>
            {hasUrl ? (
              <Popconfirm
                title="從 SharePoint 同步資料？"
                onConfirm={async () => {
                  try {
                    const res = await spSync();
                    msgApi.success(`已載入 ${res.count} 個站別資料`);
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    showSyncError(msgApi, msg);
                  }
                }}
                okText="同步"
                cancelText="取消"
              >
                <Button type="primary" icon={<CloudDownloadOutlined />}>
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
            <Button
              icon={<SettingOutlined />}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('yield-nav', { detail: 'settings' }),
                );
              }}
            >
              前往 Settings
            </Button>
          </Space>
        </div>
      </>
    );
  }

  /* ── Loaded state ── */
  return (
    <>
      {msgCtx}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Toolbar ── */}
        <div style={toolbarStyle}>
          <Space size={8} wrap>
            {/* Source indicator */}
            <Space size={6}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#22C55E',
                  display: 'inline-block',
                }}
              />
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
              <span
                style={{
                  fontSize: 12,
                  color: '#6B7280',
                  whiteSpace: 'nowrap',
                }}
              >
                Deadline
              </span>
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
            <Tooltip title="截圖存 PNG">
              <Button
                size="small"
                icon={<CameraOutlined />}
                onClick={takeScreenshot}
                loading={loading}
              >
                Screenshot
              </Button>
            </Tooltip>

            <Divider type="vertical" />

            {/* SharePoint sync */}
            {hasUrl ? (
              <Popconfirm
                title="從 SharePoint 同步會覆寫目前資料，確定繼續？"
                onConfirm={async () => {
                  const key = 'tg-sync';
                  msgApi.loading({ content: '正在從 SharePoint 載入資料…', key, duration: 0 });
                  try {
                    const res = await spSync();
                    msgApi.success({ content: `已載入 ${res.count} 個站別資料`, key, duration: 3 });
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    msgApi.open({ type: 'error', key, duration: 10,
                      content: (
                        <div style={{ maxWidth: 400 }}>
                          {msg.split('\n').filter(Boolean).map((line, i) => (
                            <div key={i} style={{ lineHeight: 1.6, fontSize: i === 0 ? 13 : 12, color: i === 0 ? undefined : '#595959' }}>
                              {line}
                            </div>
                          ))}
                        </div>
                      ),
                    });
                  }
                }}
                okText="同步"
                cancelText="取消"
              >
                <Button
                  size="small"
                  icon={<CloudDownloadOutlined />}
                  loading={spSyncing}
                >
                  SharePoint 同步
                </Button>
              </Popconfirm>
            ) : (
              <Tooltip title="請先在 Settings 頁面貼上 Webhook URL">
                <Button
                  size="small"
                  icon={<CloudDownloadOutlined />}
                  disabled
                >
                  SharePoint 同步
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>

        {/* ── Gantt + legend (captured for screenshot) ── */}
        <div
          ref={captureRef}
          style={{
            background: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
          }}
        >
          {/* Summary strip */}
          {summary && (
            <div style={summaryStripStyle}>
              <span>
                ✓ Qualified: <strong>{summary.qualifyDone}</strong>/{summary.qualifyTotal}
              </span>
              {summary.overdueCount > 0 && (
                <span style={{ color: '#EF4444' }}>
                  ▪ ⚠ {summary.overdueCount} overdue
                </span>
              )}
              {summary.dueSoonCount > 0 && (
                <span style={{ color: '#D97706' }}>
                  ▪ {summary.dueSoonCount} due within 7 days
                </span>
              )}
            </div>
          )}

          {/* Legend row 1: milestones + ref lines */}
          <div style={legendRowStyle}>
            {MILESTONE_PHASES.map(p => (
              <span key={p.key} style={legItemStyle}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    background: p.dot,
                    transform: 'rotate(45deg)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {p.label}
              </span>
            ))}
            <span
              style={{
                width: 1,
                height: 16,
                background: '#E5E7EB',
                margin: '0 4px',
              }}
            />
            <span style={legItemStyle}>
              <span
                style={{
                  width: 2,
                  height: 14,
                  background: '#D1D5DB',
                  flexShrink: 0,
                }}
              />
              Today
            </span>
            <span style={legItemStyle}>
              <span
                style={{
                  width: 2,
                  height: 14,
                  background: '#EF4444',
                  flexShrink: 0,
                }}
              />
              Deadline ({deadlineFmt})
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '.68rem',
                color: '#9CA3AF',
                fontWeight: 600,
              }}
            >
              {stations.length} stations
            </span>
          </div>

          {/* Legend row 2: period bars */}
          <div style={{ ...legendRowStyle, marginBottom: 10 }}>
            {MILESTONE_PERIODS.map(p => (
              <span key={p.label} style={legItemStyle}>
                <span
                  style={{
                    width: 18,
                    height: 8,
                    borderRadius: 2,
                    background: p.color,
                    opacity: 0.65,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {p.label}
              </span>
            ))}
          </div>

          {/* Gantt table */}
          {stations.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#CBD5E1',
                padding: '40px 0',
                fontSize: '.85rem',
              }}
            >
              No station data
            </div>
          ) : (
            <GanttErrorBoundary>
              <div
                style={{
                  overflow: 'clip',   /* clip ≠ hidden: rounds corners without killing sticky */
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                }}
              >
                <GanttTable
                  stations={stations}
                  deadline={deadline}
                  completedElements={completedElements}
                  onToggleElement={toggleElement}
                  notes={notes}
                  onSetNote={setNote}
                />
              </div>
            </GanttErrorBoundary>
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

const summaryStripStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  fontSize: '.72rem',
  color: '#374151',
  background: '#F8FAFC',
  border: '1px solid #E5E7EB',
  borderRadius: 5,
  padding: '5px 10px',
  marginBottom: 8,
  flexWrap: 'wrap',
};
