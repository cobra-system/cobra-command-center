/**
 * DocumentAnnotationEditor
 * Full-screen PDF viewer with drawing/annotation tools and digital signature.
 *
 * Tech:
 *   • pdfjs-dist  — render PDF pages to <canvas>
 *   • fabric v6   — interactive drawing overlay (named exports)
 *   • pdf-lib     — merge annotations into final PDF for saving
 *   • SignaturePadDialog — captures handwritten signature
 */
import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Canvas as FabricCanvas, PencilBrush, IText, Rect, FabricImage } from "fabric";
import { PDFDocument } from "pdf-lib";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { PurchaseDocument } from "./types";
import SignaturePadDialog from "./SignaturePadDialog";
import {
  Pen, Highlighter, Type, Square, Eraser, PenLine,
  ChevronLeft, ChevronRight, Save, Loader2, X,
} from "lucide-react";

// Point pdfjs at the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Tool = "pen" | "highlighter" | "text" | "rect" | "eraser" | "select";

const COLORS          = ["#000000", "#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed"];
const HIGHLIGHT_COLORS = ["#fef08a", "#86efac", "#93c5fd", "#f9a8d4"];

interface PageAnnotations { json: object }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: PurchaseDocument;
  onSaved: () => void;
}

export default function DocumentAnnotationEditor({ open, onOpenChange, doc, onSaved }: Props) {
  const [pdfDoc,     setPdfDoc]     = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum,    setPageNum]    = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [tool,      setTool]      = useState<Tool>("pen");
  const [color,     setColor]     = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);
  const [sigOpen,   setSigOpen]   = useState(false);

  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const fabricRef    = useRef<FabricCanvas | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  const annotationsRef = useRef<Record<number, PageAnnotations>>({});

  // ── load PDF ────────────────────────────────────────────────────────────────
  const loadPdf = useCallback(async () => {
    if (!doc.file_url) return;
    setLoading(true);
    try {
      const pdf = await pdfjsLib.getDocument({ url: doc.file_url }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setPageNum(1);
    } catch {
      toast.error("לא ניתן לטעון את קובץ ה-PDF");
    } finally {
      setLoading(false);
    }
  }, [doc.file_url]);

  // ── render page ─────────────────────────────────────────────────────────────
  const renderPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, num: number) => {
    const page  = await pdf.getPage(num);
    const scale = 1.5;
    const vp    = page.getViewport({ scale });
    const pdfCvs = pdfCanvasRef.current;
    if (!pdfCvs) return;
    const dpr = window.devicePixelRatio || 1;

    // Render at physical pixel resolution for crisp text on high-DPI screens
    pdfCvs.width  = Math.floor(vp.width * dpr);
    pdfCvs.height = Math.floor(vp.height * dpr);
    pdfCvs.style.width  = `${vp.width}px`;
    pdfCvs.style.height = `${vp.height}px`;

    const ctx = pdfCvs.getContext("2d")!;
    ctx.scale(dpr, dpr);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const fc = fabricRef.current;
    if (fc) {
      fc.setDimensions({ width: vp.width, height: vp.height });
      const saved = annotationsRef.current[num];
      if (saved) {
        fc.loadFromJSON(saved.json).then(() => fc.renderAll());
      } else {
        fc.clear();
        fc.renderAll();
      }
    }
  }, []);

  // ── init fabric ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    loadPdf();
  }, [open, loadPdf]);

  useEffect(() => {
    if (!open || !pdfDoc || !canvasElRef.current) return;
    const canvas = new FabricCanvas(canvasElRef.current, {
      isDrawingMode: true,
      selection: false,
    });

    // Fabric wraps the canvas in a container div with position:relative.
    // We need it absolutely positioned over the PDF canvas.
    const wrapper = canvas.wrapperEl;
    if (wrapper) {
      wrapper.style.position = "absolute";
      wrapper.style.inset = "0";
    }

    fabricRef.current = canvas;
    return () => { canvas.dispose(); fabricRef.current = null; };
  }, [open, pdfDoc]);

  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, pageNum);
  }, [pdfDoc, pageNum, renderPage]);

  // ── apply tool ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (tool === "select" || tool === "eraser") {
      canvas.isDrawingMode = false;
      canvas.selection = tool === "select";
    } else if (tool === "pen") {
      canvas.isDrawingMode = true;
      const brush = new PencilBrush(canvas);
      brush.color = color;
      brush.width = lineWidth;
      canvas.freeDrawingBrush = brush;
    } else if (tool === "highlighter") {
      canvas.isDrawingMode = true;
      const brush = new PencilBrush(canvas);
      brush.color = color + "80";
      brush.width = lineWidth * 5;
      canvas.freeDrawingBrush = brush;
    } else {
      canvas.isDrawingMode = false;
    }

    // Set cursor based on active tool
    canvas.defaultCursor = tool === "text" ? "text" : tool === "eraser" ? "crosshair" : "default";
    canvas.freeDrawingCursor = tool === "pen" || tool === "highlighter" ? "crosshair" : "default";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (tool === "eraser" && (e.key === "Delete" || e.key === "Backspace")) {
        const active = canvas.getActiveObjects();
        active.forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject();
        canvas.renderAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tool, color, lineWidth]);

  // ── mouse-up eraser ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== "eraser") return;
    const handler = () => {
      canvas.isDrawingMode = false;
      canvas.getActiveObjects().forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.renderAll();
    };
    canvas.on("mouse:up", handler);
    return () => { canvas.off("mouse:up", handler); };
  }, [tool]);

  // ── add text via Fabric event ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== "text") return;

    const handler = (opt: { e: PointerEvent }) => {
      const pointer = canvas.getScenePoint(opt.e);
      const text = new IText("טקסט", {
        left: pointer.x,
        top: pointer.y,
        fontSize: 18,
        fill: color,
        fontFamily: "Heebo, sans-serif",
        editable: true,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      canvas.renderAll();
      setTool("select");
    };

    canvas.on("mouse:down", handler);
    return () => { canvas.off("mouse:down", handler); };
  }, [tool, color]);

  // ── add rect ─────────────────────────────────────────────────────────────────
  const handleAddRect = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.add(new Rect({
      left: 60, top: 60, width: 160, height: 80,
      fill: "transparent", stroke: color, strokeWidth: lineWidth, selectable: true,
    }));
    canvas.renderAll();
  };

  // ── page nav ─────────────────────────────────────────────────────────────────
  const saveCurrentPage = () => {
    if (fabricRef.current)
      annotationsRef.current[pageNum] = { json: fabricRef.current.toObject() };
  };
  const goToPage = (next: number) => { saveCurrentPage(); setPageNum(next); };

  // ── signature ────────────────────────────────────────────────────────────────
  const handleAddSignature = (dataUrl: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    FabricImage.fromURL(dataUrl).then(img => {
      img.scaleToWidth(200);
      img.set({ left: 100, top: 100, selectable: true });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    });
  };

  // ── save to Supabase ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!pdfDoc || !doc.file_url) return;
    saveCurrentPage();
    setSaving(true);
    try {
      const res      = await fetch(doc.file_url);
      const pdfBytes = await res.arrayBuffer();
      const libDoc   = await PDFDocument.load(pdfBytes);

      for (let p = 1; p <= totalPages; p++) {
        const saved = annotationsRef.current[p];
        if (!saved) continue;

        // Render annotation layer to offscreen canvas at 2x for crisp output
        const offscreen = document.createElement("canvas");
        const pdfPage   = await pdfDoc.getPage(p);
        const vp        = pdfPage.getViewport({ scale: 1.5 });
        offscreen.width  = vp.width;
        offscreen.height = vp.height;

        const tempFc = new FabricCanvas(offscreen, { enableRetinaScaling: false });
        tempFc.setDimensions({ width: vp.width, height: vp.height });
        await tempFc.loadFromJSON(saved.json);
        tempFc.renderAll();
        const pngDataUrl = tempFc.toDataURL({ format: "png", multiplier: 2 });
        tempFc.dispose();

        const pngData  = await fetch(pngDataUrl).then(r => r.arrayBuffer());
        const pngImage = await libDoc.embedPng(pngData);
        const libPage  = libDoc.getPage(p - 1);
        libPage.drawImage(pngImage, { x: 0, y: 0, width: libPage.getWidth(), height: libPage.getHeight(), opacity: 1 });
      }

      const finalBytes = await libDoc.save();
      const blob = new Blob([finalBytes], { type: "application/pdf" });

      const filename    = doc.document_name || `document_${doc.id}.pdf`;
      const sanitized   = filename.replace(/[^a-zA-Z0-9._\u0590-\u05FF-]/g, "_");
      const storagePath = `uploads/annotated_${Date.now()}_${sanitized}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, blob, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(storagePath);

      const { error: dbError } = await supabase
        .from("purchase_documents")
        .update({ file_url: publicUrl })
        .eq("id", doc.id);
      if (dbError) throw dbError;

      toast.success("המסמך נשמר בהצלחה עם ההערות");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בשמירת המסמך");
    } finally {
      setSaving(false);
    }
  };

  const toolButtons: { id: Tool; icon: React.ReactNode; label: string; onClick?: () => void }[] = [
    { id: "select",      icon: <PenLine className="h-4 w-4" />,      label: "בחירה" },
    { id: "pen",         icon: <Pen className="h-4 w-4" />,          label: "עט" },
    { id: "highlighter", icon: <Highlighter className="h-4 w-4" />,  label: "הדגשה" },
    { id: "text",        icon: <Type className="h-4 w-4" />,         label: "טקסט" },
    { id: "rect",        icon: <Square className="h-4 w-4" />,       label: "מלבן", onClick: handleAddRect },
    { id: "eraser",      icon: <Eraser className="h-4 w-4" />,       label: "מחיקה" },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[96vh] p-0 flex flex-col" dir="rtl">
          {/* Toolbar */}
          <SheetHeader className="flex-row items-center gap-3 px-4 py-2 border-b bg-muted/30 flex-shrink-0 space-y-0">
            <SheetTitle className="text-sm font-semibold">{doc.document_name || "עריכת מסמך"}</SheetTitle>

            <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-background">
              {toolButtons.map(btn => (
                <Tooltip key={btn.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => btn.onClick ? btn.onClick() : setTool(btn.id)}
                      className={cn("p-1.5 rounded-md transition-colors", tool === btn.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                    >
                      {btn.icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{btn.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Color swatches */}
            <div className="flex items-center gap-1">
              {(tool === "highlighter" ? HIGHLIGHT_COLORS : COLORS).map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  className={cn("w-5 h-5 rounded-full border-2 transition-transform", color === c ? "border-foreground scale-125" : "border-transparent")}
                />
              ))}
            </div>

            {/* Line width */}
            <div className="flex items-center gap-2 w-28">
              <span className="text-xs text-muted-foreground shrink-0">עובי</span>
              <Slider min={1} max={12} step={1} value={[lineWidth]} onValueChange={([v]) => setLineWidth(v)} className="flex-1" />
            </div>

            <div className="flex-1" />

            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSigOpen(true)}>
              <Pen className="h-3.5 w-3.5" />חתימה
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              שמור PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          {/* Canvas area */}
          <div className="flex-1 overflow-auto flex flex-col items-center gap-4 p-4 bg-gray-100 dark:bg-gray-900">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground mt-12">
                <Loader2 className="h-5 w-5 animate-spin" />טוען PDF...
              </div>
            )}
            {!loading && !pdfDoc && (
              <div className="text-muted-foreground mt-12">לא נמצא קובץ PDF</div>
            )}
            {pdfDoc && (
              <div className="relative shadow-xl rounded-sm overflow-hidden" style={{ display: "inline-block" }}>
                <canvas ref={pdfCanvasRef} className="block" />
                <canvas
                  ref={canvasElRef}
                  className="absolute inset-0"
                />
              </div>
            )}
          </div>

          {/* Page navigation */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-2 border-t bg-background flex-shrink-0">
              <Button variant="ghost" size="sm" disabled={pageNum <= 1} onClick={() => goToPage(pageNum - 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">עמוד {pageNum} מתוך {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={pageNum >= totalPages} onClick={() => goToPage(pageNum + 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <SignaturePadDialog open={sigOpen} onOpenChange={setSigOpen} onConfirm={handleAddSignature} />
    </>
  );
}
