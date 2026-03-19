import { useState, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth, categories, type Product } from "@/contexts/AppContext";
import { Search, ChevronDown, ChevronUp, Boxes, Plus, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { toast } from "sonner";

type SortKey = "name" | "sku" | "product_type" | "supplier" | "stock_qty" | "incoming_qty" | "purchase_price" | "monthly_order";

const sortableColumns: { key: SortKey; label: string }[] = [
  { key: "name", label: "שם מוצר" },
  { key: "sku", label: "מק״ט" },
  { key: "product_type", label: "סוג" },
  { key: "supplier", label: "ספק" },
  { key: "stock_qty", label: "מלאי" },
  { key: "incoming_qty", label: "בדרך" },
  { key: "purchase_price", label: "מחיר רכישה" },
  { key: "monthly_order", label: "הזמנה חודשית" },
];

export default function ProductsPage() {
  const { products, suppliers, deleteProduct } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState("הכל");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const prefs = useTablePreferences("ProductsPage", {
    sortField: "name",
    filters: { category: "הכל", typeFilter: "all", supplierFilter: "all" },
  });

  const isManager = currentUser?.role === "MANAGER";
  const sortKey = prefs.sortField as SortKey | null;
  const sortDir = prefs.sortDir;
  const typeFilter = (prefs.filters.typeFilter || "all") as "all" | "מוגמר" | "מורכב";
  const supplierFilter = prefs.filters.supplierFilter || "all";

  const filtered = useMemo(() => {
    let result = products.filter(p => {
      if (category !== "הכל" && p.category !== category) return false;
      if (typeFilter !== "all" && p.product_type !== typeFilter) return false;
      if (supplierFilter !== "all" && p.supplier !== supplierFilter) return false;
      if (search && !p.name.includes(search) && !p.sku.includes(search)) return false;
      return true;
    });

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = (a as any)[sortKey];
        const bv = (b as any)[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), "he");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [products, category, typeFilter, supplierFilter, search, sortKey, sortDir]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set(products.map(p => p.supplier).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [products]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const handleDelete = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteProduct(productId);
    toast.success("המוצר נמחק");
  };

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);
  const openAdd = () => { setEditProduct(null); setFormOpen(true); };

  const getSupplierPath = (supplierName: string) => {
    const s = suppliers.find(s => s.company === supplierName);
    return s ? `/suppliers/${s.id}` : null;
  };

  const navigateToSupplier = (supplierName: string) => {
    const path = getSupplierPath(supplierName);
    if (path) navigate(path);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">מוצרים</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 ml-2" />מוצר חדש</Button>
      </div>

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
            <button key={t} onClick={() => prefs.setFilter("typeFilter", t)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              typeFilter === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>{t === "all" ? "הכל" : t}</button>
          ))}
        </div>
        <Select value={supplierFilter} onValueChange={(v) => prefs.setFilter("supplierFilter", v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="ספק" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הספקים</SelectItem>
            {uniqueSuppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
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
              {sortableColumns.map(col => (
                <th key={col.key} className="text-right p-3 font-semibold text-foreground">
                  <button onClick={() => prefs.toggleSort(col.key)} className="flex items-center gap-1 hover:text-accent transition-colors">
                    {col.label}
                    <SortIcon col={col.key} />
                  </button>
                </th>
              ))}
              {isManager && <th className="text-right p-3 font-semibold text-foreground w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={isManager ? 10 : 9} className="p-8 text-center text-muted-foreground">לא נמצאו מוצרים</td></tr>
            ) : filtered.map(p => {
              const isComposite = p.product_type === "מורכב";
              const isExpanded = expandedId === p.id;
              const hasComponents = isComposite && p.components && p.components.length > 0;

              return (
                <Fragment key={p.id}>
                  <tr
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={(e) => { if (e.detail !== 1) return; isComposite ? toggleExpand(p.id) : navigate(`/products/${p.id}`); }}
                    onDoubleClick={() => isComposite && navigate(`/products/${p.id}`)}
                  >
                    <td className="p-3 text-center">
                      {isComposite && (
                        <span className="text-muted-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {p.end_product_image ? (
                          <img src={p.end_product_image} alt={p.name} className="h-8 w-8 rounded object-cover shrink-0" />
                        ) : isComposite ? (
                          <Boxes className="h-3.5 w-3.5 text-accent shrink-0" />
                        ) : null}
                        {p.name}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{p.sku}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isComposite ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                      }`}>{p.product_type}</span>
                    </td>
                    <td className="p-3">
                      {p.supplier ? (
                        <button
                          data-navigate-to={getSupplierPath(p.supplier) || undefined}
                          onClick={(e) => { e.stopPropagation(); navigateToSupplier(p.supplier!); }}
                          className="text-primary hover:underline text-sm"
                        >
                          {p.supplier}
                        </button>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={`p-3 font-semibold ${p.stock_qty === 0 ? "text-destructive" : "text-foreground"}`}>{p.stock_qty}</td>
                    <td className="p-3 text-muted-foreground">{p.incoming_qty || "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.purchase_price ? `$${p.purchase_price}` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.monthly_order || "—"}</td>
                    {isManager && (
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקת מוצר</AlertDialogTitle>
                              <AlertDialogDescription>האם למחוק את "{p.name}"? פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={(e) => handleDelete(p.id, e)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    )}
                  </tr>

                  {/* Expanded components */}
                  {isExpanded && hasComponents && (
                    <tr>
                      <td colSpan={isManager ? 10 : 9} className="p-0">
                        <div className="bg-muted/30 border-t border-b px-6 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Boxes className="h-4 w-4 text-accent" />
                              <span className="text-xs font-semibold text-foreground">רכיבים ({p.components!.length})</span>
                            </div>
                            <Button variant="outline" size="sm" className="h-7 text-xs" data-navigate-to={`/products/${p.id}`} onClick={(e) => { e.stopPropagation(); navigate(`/products/${p.id}`); }}>
                              פתח תיק מוצר
                            </Button>
                          </div>
                          <div className="grid gap-1.5">
                            {p.components!.map(comp => (
                              <div key={comp.id} className="flex items-center gap-4 bg-card/70 rounded-lg px-3 py-2 text-xs">
                                <span className="font-medium text-foreground min-w-[180px]">{comp.name}</span>
                                <span className="text-muted-foreground">
                                  <span className="text-muted-foreground/60">ספק: </span>
                                  {comp.supplier ? (
                                    <button data-navigate-to={getSupplierPath(comp.supplier) || undefined} onClick={() => navigateToSupplier(comp.supplier!)} className="text-primary hover:underline">{comp.supplier}</button>
                                  ) : "—"}
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
                      <td colSpan={isManager ? 10 : 9} className="p-0">
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

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} editProduct={editProduct} />
    </div>
  );
}
