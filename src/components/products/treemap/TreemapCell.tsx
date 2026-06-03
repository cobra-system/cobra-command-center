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

  const showSku = w > 30 && h > 20;
  const showName = w > 70 && h > 44;
  const showPercent = w > 50 && h > 32;

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip({ x: e.clientX, y: e.clientY });
  }, []);

  const onMouseLeave = useCallback(() => setTooltip(null), []);

  const percentText = item.consumption > 0
    ? `${item.stockQty > 0 ? ((item.stockQty / item.consumption)).toFixed(1) : "0"}m`
    : "";

  return (
    <>
      <div
        className="absolute cursor-pointer border border-white/15 flex flex-col items-center justify-center text-center overflow-hidden transition-shadow duration-150 hover:shadow-lg hover:z-10 hover:border-white/40"
        style={{
          left: rect.x - offsetX,
          top: rect.y - offsetY,
          width: w,
          height: h,
          backgroundColor: bg,
        }}
        onClick={() => navigate(`/products/${item.id}`)}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {showSku && (
          <span className="text-white text-[11px] font-bold drop-shadow-sm truncate px-1 leading-tight font-mono" dir="ltr">
            {item.sku}
          </span>
        )}
        {showPercent && (
          <span className="text-white/90 text-[11px] font-semibold drop-shadow-sm leading-tight">
            {percentText}
          </span>
        )}
        {showName && (
          <span className="text-white/75 text-[9px] truncate px-1 max-w-full leading-tight mt-0.5">
            {item.name}
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
