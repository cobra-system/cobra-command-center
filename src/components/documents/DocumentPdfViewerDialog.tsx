/**
 * DocumentPdfViewerDialog
 * Full-screen inline PDF viewer using pdfjs-dist (already installed).
 * Opens instead of "new tab" when clicking a PDF document.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PurchaseDocument } from "./types";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download,
  PenLine, Loader2, X, ExternalLink, RotateCw,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: PurchaseDocument;
  onAnnotate?: (doc: PurchaseDocument) => void;
}

export default function DocumentPdfViewerDialog({ open, onOpenChange, doc, onAnnotate }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc,     setPdfDoc]     = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum,    setPageNum]    = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale,      setScale]      = useState(1.4);
  const [loading,    setLoading]    = useState(false);
  const [rotating,   setRotating]   = useState(false);
  const [rotation,   setRotation]   = useState(0); // 0 | 90 | 180 | 270

  // ── load ───────────────────────────────────────────────────────────────────
  const loadPdf = useCallback(async () => {
    if (!doc.file_url) return;
    setLoading(true);
    setPdfDoc(null);
    setPageNum(1);
    setRotation(0);
    try {
      const pdf = await pdfjsLib.getDocument({ url: doc.file_url }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
    } catch {
      // silently fail — user can open in new tab
    } finally {
      setLoading(false);
    }
  }, [doc.file_url]);

  useEffect(() => {
    if (open) loadPdf();
  }, [open, loadPdf]);

  // ── render page ────────────────────────────────────────────────────────────
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const vp   = page.getViewport({ scale, rotation });
    const cvs  = canvasRef.current;
    const dpr  = window.devicePixelRatio || 1;

    // Render at physical pixel resolution for crisp text on high-DPI screens
    cvs.width  = Math.floor(vp.width * dpr);
    cvs.height = Math.floor(vp.height * dpr);
    cvs.style.width  = `${vp.width}px`;
    cvs.style.height = `${vp.height}px`;

    const ctx = cvs.getContext("2d")!;
    // pdf.js takes a mutable number[] for the transform matrix.
    const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
    await page.render({ canvas: cvs, canvasContext: ctx, viewport: vp, transform }).promise;
  }, [pdfDoc, pageNum, scale, rotation]);

  useEffect(() => { renderPage(); }, [renderPage]);

  const zoomIn  = () => setScale(s => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const rotate  = () => setRotation(r => (r + 90) % 360);

  const docName = doc.document_name || doc.notes || "מסמך";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[95vh] p-0 flex flex-col gap-0 overflow-hidden"
        dir="rtl"
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background flex-shrink-0">
          <span className="font-semibold text-sm truncate flex-1">{docName}</span>

          {/* Page nav */}
          {totalPages > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pageNum <= 1} onClick={() => setPageNum(p => p - 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">{pageNum} / {totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pageNum >= totalPages} onClick={() => setPageNum(p => p + 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Zoom */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>הקטן</TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>הגדל</TooltipContent>
          </Tooltip>

          {/* Rotate */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={rotate} disabled={rotating}>
                <RotateCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>סובב</TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Download */}
          {doc.file_url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={doc.file_url} download={docName}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </TooltipTrigger>
              <TooltipContent>הורד</TooltipContent>
            </Tooltip>
          )}

          {/* Open in new tab */}
          {doc.file_url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </TooltipTrigger>
              <TooltipContent>פתח בטאב חדש</TooltipContent>
            </Tooltip>
          )}

          {/* Annotate / Sign */}
          {onAnnotate && (
            <Button variant="outline" size="sm" className="gap-1.5 h-7" onClick={() => { onOpenChange(false); onAnnotate(doc); }}>
              <PenLine className="h-3.5 w-3.5" />ערוך / חתום
            </Button>
          )}

          {/* Close */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Canvas area ── */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800 flex items-start justify-center p-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground mt-20">
              <Loader2 className="h-5 w-5 animate-spin" />טוען PDF...
            </div>
          )}
          {!loading && !pdfDoc && (
            <div className="flex flex-col items-center gap-3 mt-20 text-muted-foreground">
              <p>לא ניתן לטעון את ה-PDF</p>
              {doc.file_url && (
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-4 w-4" />פתח בטאב חדש
                  </Button>
                </a>
              )}
            </div>
          )}
          {pdfDoc && (
            <div className="shadow-2xl rounded-sm overflow-hidden bg-white">
              <canvas ref={canvasRef} className="block" />
            </div>
          )}
        </div>

        {/* ── Footer: keyboard hints ── */}
        {pdfDoc && (
          <div className="flex items-center justify-center gap-4 py-1.5 border-t bg-background text-[10px] text-muted-foreground flex-shrink-0">
            <span>← → ניווט בין עמודים</span>
            <span className="w-px h-3 bg-border" />
            <span>+ / - זום</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
