import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface Props {
  children: ReactNode;
  contentWidth: number;
  contentHeight: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const STEP = 0.15;

export default function TreemapContainer({ children, contentWidth, contentHeight }: Props) {
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPinchDist = useRef<number | null>(null);

  const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -STEP : STEP;
    setScale(prev => {
      const next = clampScale(prev + delta);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        setOrigin({ x: mx, y: my });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

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

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
        <button
          onClick={() => setScale(prev => clampScale(prev + STEP * 2))}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
        >
          <ZoomIn className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={() => setScale(prev => clampScale(prev - STEP * 2))}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
        >
          <ZoomOut className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={() => { setScale(1); setOrigin({ x: 0, y: 0 }); }}
          className="p-1.5 rounded bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
        >
          <Maximize2 className="h-4 w-4 text-foreground" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="overflow-auto rounded-lg border border-border bg-muted/30"
        style={{ height: "calc(100vh - 310px)", minHeight: 400 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            width: contentWidth,
            height: contentHeight,
            transform: `scale(${scale})`,
            transformOrigin: `${origin.x}px ${origin.y}px`,
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
