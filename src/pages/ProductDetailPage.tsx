import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useData, useAuth, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Package, Boxes, TruckIcon, BookOpen, Plus, Pencil, AlertTriangle, Scale } from "lucide-react";
import ProductIssuesTab from "@/components/ProductIssuesTab";
import SupplierComparisonPanel from "@/components/SupplierComparisonPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  status: string;
}

const statusBadgeClass: Record<string, string> = {
  "למידה": "bg-primary/15 text-primary",
  "שאלה פתוחה": "bg-warning/15 text-warning",
  "הובן": "bg-success/15 text-success",
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { products, orders, updateProduct } = useData();

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalOpen, setJournalOpen] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [jTitle, setJTitle] = useState("");
  const [jContent, setJContent] = useState("");
  const [jStatus, setJStatus] = useState("למידה");

  // Edit product dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, any>>({});

  const product = products.find(p => p.id === id);

  const fetchJournal = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("learning_journal")
      .select("id, date, title, content, status")
      .eq("linked_type", "product")
      .eq("linked_id", id)
      .order("date", { ascending: false });
    if (data) setJournalEntries(data as JournalEntry[]);
  }, [id]);

  useEffect(() => { fetchJournal(); }, [fetchJournal]);

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">מוצר לא נמצא</p>
        <Button variant="outline" onClick={() => navigate("/products")}><ArrowRight className="h-4 w-4 ml-2" />חזרה למוצרים</Button>
      </div>
    );
  }

  const relatedOrders = orders.filter(o => o.items.some(item => item.name === product.name || item.product_id === product.id));

  const stockStatus = product.stock_qty === 0
    ? { label: "אזל מהמלאי", className: "bg-destructive/15 text-destructive" }
    : product.monthly_order && product.stock_qty < product.monthly_order
    ? { label: "מלאי נמוך", className: "bg-warning/15 text-warning" }
    : { label: "תקין", className: "bg-success/15 text-success" };

  const details: { label: string; value: string | number | undefined | null }[] = [
    { label: "קטגוריה", value: product.category },
    { label: "חטיבה", value: product.division },
    { label: "מק״ט", value: product.sku },
    { label: "סוג מוצר", value: product.product_type },
    { label: "תיאור", value: product.description },
    { label: "ספק", value: product.supplier },
    { label: "מקור ספק", value: product.supplier_origin },
    { label: "שיטת משלוח", value: product.shipping },
    { label: "מחיר רכישה", value: product.purchase_price ? `$${product.purchase_price}` : undefined },
    { label: "מחיר מכירה", value: product.sale_price ? `$${product.sale_price}` : undefined },
    { label: "מכירות חודשיות", value: product.monthly_sales },
    { label: "הזמנה חודשית", value: product.monthly_order },
    { label: "מלאי קיים", value: product.stock_qty },
    { label: "בדרך", value: product.incoming_qty },
    { label: "הערות", value: product.notes },
  ];

  const handleAddJournal = async () => {
    if (!jTitle.trim() || !currentUser) return;
    await supabase.from("learning_journal").insert({
      title: jTitle.trim(),
      content: jContent.trim(),
      status: jStatus,
      linked_type: "product",
      linked_id: id,
      created_by: currentUser.id,
    });
    toast.success("הערת למידה נוספה");
    setJTitle(""); setJContent(""); setJStatus("למידה");
    setJournalOpen(false);
    fetchJournal();
  };

  const openEditDialog = () => {
    setEditFields({
      stock_qty: product.stock_qty,
      incoming_qty: product.incoming_qty,
      purchase_price: product.purchase_price || "",
      sale_price: product.sale_price || "",
      monthly_order: product.monthly_order || "",
      notes: product.notes || "",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const updates: Record<string, any> = {};
    for (const key of Object.keys(editFields)) {
      const val = editFields[key];
      updates[key] = val === "" ? null : (typeof val === "string" && !isNaN(Number(val)) && key !== "notes" ? Number(val) : val);
    }
    await updateProduct(product.id, updates);
    toast.success("המוצר עודכן");
    setEditOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")}><ArrowRight className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
          <p className="text-sm text-muted-foreground font-mono" dir="ltr">{product.sku}</p>
        </div>
        <Button variant="outline" size="sm" onClick={openEditDialog}><Pencil className="h-4 w-4 ml-1" />עריכה</Button>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${stockStatus.className}`}>{stockStatus.label}</span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          product.product_type === "מורכב" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
        }`}>{product.product_type}</span>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>עריכת מוצר</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {[
              { key: "stock_qty", label: "מלאי קיים", type: "number" },
              { key: "incoming_qty", label: "בדרך", type: "number" },
              { key: "purchase_price", label: "מחיר רכישה ($)", type: "number" },
              { key: "sale_price", label: "מחיר מכירה ($)", type: "number" },
              { key: "monthly_order", label: "הזמנה חודשית", type: "number" },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                <Input type={f.type} value={editFields[f.key] ?? ""} onChange={e => setEditFields(prev => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1">
              <Label>הערות</Label>
              <Textarea value={editFields.notes ?? ""} onChange={e => setEditFields(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
            <Button onClick={handleSaveEdit} className="w-full">שמור שינויים</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><Package className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">פרטי מוצר</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {details.filter(d => d.value != null && d.value !== "").map(d => (
            <div key={d.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{d.label}</p>
              <p className="text-sm font-medium text-foreground">{d.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "מלאי קיים", value: product.stock_qty, danger: product.stock_qty === 0 },
          { label: "בדרך", value: product.incoming_qty },
          { label: "מכירות חודשיות", value: product.monthly_sales ?? "—" },
          { label: "הזמנה חודשית", value: product.monthly_order ?? "—" },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.danger ? "text-destructive" : "text-foreground"}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* BOM - Components */}
      {product.product_type === "מורכב" && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4"><Boxes className="h-5 w-5 text-accent" /><h2 className="text-lg font-semibold text-foreground">רכיבים (BOM)</h2></div>
          {product.components && product.components.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-semibold text-foreground">רכיב</th>
                    <th className="text-right p-3 font-semibold text-foreground">מק״ט</th>
                    <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                    <th className="text-right p-3 font-semibold text-foreground">מקור</th>
                    <th className="text-right p-3 font-semibold text-foreground">מלאי</th>
                    <th className="text-right p-3 font-semibold text-foreground">מחיר</th>
                    <th className="text-right p-3 font-semibold text-foreground">הערות</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {product.components.map(comp => (
                    <tr key={comp.id}>
                      <td className="p-3 font-medium text-foreground">{comp.name}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{comp.sku || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.supplier || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.origin || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.stock_qty ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.price ? `$${comp.price}` : "—"}</td>
                      <td className="p-3 text-muted-foreground text-xs">{comp.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">לא הוגדרו רכיבים למוצר זה</p>
          )}
          {/* Supplier Comparison per component */}
          {product.components && product.components.length > 0 && (
            <div className="mt-4 space-y-3">
              {product.components.map(comp => (
                <SupplierComparisonPanel key={comp.id} componentName={comp.name} productId={product.id} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders History */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><TruckIcon className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">היסטוריית הזמנות</h2></div>
        {relatedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold text-foreground">עדיפות</th>
                  <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                  <th className="text-right p-3 font-semibold text-foreground">כמות</th>
                  <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                  <th className="text-right p-3 font-semibold text-foreground">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {relatedOrders.map(order => {
                  const relevantItem = order.items.find(i => i.name === product.name || i.product_id === product.id);
                  return (
                    <tr key={order.id}>
                      <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                      <td className="p-3 text-muted-foreground">{order.supplier_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{relevantItem?.qty || "—"}</td>
                      <td className="p-3"><OrderStatusBadge status={order.status as OrderStatus} /></td>
                      <td className="p-3 text-muted-foreground text-xs">{order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">אין הזמנות קשורות למוצר זה</p>
        )}
      </div>

      {/* Product Issues Tab */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <ProductIssuesTab productId={product.id} />
      </div>

      {/* Learning Journal Section */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShowJournal(!showJournal)} className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">📖 הערות למידה</h2>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{journalEntries.length}</span>
          </button>
          <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-3 w-3 ml-1" />הוסף</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>הערת למידה חדשה</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1"><Label>כותרת *</Label><Input value={jTitle} onChange={e => setJTitle(e.target.value)} placeholder="מה למדת?" /></div>
                <div className="space-y-1"><Label>תוכן</Label><Textarea value={jContent} onChange={e => setJContent(e.target.value)} rows={4} /></div>
                <div className="space-y-1">
                  <Label>סטטוס</Label>
                  <Select value={jStatus} onValueChange={setJStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="למידה">📚 למידה</SelectItem>
                      <SelectItem value="שאלה פתוחה">❓ שאלה פתוחה</SelectItem>
                      <SelectItem value="הובן">✅ הובן</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddJournal} disabled={!jTitle.trim()} className="w-full">הוסף הערה</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {showJournal && (
          journalEntries.length > 0 ? (
            <div className="space-y-3">
              {journalEntries.map(e => (
                <div key={e.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass[e.status] || "bg-muted text-muted-foreground"}`}>{e.status}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(e.date), "dd/MM/yyyy")}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{e.title}</p>
                  {e.content && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{e.content}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">אין הערות למידה למוצר זה</p>
          )
        )}
        {!showJournal && journalEntries.length > 0 && (
          <p className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => setShowJournal(true)}>
            לחץ להצגת {journalEntries.length} הערות למידה...
          </p>
        )}
      </div>
    </div>
  );
}
