import { useState, useRef, useEffect, useMemo } from "react";
import { Boxes } from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { layoutTreemap } from "./treemapLayout";
import { useTreemapData, DEFAULT_FILTERS, NO_CATEGORY_GROUP, type TreemapFilters } from "./useTreemapData";
import TreemapFilterBar from "./TreemapFilterBar";
import TreemapContainer from "./TreemapContainer";
import TreemapCategoryGroup from "./TreemapCategoryGroup";
import TreemapLegend from "./TreemapLegend";

const HEADER_HEIGHT = 24;

export default function ProductTreemapView() {
  const [filters, setFilters] = usePersistedState<TreemapFilters>("treemap-filters", DEFAULT_FILTERS);
  const { items, categories, suppliers } = useTreemapData(filters);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const height = Math.max(400, window.innerHeight - 310);
        setDimensions({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isFlat = filters.category === NO_CATEGORY_GROUP;
  const effectiveHeaderHeight = isFlat ? 0 : HEADER_HEIGHT;

  const layout = useMemo(
    () => layoutTreemap(items, dimensions.width, dimensions.height, effectiveHeaderHeight),
    [items, dimensions.width, dimensions.height, effectiveHeaderHeight],
  );

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <TreemapFilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories}
          suppliers={suppliers}
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

  return (
    <div className="space-y-3">
      <TreemapFilterBar
        filters={filters}
        onChange={setFilters}
        categories={categories}
        suppliers={suppliers}
      />
      <div ref={containerRef} className="w-full">
        {dimensions.width > 0 && (
          <TreemapContainer
            contentWidth={dimensions.width}
            contentHeight={dimensions.height}
          >
            {layout.map(cat => (
              <TreemapCategoryGroup key={cat.category} category={cat} />
            ))}
          </TreemapContainer>
        )}
      </div>
      <TreemapLegend />
    </div>
  );
}
