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
        const canvas = await html2canvas(node, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          windowWidth: node.scrollWidth,
          windowHeight: node.scrollHeight,
        });

        // Scale captured image so its width matches the printable area.
        const ratio = contentWidth / canvas.width;
        const imgHeight = canvas.height * ratio;

        if (!firstSection) {
          pdf.addPage();
        }
        firstSection = false;

        if (imgHeight <= pageContentHeight) {
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight);
        } else {
          // Slice the source canvas into page-height chunks and add each as its own page.
          const sliceHeightPx = Math.floor(pageContentHeight / ratio);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceHeightPx;
          const ctx = sliceCanvas.getContext('2d');
          if (!ctx) throw new Error('Failed to create 2D context for PDF slicing');

          let y = 0;
          let pageIndex = 0;
          while (y < canvas.height) {
            const remaining = canvas.height - y;
            const thisSlicePx = Math.min(sliceHeightPx, remaining);
            if (sliceCanvas.height !== thisSlicePx) {
              sliceCanvas.height = thisSlicePx;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(
              canvas,
              0, y, canvas.width, thisSlicePx,
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
            y += thisSlicePx;
            pageIndex += 1;
          }
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
