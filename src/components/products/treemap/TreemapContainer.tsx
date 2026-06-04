import { useState, useRef, useCallback, useEffect, createContext, useContext, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { CategoryRect } from "./treemapLayout";
import TreemapMinimap from "./TreemapMinimap";

interface Props {
  children: ReactNode;
  contentWidth: number;
  contentHeight: number;
  viewportHeight: number;
  layout: CategoryRect[];
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_SENSITIVITY = 0.001;

const ScaleContext = createContext(1);
export function useTreemapScale() { return useContext(ScaleContext); }

export default function TreemapContainer({ children, contentWidth, contentHeight, viewportHeight: vpHeight, layout }: Props) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

  const clampPan = useCallback((p: { x: number; y: number }, s: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const el = containerRef.current;
    if (!el) return p;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const scaledW = contentWidth * s;
    const scaledH = contentHeight * s;
    const minX = vw - scaledW;
    const minY = vh - scaledH;
    return {
      x: Math.min(0, Math.max(minX, p.x)),
      y: Math.min(0, Math.max(minY, p.y)),
    };
  }, [contentWidth, contentHeight]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setScale(prev => {
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const next = clampScale(prev * (1 + delta));
      const ratio = next / prev;

      setPan(p => clampPan({
        x: mx - ratio * (mx - p.x),
        y: my - ratio * (my - p.y),
      }, next));

      return next;
    });
  }, [clampPan]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || scale <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    (e.currentTarget as HTMLElement).style.cursor = "grabbing";
  }, [pan, scale]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan(clampPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    }, scale));
  }, [scale, clampPan]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    isDragging.current = false;
    (e.currentTarget as HTMLElement).style.cursor = scale > 1 ? "grab" : "default";
  }, [scale]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || lastPinchDist.current === null) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const diff = dist - lastPinchDist.current;
    setScale(prev => {
      const next = clampScale(prev + diff * 0.005);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
    lastPinchDist.current = dist;
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setScale(prev => {
      const next = clampScale(prev * factor);
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
        return next;
      }
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const ratio = next / prev;
        setPan(p => clampPan({
          x: cx - ratio * (cx - p.x),
          y: cy - ratio * (cy - p.y),
        }, next));
      }
      return next;
    });
  }, [clampPan]);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMinimapNavigate = useCallback((newPanX: number, newPanY: number) => {
    setPan(clampPan({ x: newPanX, y: newPanY }, scale));
  }, [clampPan, scale]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setScale(prev => {
      const next = clampScale(prev * 2);
      const ratio = next / prev;
      setPan(p => clampPan({
        x: mx - ratio * (mx - p.x),
        y: my - ratio * (my - p.y),
      }, next));
      return next;
    });
  }, [clampPan]);

  const viewportRect = containerRef.current?.getBoundingClientRect();
  const viewportWidth = viewportRect?.width ?? contentWidth;
  const viewportHeight = viewportRect?.height ?? contentHeight;

  const zoomPercent = Math.round(scale * 100);
  const isZoomed = scale > 1;

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
        <button
          onClick={() => zoomBy(1.3)}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
          title="זום אין"
        >
          <ZoomIn className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={() => zoomBy(0.7)}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
          title="זום אוט"
        >
          <ZoomOut className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
          title="איפוס תצוגה"
        >
          <Maximize2 className="h-4 w-4 text-foreground" />
        </button>
        {isZoomed && (
          <div className="text-[10px] font-mono text-center text-muted-foreground bg-background/80 border border-border rounded px-1 py-0.5">
            {zoomPercent}%
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-border bg-muted/30"
        style={{ height: vpHeight, cursor: isZoomed ? "grab" : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onMouseLeave={(e) => { isDragging.current = false; e.currentTarget.style.cursor = isZoomed ? "grab" : "default"; }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ScaleContext.Provider value={scale}>
          <div
            style={{
              width: contentWidth,
              height: contentHeight,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              position: "relative",
            }}
          >
            {children}
          </div>
        </ScaleContext.Provider>
      </div>

      {scale > 1.1 && (
        <TreemapMinimap
          layout={layout}
          contentWidth={contentWidth}
          contentHeight={contentHeight}
          scale={scale}
          panX={pan.x}
          panY={pan.y}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
          onNavigate={handleMinimapNavigate}
        />
      )}
    </div>
  );
}
