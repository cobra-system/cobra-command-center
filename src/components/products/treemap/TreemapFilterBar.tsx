import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { TreemapFilters, SizeMetric } from "./useTreemapData";
import { NO_CATEGORY_GROUP } from "./useTreemapData";

interface Props {
  filters: TreemapFilters;
  onChange: (filters: TreemapFilters) => void;
  categories: string[];
  suppliers: string[];
  divisions: string[];
  isManager: boolean;
  search: string;
  onSearchChange: (s: string) => void;
}

const TOP_N_OPTIONS = [
  { value: "all", label: "כל המוצרים" },
  { value: "5", label: "Top 5" },
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
  { value: "50", label: "Top 50" },
];

const SIZE_OPTIONS: { value: SizeMetric; label: string }[] = [
  { value: "consumption", label: "צריכה" },
  { value: "stockValue", label: "שווי מלאי" },
];

export default function TreemapFilterBar({ filters, onChange, categories, suppliers, divisions, isManager, search, onSearchChange }: Props) {
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
        <SelectTrigger className="w-[150px]">
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
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="ספק" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הספקים</SelectItem>
          {suppliers.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isManager && divisions.length > 0 && (
        <Select
          value={filters.division}
          onValueChange={v => onChange({ ...filters, division: v })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="חטיבה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל החטיבות</SelectItem>
            {divisions.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex bg-secondary rounded-lg p-1">
        {SIZE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, sizeBy: opt.value })}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filters.sizeBy === opt.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="relative flex-1 min-w-[140px] max-w-[220px]">
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="חיפוש מק״ט..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pr-8 h-9 text-sm"
        />
      </div>
    </div>
  );
}
