import { useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useData, categories, type Product, type ProductComponent } from "@/contexts/AppContext";
import { Search, Eye, ChevronDown, ChevronUp, Boxes, Plus, Pencil, Trash2, Check, X as XIcon, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import { toast } from "sonner";

export default function ProductsPage() {
  const { products, suppliers, updateComponent, addComponent, deleteComponent, deleteProduct } = useData();
  const navigate = useNavigate();
  const [category, setCategory] = useState("הכל");
  const [typeFilter, setTypeFilter] = useState<"all" | "מוגמר" | "מורכב">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Inline component editing
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compDraft, setCompDraft] = useState<Partial<ProductComponent>>({});
  const [addingCompForProduct, setAddingCompForProduct] = useState<string | null>(null);
  const [newCompDraft, setNewCompDraft] = useState<Partial<ProductComponent>>({});

  const filtered = products.filter(p => {
    if (category !== "הכל" && p.category !== category) return false;
    if (typeFilter !== "all" && p.product_type !== typeFilter) return false;
    if (search && !p.name.includes(search) && !p.sku.includes(search)) return false;
    return true;
  });

  const hasLowStockComponent = (p: Product) => {
    if (p.product_type !== "מורכב" || !p.components) return false;
    return p.components.some(c => c.stock_qty != null && c.stock_qty <= 0);
  };

  const getRowClass = (p: Product) => {
    if (hasLowStockComponent(p)) return "bg-destructive/8 border-r-2 border-r-destructive";
    if (p.stock_qty === 0) return "stock-danger";
    if (p.monthly_order && p.stock_qty < p.monthly_order) return "stock-warning";
    return "";
  };

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const openEdit = (p: Product) => { setEditProduct(p); setFormOpen(true); };
  const openAdd = () => { setEditProduct(null); setFormOpen(true); };

  const navigateToSupplier = (supplierName: string) => {
    const s = suppliers.find(s => s.company === supplierName);
    if (s) navigate(`/suppliers?highlight=${s.id}`);
  };

  // Component inline edit
  const startEditComp = (comp: ProductComponent) => {
    setEditingCompId(comp.id);
    setCompDraft({ ...comp });
  };

  const saveComp = async () => {
    if (!editingCompId || !compDraft.name?.trim()) return;
    await updateComponent(editingCompId, compDraft);
    setEditingCompId(null);
    toast.success("הרכיב עודכן");
  };

  const cancelEditComp = () => { setEditingCompId(null); setCompDraft({}); };

  const startAddComp = (productId: string) => {
    setAddingCompForProduct(productId);
    setNewCompDraft({ name: "", supplier: "", stock_qty: 0, notes: "" });
  };

  const saveNewComp = async (productId: string) => {
    if (!newCompDraft.name?.trim()) return;
    await addComponent({ product_id: productId, name: newCompDraft.name!.trim(), supplier: newCompDraft.supplier || null, stock_qty: newCompDraft.stock_qty ?? null, notes: newCompDraft.notes || null, sku: null, origin: null, price: null });
    setAddingCompForProduct(null);
    toast.success("רכיב נוסף");
  };

  const handleDeleteComp = async (id: string) => {
    await deleteComponent(id);
    toast.success("הרכיב נמחק");
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
              const lowStock = hasLowStockComponent(p);

              return (
                <Fragment key={p.id}>
                  <tr
                    className={`${getRowClass(p)} ${isComposite ? "cursor-pointer hover:bg-muted/30" : "hover:bg-muted/20"} transition-colors`}
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
                        {lowStock && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
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
                    <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{p.notes || "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/products/${p.id}`); }} className="text-primary hover:text-primary/80 p-1">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="text-muted-foreground hover:text-foreground p-1">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-destructive p-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקת מוצר</AlertDialogTitle>
                              <AlertDialogDescription>האם למחוק את "{p.name}"? פעולה זו תמחק גם את כל הרכיבים.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={() => { deleteProduct(p.id); toast.success("המוצר נמחק"); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">מחק</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded components */}
                  {isExpanded && isComposite && (
                    <tr>
                      <td colSpan={11} className="p-0">
                        <div className="bg-muted/30 border-t border-b px-6 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Boxes className="h-4 w-4 text-accent" />
                              <span className="text-xs font-semibold text-foreground">רכיבים ({p.components?.length || 0})</span>
                            </div>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); startAddComp(p.id); }}>
                              <Plus className="h-3 w-3 ml-1" />רכיב
                            </Button>
                          </div>

                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b text-muted-foreground">
                                <th className="text-right py-1.5 px-2 font-medium">שם</th>
                                <th className="text-right py-1.5 px-2 font-medium">ספק</th>
                                <th className="text-right py-1.5 px-2 font-medium">מלאי</th>
                                <th className="text-right py-1.5 px-2 font-medium">הערות</th>
                                <th className="text-right py-1.5 px-2 font-medium w-20">פעולות</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.components?.map(comp => {
                                const isEditing = editingCompId === comp.id;
                                const lowStockComp = comp.stock_qty != null && comp.stock_qty <= 0;
                                return (
                                  <tr key={comp.id} className={`border-b last:border-0 ${lowStockComp ? "bg-destructive/10" : ""}`}>
                                    {isEditing ? (
                                      <>
                                        <td className="py-1 px-2"><Input value={compDraft.name || ""} onChange={e => setCompDraft(prev => ({ ...prev, name: e.target.value }))} className="h-7 text-xs" /></td>
                                        <td className="py-1 px-2"><Input value={compDraft.supplier || ""} onChange={e => setCompDraft(prev => ({ ...prev, supplier: e.target.value }))} className="h-7 text-xs" /></td>
                                        <td className="py-1 px-2"><Input type="number" value={compDraft.stock_qty ?? ""} onChange={e => setCompDraft(prev => ({ ...prev, stock_qty: e.target.value === "" ? null : Number(e.target.value) }))} className="h-7 text-xs w-16" /></td>
                                        <td className="py-1 px-2"><Input value={compDraft.notes || ""} onChange={e => setCompDraft(prev => ({ ...prev, notes: e.target.value }))} className="h-7 text-xs" /></td>
                                        <td className="py-1 px-2">
                                          <div className="flex gap-1">
                                            <button onClick={saveComp} className="text-success p-0.5"><Check className="h-3.5 w-3.5" /></button>
                                            <button onClick={cancelEditComp} className="text-muted-foreground p-0.5"><XIcon className="h-3.5 w-3.5" /></button>
                                          </div>
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td className="py-1.5 px-2 font-medium text-foreground">{comp.name}</td>
                                        <td className="py-1.5 px-2 text-muted-foreground">
                                          {comp.supplier ? (
                                            <button onClick={() => navigateToSupplier(comp.supplier!)} className="text-primary hover:underline">{comp.supplier}</button>
                                          ) : "—"}
                                        </td>
                                        <td className={`py-1.5 px-2 font-medium ${lowStockComp ? "text-destructive" : "text-muted-foreground"}`}>{comp.stock_qty ?? "—"}</td>
                                        <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[200px]">{comp.notes || "—"}</td>
                                        <td className="py-1.5 px-2">
                                          <div className="flex gap-1">
                                            <button onClick={() => startEditComp(comp)} className="text-muted-foreground hover:text-foreground p-0.5"><Pencil className="h-3 w-3" /></button>
                                            <button onClick={() => handleDeleteComp(comp.id)} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="h-3 w-3" /></button>
                                          </div>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              })}

                              {/* Add component row */}
                              {addingCompForProduct === p.id && (
                                <tr className="border-t bg-card/50">
                                  <td className="py-1 px-2"><Input value={newCompDraft.name || ""} onChange={e => setNewCompDraft(prev => ({ ...prev, name: e.target.value }))} placeholder="שם רכיב" className="h-7 text-xs" /></td>
                                  <td className="py-1 px-2"><Input value={newCompDraft.supplier || ""} onChange={e => setNewCompDraft(prev => ({ ...prev, supplier: e.target.value }))} placeholder="ספק" className="h-7 text-xs" /></td>
                                  <td className="py-1 px-2"><Input type="number" value={newCompDraft.stock_qty ?? ""} onChange={e => setNewCompDraft(prev => ({ ...prev, stock_qty: e.target.value === "" ? null : Number(e.target.value) }))} className="h-7 text-xs w-16" /></td>
                                  <td className="py-1 px-2"><Input value={newCompDraft.notes || ""} onChange={e => setNewCompDraft(prev => ({ ...prev, notes: e.target.value }))} placeholder="הערות" className="h-7 text-xs" /></td>
                                  <td className="py-1 px-2">
                                    <div className="flex gap-1">
                                      <button onClick={() => saveNewComp(p.id)} className="text-success p-0.5"><Check className="h-3.5 w-3.5" /></button>
                                      <button onClick={() => setAddingCompForProduct(null)} className="text-muted-foreground p-0.5"><XIcon className="h-3.5 w-3.5" /></button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>

                          {(!p.components || p.components.length === 0) && addingCompForProduct !== p.id && (
                            <p className="text-xs text-muted-foreground text-center py-2">לא הוגדרו רכיבים</p>
                          )}
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
