import type { CategoryRect } from "./treemapLayout";
import { NO_CATEGORY_GROUP } from "./useTreemapData";
import TreemapCell from "./TreemapCell";

interface Props {
  category: CategoryRect;
}

const HEADER_HEIGHT = 24;

export default function TreemapCategoryGroup({ category: cat }: Props) {
  const isFlat = cat.category === NO_CATEGORY_GROUP;
  const headerH = isFlat ? 0 : HEADER_HEIGHT;

  return (
    <div
      className="absolute"
      style={{
        left: cat.x,
        top: cat.y,
        width: cat.width,
        height: cat.height,
        border: isFlat ? undefined : "1px solid var(--border, rgba(255,255,255,0.1))",
      }}
    >
      {!isFlat && (
        <div
          className="flex items-center px-2 bg-black/60 border-b border-border/30 text-[11px] font-bold text-white uppercase tracking-wide truncate"
          style={{ height: headerH }}
        >
          {cat.category}
        </div>
      )}
      {cat.children.map(rect => (
        <TreemapCell
          key={rect.item.id}
          rect={{
            ...rect,
            y: isFlat ? rect.y : rect.y,
          }}
          offsetX={cat.x}
          offsetY={cat.y}
        />
      ))}
    </div>
  );
}
