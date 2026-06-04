import { useCallback, useRef } from "react";
import type { CategoryRect } from "./treemapLayout";
import { getHealthColor } from "./treemapColors";

interface Props {
  layout: CategoryRect[];
  contentWidth: number;
  contentHeight: number;
  scale: number;
  panX: number;
  panY: number;
  viewportWidth: number;
  viewportHeight: number;
  onNavigate: (panX: number, panY: number) => void;
}

const MINIMAP_WIDTH = 160;

export default function TreemapMinimap({
  layout,
  contentWidth,
  contentHeight,
  scale,
  panX,
  panY,
  viewportWidth,
  viewportHeight,
  onNavigate,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const aspect = contentHeight / contentWidth;
  const mapW = MINIMAP_WIDTH;
  const mapH = mapW * aspect;
  const sx = contentWidth > 0 ? mapW / contentWidth : 1;
  const sy = contentHeight > 0 ? mapH / contentHeight : 1;

  const vpW = (viewportWidth / scale) * sx;
  const vpH = (viewportHeight / scale) * sy;
  const vpX = (-panX / scale) * sx;
  const vpY = (-panY / scale) * sy;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const contentX = clickX / sx;
      const contentY = clickY / sy;
      const newPanX = -(contentX - viewportWidth / (2 * scale)) * scale;
      const newPanY = -(contentY - viewportHeight / (2 * scale)) * scale;
      onNavigate(newPanX, newPanY);
    },
    [sx, sy, scale, viewportWidth, viewportHeight, onNavigate],
  );

  if (contentWidth <= 0 || contentHeight <= 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-3 right-3 z-20 rounded border border-border/60 bg-background/90 shadow-lg backdrop-blur-sm cursor-crosshair overflow-hidden"
      style={{ width: mapW, height: mapH }}
      onClick={handleClick}
    >
      {layout.map(cat =>
        cat.children.map(r => (
          <div
            key={r.item.id}
            className="absolute"
            style={{
              left: r.x * sx,
              top: r.y * sy,
              width: Math.max(1, r.width * sx),
              height: Math.max(1, r.height * sy),
              backgroundColor: getHealthColor(r.item.stockQty, r.item.consumption),
            }}
          />
        )),
      )}
      <div
        className="absolute border-2 border-white/80 rounded-sm"
        style={{
          left: Math.max(0, vpX),
          top: Math.max(0, vpY),
          width: Math.min(vpW, mapW - Math.max(0, vpX)),
          height: Math.min(vpH, mapH - Math.max(0, vpY)),
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
}
