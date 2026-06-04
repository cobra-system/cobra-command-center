import { useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import type { TreemapRect } from "./treemapLayout";
import { getHealthColor } from "./treemapColors";
import { useTreemapScale } from "./TreemapContainer";
import TreemapTooltip from "./TreemapTooltip";

interface Props {
  rect: TreemapRect;
  offsetX: number;
  offsetY: number;
  onSelect: (item: TreemapRect["item"]) => void;
  onHoverCategory: (category: string | null) => void;
  isSearchMatch: boolean | null;
}

const DRAG_THRESHOLD = 5;

export default function TreemapCell({ rect, offsetX, offsetY, onSelect, onHoverCategory, isSearchMatch }: Props) {
  const scale = useTreemapScale();
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

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
  const showName = scaledW > 100 && scaledH > 50;
  const showMonths = scaledW > 60 && scaledH > 40 && item.consumption > 0;
  const showIncoming = scaledW > 30 && scaledH > 30 && (item.incomingQty ?? 0) > 0;
  const showIssues = scaledW > 24 && scaledH > 24 && (item.openIssues ?? 0) > 0;
  const needsReorder = item.reorderPoint != null && item.reorderPoint > 0 && item.stockQty <= item.reorderPoint;
  const showReorder = scaledW > 20 && scaledH > 20 && needsReorder;
  const months = item.consumption > 0 ? (item.stockQty / item.consumption).toFixed(1) : null;

  const dimmed = isSearchMatch === false;
  const highlighted = isSearchMatch === true;

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

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip({ x: e.clientX, y: e.clientY });
  }, []);

  const onMouseLeave = useCallback(() => {
    onHoverCategory(null);
    setTooltip(null);
  }, [onHoverCategory]);

  return (
    <>
      <div
        className="absolute flex items-center justify-center overflow-hidden transition-[filter,opacity] duration-150 hover:brightness-125 hover:z-10"
        style={{
          left: rect.x - offsetX,
          top: rect.y - offsetY,
          width: w,
          height: h,
          backgroundColor: bg,
          border: highlighted
            ? "2px solid #f59e0b"
            : "1px solid rgba(0,0,0,0.3)",
          boxShadow: highlighted ? "0 0 8px rgba(245,158,11,0.5)" : undefined,
          opacity: dimmed ? 0.3 : 1,
          cursor: "pointer",
        }}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <div className="flex flex-col items-center justify-center gap-0 overflow-hidden px-1">
          {showSku && (
            <span
              className="text-white font-bold drop-shadow-sm truncate font-mono select-none"
              style={{ fontSize: fontSize / scale, lineHeight: 1.1 }}
              dir="ltr"
            >
              {sku}
            </span>
          )}
          {showName && (
            <span
              className="text-white/70 truncate select-none max-w-full text-center"
              style={{ fontSize: Math.max(8, fontSize * 0.6) / scale, lineHeight: 1.2 }}
            >
              {item.name}
            </span>
          )}
          {showMonths && !showName && (
            <span
              className="text-white/50 select-none font-mono"
              style={{ fontSize: Math.max(7, fontSize * 0.55) / scale, lineHeight: 1.1 }}
            >
              {months}m
            </span>
          )}
        </div>
        {showIncoming && (
          <div
            className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-blue-600/80 text-white rounded-sm px-1"
            style={{ fontSize: Math.max(8, 10 / scale), lineHeight: 1.2 }}
          >
            <span className="font-medium">+{item.incomingQty}</span>
          </div>
        )}
        {showIssues && (
          <div
            className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 bg-amber-500/90 text-white rounded-sm px-1"
            style={{ fontSize: Math.max(8, 10 / scale), lineHeight: 1.2 }}
            title={`${item.openIssues} תקלות פתוחות`}
          >
            <span className="font-medium">⚠ {item.openIssues}</span>
          </div>
        )}
        {showReorder && (
          <div
            className="absolute top-0 right-0"
            title="מתחת לנקודת הזמנה"
            style={{ width: Math.max(8, 14 / scale), height: Math.max(8, 14 / scale) }}
          >
            <div
              className="w-full h-full"
              style={{
                background: "linear-gradient(135deg, transparent 50%, #ef4444 50%)",
              }}
            />
          </div>
        )}
      </div>
      {tooltip && !dimmed && createPortal(
        <TreemapTooltip item={item} x={tooltip.x} y={tooltip.y} />,
        document.body,
      )}
    </>
  );
}
