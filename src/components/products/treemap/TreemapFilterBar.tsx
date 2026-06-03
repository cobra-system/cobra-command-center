import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TreemapFilters } from "./useTreemapData";
import { NO_CATEGORY_GROUP } from "./useTreemapData";

interface Props {
  filters: TreemapFilters;
  onChange: (filters: TreemapFilters) => void;
  categories: string[];
  suppliers: string[];
}

const TOP_N_OPTIONS = [
  { value: "all", label: "כל המוצרים" },
  { value: "5", label: "Top 5" },
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
  { value: "50", label: "Top 50" },
];

export default function TreemapFilterBar({ filters, onChange, categories, suppliers }: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="flex bg-secondary rounded-lg p-1">
        {TOP_N_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, topN: opt.value === "all" ? null : Number(opt.value) })}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              (filters.topN === null && opt.value === "all") || String(filters.topN) === opt.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Select
        value={filters.category}
        onValueChange={v => onChange({ ...filters, category: v })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="קטגוריה" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="הכל">כל הקטגוריות</SelectItem>
          <SelectItem value={NO_CATEGORY_GROUP}>ללא קטגוריות</SelectItem>
          {categories.map(c => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.supplier}
        onValueChange={v => onChange({ ...filters, supplier: v })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="ספק" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הספקים</SelectItem>
          {suppliers.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
