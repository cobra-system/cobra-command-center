import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, Plus } from "lucide-react";
import { DiagnosticWizard, SimpleIssueForm } from "@/components/ProductIssuesTab";

interface Issue {
  id: string;
  product_id: string;
  reported_date: string;
  reporter: string;
  description: string;
  severity: string;
  status: string;
  ticket_number: string | null;
  diagnostic_source: string | null;
}

const severityColors: Record<string, string> = {
  "נמוך": "bg-muted text-muted-foreground",
  "בינוני": "bg-warning/15 text-warning",
  "גבוה": "bg-destructive/20 text-destructive",
  "קריטי": "bg-destructive text-destructive-foreground",
};
const statusColors: Record<string, string> = {
  "פתוח": "bg-destructive/15 text-destructive",
  "בטיפול": "bg-warning/15 text-warning",
  "נסגר": "bg-success/15 text-success",
};

export default function IssuesPage() {
  const { products, suppliers } = useData();
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [newIssueProductId, setNewIssueProductId] = useState("");

  const refreshIssues = async () => {
    const { data } = await supabase.from("product_issues").select("id, product_id, reported_date, reporter, description, severity, status, ticket_number, diagnostic_source").order("reported_date", { ascending: false });
    if (data) setIssues(data as Issue[]);
  };

  useEffect(() => {
    (async () => {
      await refreshIssues();
      setLoading(false);
    })();
  }, []);

  const productMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [products]);

  const getSupplierForProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.supplier) return null;
    return suppliers.find(s => s.company === product.supplier || s.id === product.supplier);
  };

  const navigateToSupplier = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const supplier = getSupplierForProduct(productId);
    if (supplier) navigate(`/suppliers/${supplier.id}`);
  };

  const filtered = useMemo(() => {
    return issues.filter(i => {
      if (filterProduct !== "all" && i.product_id !== filterProduct) return false;
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
      return true;
    });
  }, [issues, filterProduct, filterStatus, filterSeverity]);

  const productsWithIssues = useMemo(() => {
    const set = new Set(issues.map(i => i.product_id));
    return products.filter(p => set.has(p.id));
  }, [issues, products]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wrench className="h-6 w-6 text-primary" />
          תקלות
        </h1>
        <Button onClick={() => { setNewIssueProductId(""); setNewIssueOpen(true); }}>
          <Plus className="h-4 w-4 ml-2" />פתח תקלה
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-48"><SelectValue placeholder="כל המוצרים" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המוצרים</SelectItem>
            {productsWithIssues.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="פתוח">פתוח</SelectItem>
            <SelectItem value="בטיפול">בטיפול</SelectItem>
            <SelectItem value="נסגר">נסגר</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-36"><SelectValue placeholder="חומרה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הרמות</SelectItem>
            <SelectItem value="נמוך">נמוך</SelectItem>
            <SelectItem value="בינוני">בינוני</SelectItem>
            <SelectItem value="גבוה">גבוה</SelectItem>
            <SelectItem value="קריטי">קריטי</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
              <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">ספק</th>
              <th className="text-right p-3 font-semibold text-foreground">מדווח</th>
              <th className="text-right p-3 font-semibold text-foreground">תיאור</th>
              <th className="text-right p-3 font-semibold text-foreground">חומרה</th>
              <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
              <th className="text-right p-3 font-semibold text-foreground">מספר פנייה</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">אין תקלות להצגה</td></tr>
            ) : filtered.map(issue => {
              const supplier = getSupplierForProduct(issue.product_id);
              return (
                <tr key={issue.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/products/${issue.product_id}`)}>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(issue.reported_date).toLocaleDateString("he-IL")}</td>
                  <td className="p-3 text-primary font-medium">{productMap[issue.product_id] || "—"}</td>
                  <td className="p-3" onClick={supplier ? (e) => navigateToSupplier(issue.product_id, e) : undefined}>
                    {supplier ? (
                      <button className="text-primary hover:underline text-sm">{supplier.company}</button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-foreground">{issue.reporter}</td>
                  <td className="p-3 text-foreground max-w-[250px] truncate">{issue.description}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[issue.severity] || "bg-muted text-muted-foreground"}`}>{issue.severity}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status] || "bg-muted text-muted-foreground"}`}>{issue.status}</span></td>
                  <td className="p-3 text-xs text-muted-foreground font-mono">{issue.ticket_number || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Issue Dialog */}
      <Dialog open={newIssueOpen} onOpenChange={open => { setNewIssueOpen(open); if (!open) setNewIssueProductId(""); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>פתיחת תקלה חדשה</DialogTitle></DialogHeader>
          {!newIssueProductId ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">בחר מוצר לפתיחת תקלה:</p>
              <Select onValueChange={setNewIssueProductId}>
                <SelectTrigger><SelectValue placeholder="בחר מוצר..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            (() => {
              const prod = products.find(p => p.id === newIssueProductId);
              const isProof = prod && (prod.name.includes("PROOF") || prod.name.includes("פרוף"));
              return isProof ? (
                <DiagnosticWizard
                  productId={newIssueProductId}
                  onClose={() => { setNewIssueOpen(false); setNewIssueProductId(""); }}
                  onSaved={() => { setNewIssueOpen(false); setNewIssueProductId(""); refreshIssues(); }}
                />
              ) : (
                <SimpleIssueForm
                  productId={newIssueProductId}
                  onClose={() => { setNewIssueOpen(false); setNewIssueProductId(""); }}
                  onSaved={() => { setNewIssueOpen(false); setNewIssueProductId(""); refreshIssues(); }}
                />
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
