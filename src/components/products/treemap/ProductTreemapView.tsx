import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Boxes, Maximize, Minimize } from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { layoutTreemap, type TreemapItem } from "./treemapLayout";
import { useTreemapData, DEFAULT_FILTERS, NO_CATEGORY_GROUP, type TreemapFilters } from "./useTreemapData";
import TreemapFilterBar from "./TreemapFilterBar";
import TreemapContainer from "./TreemapContainer";
import TreemapCategoryGroup from "./TreemapCategoryGroup";
import TreemapInfoPanel from "./TreemapInfoPanel";
import TreemapStatsBar from "./TreemapStatsBar";
import TreemapLegend from "./TreemapLegend";

const HEADER_HEIGHT = 24;

export default function ProductTreemapView() {
  const [filters, setFilters] = usePersistedState<TreemapFilters>("treemap-filters", DEFAULT_FILTERS);
  const safeFilters = useMemo(() => ({ ...DEFAULT_FILTERS, ...filters }), [filters]);
  const { items, categories, suppliers, divisions, isManager } = useTreemapData(safeFilters);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<TreemapItem | null>(null);
  const [search, setSearch] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const height = isFullscreen
          ? window.innerHeight - 120
          : Math.max(400, window.innerHeight - 310);
        setDimensions({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullscreen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedItem) { setSelectedItem(null); e.preventDefault(); }
        else if (isFullscreen) { setIsFullscreen(false); e.preventDefault(); }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItem, isFullscreen]);

  const isFlat = safeFilters.category === NO_CATEGORY_GROUP;
  const effectiveHeaderHeight = isFlat ? 0 : HEADER_HEIGHT;

  const layout = useMemo(
    () => layoutTreemap(items, dimensions.width, dimensions.height, effectiveHeaderHeight),
    [items, dimensions.width, dimensions.height, effectiveHeaderHeight],
  );

  const searchMatches = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    const matches = new Set<string>();
    for (const item of items) {
      if (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.supplier?.toLowerCase().includes(q))
      ) {
        matches.add(item.id);
      }
    }
    return matches;
  }, [items, search]);

  const handleSelect = useCallback((item: TreemapItem) => {
    setSelectedItem(prev => prev?.id === item.id ? null : item);
  }, []);

  const handleHoverCategory = useCallback((cat: string | null) => {
    setHoveredCategory(cat);
  }, []);

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <TreemapFilterBar
          filters={safeFilters}
          onChange={setFilters}
          categories={categories}
          suppliers={suppliers}
          divisions={divisions}
          isManager={isManager}
          search={search}
          onSearchChange={setSearch}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Boxes className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">לא נמצאו מוצרים</p>
          <p className="text-xs text-muted-foreground">נסה לשנות את הסינון</p>
        </div>
      </div>
    );
  }

  const content = (
    <div className={`space-y-3 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-4 overflow-auto" : ""}`} ref={wrapperRef}>
      <div className="flex items-center justify-between gap-2">
        <TreemapFilterBar
          filters={safeFilters}
          onChange={setFilters}
          categories={categories}
          suppliers={suppliers}
          divisions={divisions}
          isManager={isManager}
          search={search}
          onSearchChange={setSearch}
        />
        <button
          onClick={() => setIsFullscreen(f => !f)}
          className="p-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors shrink-0"
          title={isFullscreen ? "יציאה ממסך מלא (Esc)" : "מסך מלא"}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>

      <TreemapStatsBar items={items} />

      <div ref={containerRef} className="w-full">
        {dimensions.width > 0 && (
          <TreemapContainer
            contentWidth={dimensions.width}
            contentHeight={dimensions.height}
          >
            {layout.map(cat => (
              <TreemapCategoryGroup
                key={cat.category}
                category={cat}
                isHighlighted={hoveredCategory === cat.category && !isFlat}
                onSelect={handleSelect}
                onHoverCategory={handleHoverCategory}
                searchMatches={searchMatches}
              />
            ))}
          </TreemapContainer>
        )}
      </div>

      {selectedItem && (
        <TreemapInfoPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <TreemapLegend />
    </div>
  );

  return content;
}
