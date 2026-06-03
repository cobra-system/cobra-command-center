import type { CategoryRect } from "./treemapLayout";
import TreemapCell from "./TreemapCell";

interface Props {
  category: CategoryRect;
}

const HEADER_HEIGHT = 24;

export default function TreemapCategoryGroup({ category: cat }: Props) {
  return (
    <div
      className="absolute border border-border/40"
      style={{
        left: cat.x,
        top: cat.y,
        width: cat.width,
        height: cat.height,
      }}
    >
      <div
        className="flex items-center px-2 bg-black/60 border-b border-border/30 text-[11px] font-bold text-white uppercase tracking-wide truncate"
        style={{ height: HEADER_HEIGHT }}
      >
        {cat.category}
      </div>
      {cat.children.map(rect => (
        <TreemapCell
          key={rect.item.id}
          rect={rect}
          offsetX={cat.x}
          offsetY={cat.y}
        />
      ))}
    </div>
  );
}
