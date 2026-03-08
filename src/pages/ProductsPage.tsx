import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/AppContext";
import { categories } from "@/data/mockData";
import { Search, Edit2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ProductsPage() {
  const { products } = useData();
  const navigate = useNavigate();
  const [category, setCategory] = useState("הכל");
  const [typeFilter, setTypeFilter] = useState<"all" | "מוגמר" | "מורכב">("all");
  const [search, setSearch] = useState("");

  const filtered = products.filter(p => {
    if (category !== "הכל" && p.category !== category) return false;
    if (typeFilter !== "all" && p.productType !== typeFilter) return false;
    if (search && !p.name.includes(search) && !p.sku.includes(search)) return false;
    return true;
  });

  const getRowClass = (stockQty: number, monthlyOrder?: number) => {
    if (stockQty === 0) return "stock-danger";
    if (monthlyOrder && stockQty < monthlyOrder) return "stock-warning";
    return "";
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">מוצרים</h1>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              category === cat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-secondary rounded-lg p-1">
          {(["all", "מוגמר", "מורכב"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "all" ? "הכל" : t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם או מק״ט..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">שם מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">מק״ט</th>
              <th className="text-right p-3 font-semibold text-foreground">סוג</th>
              <th className="text-right p-3 font-semibold text-foreground">ספק</th>
              <th className="text-right p-3 font-semibold text-foreground">מלאי</th>
              <th className="text-right p-3 font-semibold text-foreground">בדרך</th>
              <th className="text-right p-3 font-semibold text-foreground">מחיר רכישה</th>
              <th className="text-right p-3 font-semibold text-foreground">הזמנה חודשית</th>
              <th className="text-right p-3 font-semibold text-foreground">הערות</th>
              <th className="text-right p-3 font-semibold text-foreground">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">לא נמצאו מוצרים</td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className={getRowClass(p.stockQty, p.monthlyOrder)}>
                  <td className="p-3 font-medium text-foreground">{p.name}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{p.sku}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.productType === "מורכב" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                    }`}>
                      {p.productType}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.supplier || "—"}</td>
                  <td className="p-3 font-semibold text-foreground">{p.stockQty}</td>
                  <td className="p-3 text-muted-foreground">{p.incomingQty || "—"}</td>
                  <td className="p-3 text-muted-foreground">{p.purchasePrice ? `$${p.purchasePrice}` : "—"}</td>
                  <td className="p-3 text-muted-foreground">{p.monthlyOrder || "—"}</td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{p.notes || "—"}</td>
                  <td className="p-3">
                    <button className="text-accent hover:text-accent/80">
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
