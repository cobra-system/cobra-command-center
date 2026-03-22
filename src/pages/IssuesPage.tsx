import { useState, useEffect, useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, Plus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { DiagnosticWizard, SimpleIssueForm } from "@/components/ProductIssuesTab";

type SortKey = "reported_date" | "product_id" | "reporter" | "severity" | "status";

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
  const { hasEdit } = usePermissions("issues");
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [newIssueProductId, setNewIssueProductId] = useState("");

  const prefs = useTablePreferences("IssuesPage", {
    sortField: "reported_date",
    sortDir: "desc",
    filters: { filterProduct: "all", filterStatus: "all", filterSeverity: "all" },
  });

  const sortKey = prefs.sortField as SortKey | null;
  const sortDir = prefs.sortDir;
  const filterProduct = prefs.filters.filterProduct || "all";
  const filterStatus = prefs.filters.filterStatus || "all";
  const filterSeverity = prefs.filters.filterSeverity || "all";

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
    let result = issues.filter(i => {
      if (filterProduct !== "all" && i.product_id !== filterProduct) return false;
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
      return true;
    });

    // Apply sorting
    if (sortKey && sortDir) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "reported_date":
            cmp = new Date(a.reported_date).getTime() - new Date(b.reported_date).getTime();
            break;
          case "product_id":
            cmp = (a.product_id || "").localeCompare(b.product_id || "", "he");
            break;
          case "reporter":
            cmp = (a.reporter || "").localeCompare(b.reporter || "", "he");
            break;
          case "severity": {
            const severityOrder = { "נמוך": 0, "בינוני": 1, "גבוה": 2, "קריטי": 3 };
            cmp = (severityOrder[a.severity as keyof typeof severityOrder] ?? 999) - (severityOrder[b.severity as keyof typeof severityOrder] ?? 999);
            break;
          }
          case "status": {
            const statusOrder = { "פתוח": 0, "בטיפול": 1, "נסגר": 2 };
            cmp = (statusOrder[a.status as keyof typeof statusOrder] ?? 999) - (statusOrder[b.status as keyof typeof statusOrder] ?? 999);
            break;
          }
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    } else {
      // Default sort by reported_date desc
      result = [...result].sort((a, b) => new Date(b.reported_date).getTime() - new Date(a.reported_date).getTime());
    }

    return result;
  }, [issues, filterProduct, filterStatus, filterSeverity, sortKey, sortDir]);

  const productsWithIssues = useMemo(() => {
    const set = new Set(issues.map(i => i.product_id));
    return products.filter(p => set.has(p.id));
  }, [issues, products]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wrench className="h-6 w-6 text-primary" />
          תקלות
        </h1>
        {hasEdit && (
          <Button onClick={() => { setNewIssueProductId(""); setNewIssueOpen(true); }}>
            <Plus className="h-4 w-4 ml-2" />פתח תקלה
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterProduct} onValueChange={(v) => prefs.setFilter("filterProduct", v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="כל המוצרים" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המוצרים</SelectItem>
            {productsWithIssues.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => prefs.setFilter("filterStatus", v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="פתוח">פתוח</SelectItem>
            <SelectItem value="בטיפול">בטיפול</SelectItem>
            <SelectItem value="נסגר">נסגר</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={(v) => prefs.setFilter("filterSeverity", v)}>
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
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("reported_date")}>
                <span className="flex items-center gap-1">תאריך <SortIcon col="reported_date" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("product_id")}>
                <span className="flex items-center gap-1">מוצר <SortIcon col="product_id" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground">ספק</th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("reporter")}>
                <span className="flex items-center gap-1">מדווח <SortIcon col="reporter" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground">תיאור</th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("severity")}>
                <span className="flex items-center gap-1">חומרה <SortIcon col="severity" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("status")}>
                <span className="flex items-center gap-1">סטטוס <SortIcon col="status" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground">מספר פנייה</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">אין תקלות להצגה</td></tr>
            ) : filtered.map(issue => {
              const supplier = getSupplierForProduct(issue.product_id);
              return (
                <tr key={issue.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/products/${issue.product_id}`)} data-navigate-to={`/products/${issue.product_id}`}>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(issue.reported_date).toLocaleDateString("he-IL")}</td>
                  <td className="p-3 text-primary font-medium">{productMap[issue.product_id] || "—"}</td>
                  <td className="p-3" onClick={supplier ? (e) => navigateToSupplier(issue.product_id, e) : undefined}>
                    {supplier ? (
                      <button data-navigate-to={`/suppliers/${supplier.id}`} className="text-primary hover:underline text-sm">{supplier.company}</button>
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
