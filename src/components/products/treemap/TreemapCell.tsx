import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import type { TreemapRect } from "./treemapLayout";
import { getHealthColor } from "./treemapColors";
import TreemapTooltip from "./TreemapTooltip";

interface Props {
  rect: TreemapRect;
  offsetX: number;
  offsetY: number;
}

export default function TreemapCell({ rect, offsetX, offsetY }: Props) {
  const navigate = useNavigate();
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const { item } = rect;
  const w = rect.width;
  const h = rect.height;
  const bg = getHealthColor(item.stockQty, item.consumption);

  const sku = item.sku || "";
  const fontSize = Math.min(
    Math.max(8, Math.min((w - 8) / (sku.length * 0.62), h * 0.38)),
    28,
  );
  const showSku = w > 25 && h > 16 && sku.length > 0;

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip({ x: e.clientX, y: e.clientY });
  }, []);

  const onMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <>
      <div
        className="absolute cursor-pointer flex items-center justify-center overflow-hidden transition-shadow duration-150 hover:shadow-lg hover:z-10 hover:brightness-125"
        style={{
          left: rect.x - offsetX,
          top: rect.y - offsetY,
          width: w,
          height: h,
          backgroundColor: bg,
          border: "1px solid rgba(0,0,0,0.3)",
        }}
        onClick={() => navigate(`/products/${item.id}`)}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {showSku && (
          <span
            className="text-white font-bold drop-shadow-sm truncate px-1 font-mono select-none"
            style={{ fontSize, lineHeight: 1.1 }}
            dir="ltr"
          >
            {sku}
          </span>
        )}
      </div>
      {tooltip && createPortal(
        <TreemapTooltip item={item} x={tooltip.x} y={tooltip.y} />,
        document.body,
      )}
    </>
  );
}
