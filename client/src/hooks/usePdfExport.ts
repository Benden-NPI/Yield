import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { message } from 'antd';

export interface PdfExportOptions {
  /**
   * Called before any DOM capture happens. Use this to mount off-screen export
   * containers (e.g. so the Overview PDF can also capture Yield Reports).
   * Await this; setState here will be applied before capture proceeds.
   */
  beforeCapture?: () => void | Promise<void>;
  /** Called after capture finishes (success or failure). */
  afterCapture?: () => void | Promise<void>;
  /**
   * Milliseconds to wait after `beforeCapture` resolves, to let layout settle
   * and Recharts' ResponsiveContainer measure off-screen subtrees. Defaults to
   * 0; pass ~600 when capturing newly-mounted chart-heavy sections.
   */
  prepareDelayMs?: number;
}

type RefLike = RefObject<HTMLElement | null>;

/**
 * Captures one or more DOM subtrees and saves them as a multi-page A4
 * (landscape) PDF. Each ref becomes its own section: each section starts on a
 * new page, and oversize sections are sliced into multiple pages. Used by the
 * Overview (combined: Overview + Yield Reports) and Yield Reports tabs.
 */
export function usePdfExport(
  target: RefLike | RefLike[],
  baseFileName: string,
  options?: PdfExportOptions,
): { exportPdf: () => Promise<void>; isExporting: boolean } {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      if (options?.beforeCapture) {
        await options.beforeCapture();
      }
      if (options?.prepareDelayMs && options.prepareDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.prepareDelayMs));
      }

      const refs = Array.isArray(target) ? target : [target];
      const nodes = refs.map((r) => r.current).filter((n): n is HTMLElement => !!n);
      if (nodes.length === 0) {
        message.warning('Nothing to export.');
        return;
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentWidth = pageWidth - margin * 2;
      const pageContentHeight = pageHeight - margin * 2;

      let firstSection = true;

      for (const node of nodes) {
        // Capture the section to a single tall canvas first.
        const canvas = await html2canvas(node, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          windowWidth: node.scrollWidth,
          windowHeight: node.scrollHeight,
        });

        // Find every chart-card (or other PDF-block) inside this section and
        // compute its top/bottom offsets in *canvas pixels*. These are the
        // preferred page-break boundaries — we will avoid slicing through any
        // block whenever possible.
        const nodeRect = node.getBoundingClientRect();
        const captureScale = canvas.height / Math.max(1, node.scrollHeight);
        const blockEls = Array.from(
          node.querySelectorAll<HTMLElement>('[data-pdf-block="true"]'),
        );
        const blockBoundaries: Array<{ top: number; bottom: number }> = blockEls
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              top: Math.max(0, Math.round((r.top - nodeRect.top) * captureScale)),
              bottom: Math.min(
                canvas.height,
                Math.round((r.bottom - nodeRect.top) * captureScale),
              ),
            };
          })
          .filter((b) => b.bottom > b.top)
          .sort((a, b) => a.top - b.top);

        // Scale captured image so its width matches the printable area.
        const ratio = contentWidth / canvas.width;
        const imgHeight = canvas.height * ratio;
        const sliceHeightPx = Math.floor(pageContentHeight / ratio);

        if (!firstSection) {
          pdf.addPage();
        }
        firstSection = false;

        if (imgHeight <= pageContentHeight) {
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight);
          continue;
        }

        // Pick the largest page-break y that
        //   1) is > pageStart (makes progress), and
        //   2) is <= pageStart + sliceHeightPx (fits on the page), and
        //   3) does not cut through any chart-card block.
        // Candidate breaks: bottom of each block, and top of each block.
        // Fallback: if no candidate fits (a single block is taller than a
        // page), we slice at the page height — same as the old behaviour but
        // only for the oversized block.
        const candidates = new Set<number>();
        candidates.add(canvas.height);
        for (const b of blockBoundaries) {
          candidates.add(b.top);
          candidates.add(b.bottom);
        }
        const sortedCandidates = Array.from(candidates).sort((a, b) => a - b);

        const isInsideBlock = (y: number): boolean => {
          // Strictly inside means y cuts through a block (excludes the very
          // top/bottom edges so block-aligned breaks are still allowed).
          for (const b of blockBoundaries) {
            if (y > b.top && y < b.bottom) return true;
          }
          return false;
        };

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) throw new Error('Failed to create 2D context for PDF slicing');

        let pageStart = 0;
        let pageIndex = 0;
        while (pageStart < canvas.height) {
          const hardLimit = Math.min(canvas.height, pageStart + sliceHeightPx);

          // Prefer the largest candidate boundary in (pageStart, hardLimit].
          let pageEnd = hardLimit;
          let bestCandidate = -1;
          for (const c of sortedCandidates) {
            if (c <= pageStart) continue;
            if (c > hardLimit) break;
            bestCandidate = c;
          }
          if (bestCandidate > pageStart) {
            pageEnd = bestCandidate;
          } else {
            // No block boundary fits in this page. This only happens when a
            // single block is taller than one page; we have to mid-slice.
            // Slice at hardLimit, but make sure we still advance.
            pageEnd = hardLimit;
          }

          // Safety: if the chosen pageEnd falls strictly inside a block (can
          // happen on the very last page when the remainder is small), back
          // off to the block's top — unless that would not advance, in which
          // case fall back to slicing at hardLimit.
          if (isInsideBlock(pageEnd) && pageEnd !== canvas.height) {
            const blockContaining = blockBoundaries.find(
              (b) => pageEnd > b.top && pageEnd < b.bottom,
            );
            if (blockContaining && blockContaining.top > pageStart) {
              pageEnd = blockContaining.top;
            } else {
              pageEnd = hardLimit;
            }
          }

          const thisSlicePx = pageEnd - pageStart;
          if (thisSlicePx <= 0) {
            // Shouldn't happen, but guard against infinite loop.
            break;
          }

          sliceCanvas.height = thisSlicePx;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0, pageStart, canvas.width, thisSlicePx,
            0, 0, canvas.width, thisSlicePx,
          );
          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(
            sliceCanvas.toDataURL('image/png'),
            'PNG',
            margin,
            margin,
            contentWidth,
            thisSlicePx * ratio,
          );
          pageStart = pageEnd;
          pageIndex += 1;
        }
      }

      const ts = new Date().toISOString().slice(0, 10);
      pdf.save(`${baseFileName}-${ts}.pdf`);
      message.success(`PDF saved: ${baseFileName}-${ts}.pdf`);
    } catch (err) {
      // Surface failures (e.g. unsupported CSS color, tainted canvas) instead
      // of silently producing nothing.
      console.error('PDF export failed:', err);
      message.error(`PDF export failed: ${(err as Error)?.message ?? 'unknown error'}`);
    } finally {
      if (options?.afterCapture) {
        try { await options.afterCapture(); } catch { /* ignore */ }
      }
      setIsExporting(false);
    }
  }, [target, baseFileName, options]);

  return { exportPdf, isExporting };
}
