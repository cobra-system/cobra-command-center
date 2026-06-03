import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface Props {
  children: ReactNode;
  contentWidth: number;
  contentHeight: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const ZOOM_SENSITIVITY = 0.001;

export default function TreemapContainer({ children, contentWidth, contentHeight }: Props) {
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

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
        <button
          onClick={() => zoomBy(1.3)}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
        >
          <ZoomIn className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={() => zoomBy(0.7)}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
        >
          <ZoomOut className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
        >
          <Maximize2 className="h-4 w-4 text-foreground" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-border bg-muted/30"
        style={{ height: "calc(100vh - 310px)", minHeight: 400, cursor: "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => { isDragging.current = false; e.currentTarget.style.cursor = "grab"; }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
      </div>
    </div>
  );
}
