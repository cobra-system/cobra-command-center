import { useState, useRef, useCallback, useEffect, createContext, useContext, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { CategoryRect } from "./treemapLayout";
import TreemapMinimap from "./TreemapMinimap";

interface Props {
  children: ReactNode;
  contentWidth: number;
  contentHeight: number;
  layout: CategoryRect[];
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_SENSITIVITY = 0.001;

const ScaleContext = createContext(1);
export function useTreemapScale() { return useContext(ScaleContext); }

export default function TreemapContainer({ children, contentWidth, contentHeight, layout }: Props) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

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

      setPan(p => ({
        x: mx - ratio * (mx - p.x),
        y: my - ratio * (my - p.y),
      }));

      return next;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    e.currentTarget.style.cursor = "grabbing";
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    isDragging.current = false;
    e.currentTarget.style.cursor = "grab";
  }, []);

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
    setScale(prev => clampScale(prev + diff * 0.005));
    lastPinchDist.current = dist;
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setScale(prev => {
      const next = clampScale(prev * factor);
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const ratio = next / prev;
        setPan(p => ({
          x: cx - ratio * (cx - p.x),
          y: cy - ratio * (cy - p.y),
        }));
      }
      return next;
    });
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMinimapNavigate = useCallback((newPanX: number, newPanY: number) => {
    setPan({ x: newPanX, y: newPanY });
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setScale(prev => {
      const next = clampScale(prev * 2);
      const ratio = next / prev;
      setPan(p => ({
        x: mx - ratio * (mx - p.x),
        y: my - ratio * (my - p.y),
      }));
      return next;
    });
  }, []);

  const viewportRect = containerRef.current?.getBoundingClientRect();
  const viewportWidth = viewportRect?.width ?? contentWidth;
  const viewportHeight = viewportRect?.height ?? contentHeight;

  const zoomPercent = Math.round(scale * 100);

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
        {scale > 1 && (
          <div className="text-[10px] font-mono text-center text-muted-foreground bg-background/80 border border-border rounded px-1 py-0.5">
            {zoomPercent}%
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-border bg-muted/30"
        style={{ height: "calc(100vh - 310px)", minHeight: 400, cursor: "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onMouseLeave={(e) => { isDragging.current = false; e.currentTarget.style.cursor = "grab"; }}
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
