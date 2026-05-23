import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { message } from 'antd';

/**
 * Captures the DOM subtree referenced by `targetRef` and saves it as a
 * multi-page A4 (landscape) PDF. Used by the Overview / Yield Reports tabs.
 */
export function usePdfExport(
  targetRef: RefObject<HTMLElement | null>,
  baseFileName: string,
): { exportPdf: () => Promise<void>; isExporting: boolean } {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    const node = targetRef.current;
    if (!node) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentWidth = pageWidth - margin * 2;

      // Scale captured image so its width matches the printable area.
      const ratio = contentWidth / canvas.width;
      const imgHeight = canvas.height * ratio;
      const pageContentHeight = pageHeight - margin * 2;

      const imgData = canvas.toDataURL('image/png');

      if (imgHeight <= pageContentHeight) {
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

      const ts = new Date().toISOString().slice(0, 10);
      pdf.save(`${baseFileName}-${ts}.pdf`);
      message.success(`PDF saved: ${baseFileName}-${ts}.pdf`);
    } catch (err) {
      // Surface failures (e.g. unsupported CSS color, tainted canvas) instead
      // of silently producing nothing.
      console.error('PDF export failed:', err);
      message.error(`PDF export failed: ${(err as Error)?.message ?? 'unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }, [targetRef, baseFileName]);

  return { exportPdf, isExporting };
}
