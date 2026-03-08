import { useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useData, categories } from "@/contexts/AppContext";
import { Search, Eye, ChevronDown, ChevronUp, Boxes } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ProductsPage() {
  const { products } = useData();
  const navigate = useNavigate();
  const [category, setCategory] = useState("הכל");
  const [typeFilter, setTypeFilter] = useState<"all" | "מוגמר" | "מורכב">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = products.filter(p => {
    if (category !== "הכל" && p.category !== category) return false;
    if (typeFilter !== "all" && p.product_type !== typeFilter) return false;
    if (search && !p.name.includes(search) && !p.sku.includes(search)) return false;
    return true;
  });

  const getRowClass = (stockQty: number, monthlyOrder?: number | null) => {
    if (stockQty === 0) return "stock-danger";
    if (monthlyOrder && stockQty < monthlyOrder) return "stock-warning";
    return "";
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">מוצרים</h1>

      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            category === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}>{cat}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-secondary rounded-lg p-1">
          {(["all", "מוגמר", "מורכב"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              typeFilter === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>{t === "all" ? "הכל" : t}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש לפי שם או מק״ט..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground w-8"></th>
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
              <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">לא נמצאו מוצרים</td></tr>
            ) : filtered.map(p => {
              const isComposite = p.product_type === "מורכב";
              const isExpanded = expandedId === p.id;
              const hasComponents = isComposite && p.components && p.components.length > 0;

              return (
                <Fragment key={p.id}>
                  <tr
                    className={`${getRowClass(p.stock_qty, p.monthly_order)} ${isComposite ? "cursor-pointer hover:bg-muted/30" : "hover:bg-muted/20"} transition-colors`}
                    onClick={() => isComposite && toggleExpand(p.id)}
                  >
                    <td className="p-3 text-center">
                      {isComposite && (
                        <span className="text-muted-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        {isComposite && <Boxes className="h-3.5 w-3.5 text-accent shrink-0" />}
                        {p.name}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{p.sku}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isComposite ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                      }`}>{p.product_type}</span>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.supplier || "—"}</td>
                    <td className="p-3 font-semibold text-foreground">{p.stock_qty}</td>
                    <td className="p-3 text-muted-foreground">{p.incoming_qty || "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.purchase_price ? `$${p.purchase_price}` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.monthly_order || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{p.notes || "—"}</td>
                    <td className="p-3">
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/products/${p.id}`); }} className="text-primary hover:text-primary/80">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {/* Expanded components row */}
                  {isExpanded && hasComponents && (
                    <tr>
                      <td colSpan={11} className="p-0">
                        <div className="bg-muted/30 border-t border-b px-6 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Boxes className="h-4 w-4 text-accent" />
                            <span className="text-xs font-semibold text-foreground">רכיבים ({p.components!.length})</span>
                          </div>
                          <div className="grid gap-1.5">
                            {p.components!.map(comp => (
                              <div key={comp.id} className="flex items-center gap-4 bg-card/70 rounded-lg px-3 py-2 text-xs">
                                <span className="font-medium text-foreground min-w-[180px]">{comp.name}</span>
                                <span className="text-muted-foreground">
                                  <span className="text-muted-foreground/60">ספק: </span>
                                  {comp.supplier || "—"}
                                </span>
                                {comp.stock_qty != null && (
                                  <span className="text-muted-foreground">
                                    <span className="text-muted-foreground/60">מלאי: </span>
                                    {comp.stock_qty}
                                  </span>
                                )}
                                {comp.notes && (
                                  <span className="text-muted-foreground/70 truncate max-w-[250px]">
                                    💡 {comp.notes}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isExpanded && isComposite && !hasComponents && (
                    <tr>
                      <td colSpan={11} className="p-0">
                        <div className="bg-muted/30 border-t border-b px-6 py-4 text-center text-xs text-muted-foreground">
                          לא הוגדרו רכיבים למוצר זה
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
