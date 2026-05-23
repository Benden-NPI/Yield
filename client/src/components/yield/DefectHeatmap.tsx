import React, { useMemo } from 'react';
import { Typography } from 'antd';
import { useYieldStore, heatmapPnByDefect } from '../../hooks/useYieldData';
import { METRIC_LABELS, YIELD_METRICS } from '../../types/yield';
import { ChartCard } from '../common/ChartCard';
import { EmptyHint } from '../common/EmptyHint';

const { Text } = Typography;

// Map a ratio (%) to a blue shade. Larger = darker = "worse"
function blueShade(ratio: number | null, max: number): { bg: string; fg: string } {
  if (ratio == null) return { bg: '#fafafa', fg: '#bfbfbf' };
  const r = Math.min(Math.max(ratio, 0), max) / Math.max(max, 1e-9);
  // 7 stops from light to dark blue
  const stops = ['#e6f4ff', '#bae0ff', '#91caff', '#69b1ff', '#4096ff', '#1677ff', '#0958d9', '#003a8c'];
  const idx = Math.min(stops.length - 1, Math.floor(r * (stops.length - 1)));
  const bg = stops[idx];
  const fg = idx >= 4 ? '#fff' : '#003a8c';
  return { bg, fg };
}

export const DefectHeatmap: React.FC = () => {
  const records = useYieldStore((s) => s.filteredRecords());
  const { pns, cells } = useMemo(() => heatmapPnByDefect(records), [records]);

  const maxRatio = useMemo(() => {
    let max = 0;
    for (const c of cells) {
      if (c.ratio != null && c.ratio > max) max = c.ratio;
    }
    return Math.max(max, 1);
  }, [cells]);

  return (
    <ChartCard
      title="PN × Defect Heatmap"
      subtitle="找出問題集中點"
      info="顏色越深代表該 PN 在該 Defect 的失效率越高 (defect / input %)。"
    >
      {pns.length === 0 ? (
        <EmptyHint height={200} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 4, minWidth: 480, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#003a8c' }}>PN \ Defect</th>
                {YIELD_METRICS.map((m) => (
                  <th key={m} style={{ padding: '4px 8px', color: '#003a8c' }}>{METRIC_LABELS[m]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pns.map((pn) => (
                <tr key={pn}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#222' }}>{pn}</td>
                  {YIELD_METRICS.map((m) => {
                    const cell = cells.find((c) => c.pn === pn && c.metric === m);
                    const ratio = cell?.ratio ?? null;
                    const { bg, fg } = blueShade(ratio, maxRatio);
                    return (
                      <td
                        key={m}
                        title={cell ? `${cell.count} / ${cell.input}` : 'N/A'}
                        style={{
                          background: bg,
                          color: fg,
                          padding: '8px 12px',
                          borderRadius: 4,
                          textAlign: 'center',
                          minWidth: 90,
                          fontWeight: 600,
                        }}
                      >
                        {ratio == null ? '—' : `${ratio}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>低</Text>
            <div style={{ display: 'flex', gap: 2 }}>
              {['#e6f4ff', '#bae0ff', '#91caff', '#69b1ff', '#4096ff', '#1677ff', '#0958d9', '#003a8c'].map((c) => (
                <div key={c} style={{ width: 18, height: 12, background: c, borderRadius: 2 }} />
              ))}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>高 (~{maxRatio.toFixed(1)}%)</Text>
          </div>
        </div>
      )}
    </ChartCard>
  );
};
