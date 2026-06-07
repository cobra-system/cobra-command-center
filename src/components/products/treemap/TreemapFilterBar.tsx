import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { TreemapFilters, SizeMetric, HealthFilter } from "./useTreemapData";
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
  { value: "all", label: "הכל" },
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
];

const SIZE_OPTIONS: { value: SizeMetric; label: string }[] = [
  { value: "consumption", label: "צריכה" },
  { value: "stockValue", label: "שווי" },
];

const HEALTH_OPTIONS: { value: HealthFilter; label: string; color?: string }[] = [
  { value: "all", label: "הכל" },
  { value: "outOfStock", label: "אזל", color: "#7f1d1d" },
  { value: "critical", label: "קריטי", color: "#9b2d2d" },
  { value: "low", label: "נמוך", color: "#b45454" },
  { value: "ok", label: "סביר", color: "#6b7280" },
  { value: "healthy", label: "תקין", color: "#3f7d4f" },
];

export default function TreemapFilterBar({ filters, onChange, categories, suppliers, divisions, isManager, search, onSearchChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {/* Top-N toggle */}
      <div className="flex bg-secondary rounded-lg p-0.5 sm:p-1">
        {TOP_N_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, topN: opt.value === "all" ? null : Number(opt.value) })}
            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              (filters.topN === null && opt.value === "all") || String(filters.topN) === opt.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Select value={filters.category} onValueChange={v => onChange({ ...filters, category: v })}>
        <SelectTrigger className="w-[120px] sm:w-[150px] h-8 sm:h-9 text-xs sm:text-sm">
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

      <Select value={filters.supplier} onValueChange={v => onChange({ ...filters, supplier: v })}>
        <SelectTrigger className="w-[110px] sm:w-[150px] h-8 sm:h-9 text-xs sm:text-sm">
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
        <Select value={filters.division} onValueChange={v => onChange({ ...filters, division: v })}>
          <SelectTrigger className="w-[110px] sm:w-[150px] h-8 sm:h-9 text-xs sm:text-sm">
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

      <Select value={filters.health ?? "all"} onValueChange={v => onChange({ ...filters, health: v as HealthFilter })}>
        <SelectTrigger className="w-[100px] sm:w-[130px] h-8 sm:h-9 text-xs sm:text-sm">
          <SelectValue placeholder="מצב מלאי" />
        </SelectTrigger>
        <SelectContent>
          {HEALTH_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className="flex items-center gap-2">
                {opt.color && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />}
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Size-by toggle */}
      <div className="flex bg-secondary rounded-lg p-0.5 sm:p-1">
        {SIZE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, sizeBy: opt.value })}
            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              filters.sizeBy === opt.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-[100px] max-w-[200px] sm:min-w-[140px] sm:max-w-[220px]">
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="חיפוש מק״ט..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pr-8 h-8 sm:h-9 text-xs sm:text-sm"
        />
      </div>
    </div>
  );
}
