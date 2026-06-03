import { useMemo } from "react";
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

  const headerStats = useMemo(() => {
    if (isFlat) return null;
    const items = cat.children.map(c => c.item);
    const count = items.length;
    const critical = items.filter(i => i.consumption > 0 && i.stockQty / i.consumption < 1).length;
    const healthy = items.filter(i => i.consumption > 0 && i.stockQty / i.consumption >= 3).length;
    const issues = items.reduce((s, i) => s + (i.openIssues ?? 0), 0);
    return { count, critical, healthy, issues };
  }, [cat.children, isFlat]);

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
      {!isFlat && headerStats && (
        <div
          className="flex items-center justify-between px-2 bg-black/60 border-b border-border/30 text-[11px] font-bold text-white tracking-wide"
          style={{ height: HEADER_HEIGHT }}
        >
          <span className="flex items-center gap-1.5 truncate min-w-0">
            <span className="uppercase truncate">{cat.category}</span>
            <span className="shrink-0 text-[9px] font-normal text-white/60 bg-white/10 rounded px-1">{headerStats.count}</span>
          </span>
          {cat.width > 120 && (
            <span className="flex items-center gap-1.5 shrink-0 text-[9px] font-normal">
              {headerStats.critical > 0 && (
                <span className="text-red-400">{headerStats.critical} קריטי</span>
              )}
              {headerStats.healthy > 0 && (
                <span className="text-green-400">{headerStats.healthy} תקין</span>
              )}
              {headerStats.issues > 0 && (
                <span className="text-amber-400">⚠{headerStats.issues}</span>
              )}
            </span>
          )}
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
