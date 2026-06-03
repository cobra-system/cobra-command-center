import { useRef, useCallback } from "react";
import type { TreemapRect } from "./treemapLayout";
import { getHealthColor } from "./treemapColors";
import { useTreemapScale } from "./TreemapContainer";

interface Props {
  rect: TreemapRect;
  offsetX: number;
  offsetY: number;
  onSelect: (item: TreemapRect["item"]) => void;
  onHoverCategory: (category: string | null) => void;
}

const DRAG_THRESHOLD = 5;

export default function TreemapCell({ rect, offsetX, offsetY, onSelect, onHoverCategory }: Props) {
  const scale = useTreemapScale();
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const { item } = rect;
  const w = rect.width;
  const h = rect.height;
  const bg = getHealthColor(item.stockQty, item.consumption);

  const scaledW = w * scale;
  const scaledH = h * scale;

  const sku = item.sku || "";
  const fontSize = Math.min(
    Math.max(8, Math.min((scaledW - 8) / (sku.length * 0.62), scaledH * 0.38)),
    28,
  );
  const showSku = scaledW > 25 && scaledH > 16 && sku.length > 0;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (mouseDownPos.current) {
      const dx = e.clientX - mouseDownPos.current.x;
      const dy = e.clientY - mouseDownPos.current.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        mouseDownPos.current = null;
        return;
      }
    }
    mouseDownPos.current = null;
    e.stopPropagation();
    onSelect(item);
  }, [item, onSelect]);

  const onMouseEnter = useCallback(() => {
    onHoverCategory(item.category);
  }, [item.category, onHoverCategory]);

  const onMouseLeave = useCallback(() => {
    onHoverCategory(null);
  }, [onHoverCategory]);

  return (
    <div
      className="absolute flex items-center justify-center overflow-hidden transition-[filter] duration-150 hover:brightness-125 hover:z-10"
      style={{
        left: rect.x - offsetX,
        top: rect.y - offsetY,
        width: w,
        height: h,
        backgroundColor: bg,
        border: "1px solid rgba(0,0,0,0.3)",
        cursor: "pointer",
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {showSku && (
        <span
          className="text-white font-bold drop-shadow-sm truncate px-1 font-mono select-none"
          style={{ fontSize: fontSize / scale, lineHeight: 1.1 }}
          dir="ltr"
        >
          {sku}
        </span>
      )}
    </div>
  );
}
