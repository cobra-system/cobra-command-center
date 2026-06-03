import type { CategoryRect, TreemapItem } from "./treemapLayout";
import { NO_CATEGORY_GROUP } from "./useTreemapData";
import TreemapCell from "./TreemapCell";

interface Props {
  category: CategoryRect;
  isHighlighted: boolean;
  onSelect: (item: TreemapItem) => void;
  onHoverCategory: (category: string | null) => void;
  searchMatches: Set<string> | null;
}

const HEADER_HEIGHT = 24;

export default function TreemapCategoryGroup({ category: cat, isHighlighted, onSelect, onHoverCategory, searchMatches }: Props) {
  const isFlat = cat.category === NO_CATEGORY_GROUP;

  return (
    <div
      className="absolute transition-[box-shadow] duration-150"
      style={{
        left: cat.x,
        top: cat.y,
        width: cat.width,
        height: cat.height,
        border: isFlat
          ? undefined
          : isHighlighted
            ? "2px solid #3b82f6"
            : "1px solid var(--border, rgba(255,255,255,0.1))",
        boxShadow: isHighlighted ? "0 0 0 1px #3b82f6, inset 0 0 0 1px rgba(59,130,246,0.3)" : undefined,
        zIndex: isHighlighted ? 10 : undefined,
      }}
    >
      {!isFlat && (
        <div
          className="flex items-center px-2 bg-black/60 border-b border-border/30 text-[11px] font-bold text-white uppercase tracking-wide truncate"
          style={{ height: HEADER_HEIGHT }}
        >
          {cat.category}
        </div>
      )}
      {cat.children.map(rect => (
        <TreemapCell
          key={rect.item.id}
          rect={rect}
          offsetX={cat.x}
          offsetY={cat.y}
          onSelect={onSelect}
          onHoverCategory={onHoverCategory}
          isSearchMatch={searchMatches === null ? null : searchMatches.has(rect.item.id) ? true : false}
        />
      ))}
    </div>
  );
}
