import { useState, useEffect, useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, Plus, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, Clock, Hash, Minus, Circle, Check, X, Filter } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { DiagnosticWizard, SimpleIssueForm } from "@/components/ProductIssuesTab";

import { format } from "date-fns";
type SortKey = "reported_date" | "product_id" | "reporter" | "severity" | "status";

const COLUMN_DEFS = [
  { id: "reported_date", label: "תאריך",      sortField: "reported_date" },
  { id: "product_id",    label: "מוצר",       sortField: "product_id" },
  { id: "supplier",      label: "ספק" },
  { id: "reporter",      label: "מדווח",      sortField: "reporter" },
  { id: "description",   label: "תיאור" },
  { id: "severity",      label: "חומרה",      sortField: "severity" },
  { id: "status",        label: "סטטוס",      sortField: "status" },
  { id: "ticket_number", label: "מספר פנייה" },
] as const;

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

const severityBorderColors: Record<string, string> = {
  "נמוך":   "border-r-border",
  "בינוני": "border-r-warning",
  "גבוה":   "border-r-destructive",
  "קריטי":  "border-r-destructive",
};

function relativeDate(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "היום";
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  return `לפני ${Math.floor(days / 30)} חודשים`;
}

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
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility("issues:hidden-columns", COLUMN_DEFS);
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const sortKey = prefs.sortField as SortKey | null;
  const sortDir = prefs.sortDir;
  const filterProduct = prefs.filters.filterProduct || "all";
  const filterStatus = prefs.filters.filterStatus || "all";
  const filterSeverity = prefs.filters.filterSeverity || "all";

  const totalCount      = issues.length;
  const openCount       = issues.filter(i => i.status === "פתוח").length;
  const inProgressCount = issues.filter(i => i.status === "בטיפול").length;
  const criticalCount   = issues.filter(i => i.severity === "קריטי").length;
  const closedCount     = issues.filter(i => i.status === "נסגר").length;
  const hasActiveFilters = filterProduct !== "all" || filterStatus !== "all" || filterSeverity !== "all";

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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: 'סה"כ תקלות', value: totalCount,      Icon: Wrench,       color: "text-muted-foreground", bg: "bg-muted/50",       onClick: () => prefs.savePreferences({ filters: { filterProduct: "all", filterStatus: "all", filterSeverity: "all" } }) },
          { label: "פתוחות",     value: openCount,        Icon: AlertTriangle, color: "text-destructive",      bg: "bg-destructive/10", onClick: () => prefs.setFilter("filterStatus", "פתוח") },
          { label: "בטיפול",     value: inProgressCount,  Icon: Clock,         color: "text-warning",          bg: "bg-warning/10",     onClick: () => prefs.setFilter("filterStatus", "בטיפול") },
          { label: "קריטיות",    value: criticalCount,    Icon: AlertTriangle, color: "text-destructive",      bg: "bg-destructive/10", onClick: () => prefs.setFilter("filterSeverity", "קריטי") },
          { label: "סגורות",     value: closedCount,      Icon: CheckCircle2,  color: "text-success",          bg: "bg-success/10",     onClick: () => prefs.setFilter("filterStatus", "נסגר") },
        ].map(card => (
          <div key={card.label} onClick={card.onClick} className="bg-card rounded-xl border p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${card.bg}`}>
                <card.Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => prefs.savePreferences({ filters: { filterProduct: "all", filterStatus: "all", filterSeverity: "all" } })}
          >
            <X className="h-3.5 w-3.5" />נקה סינון
          </Button>
        )}
        <span className="text-xs text-muted-foreground mr-auto">
          מציג {filtered.length} מתוך {totalCount} תקלות
        </span>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Wrench className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">אין תקלות להצגה</p>
            <p className="text-xs text-muted-foreground">נסה לשנות את הסינון או לחפש מוצר אחר</p>
          </div>
        ) : filtered.map(issue => {
          const supplier = getSupplierForProduct(issue.product_id);
          return (
            <div
              key={issue.id}
              className={`bg-card rounded-xl border shadow-sm p-4 cursor-pointer active:bg-muted/30 transition-colors border-r-2 ${severityBorderColors[issue.severity] || "border-r-border"} ${issue.severity === "קריטי" ? "bg-destructive/5" : ""}`}
              onClick={() => navigate(`/issues/${issue.id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[issue.severity] || "bg-muted text-muted-foreground"}`}>
                    {issue.severity}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status] || "bg-muted text-muted-foreground"}`}>
                    {issue.status}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{relativeDate(issue.reported_date)}</span>
              </div>
              <p className="font-semibold text-foreground">{productMap[issue.product_id] || "—"}</p>
              {supplier && (
                <p className="text-xs text-muted-foreground mt-0.5">{supplier.company}</p>
              )}
              <p className="text-sm text-foreground/80 mt-1.5 line-clamp-2">{issue.description}</p>
              <p className="text-xs text-muted-foreground mt-2">דווח ע"י: {issue.reporter}</p>
              {issue.ticket_number && (
                <span className="inline-flex items-center gap-0.5 mt-1.5 bg-muted/70 border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                  <Hash className="h-3 w-3" />{issue.ticket_number}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
              {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                  {col.sortField ? (
                    <button onClick={() => prefs.toggleSort(col.sortField!)} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
                      {col.label} <SortIcon col={col.sortField} />
                    </button>
                  ) : col.label}
                </th>
              ) : null)}
            </tr>
          </thead>
          <tbody className="divide-y">
            <TooltipProvider>
            {filtered.length === 0 ? (
              <tr><td colSpan={visibleCount} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Wrench className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">אין תקלות להצגה</p>
                </div>
              </td></tr>
            ) : filtered.map(issue => {
              const supplier = getSupplierForProduct(issue.product_id);
              return (
                <tr
                  key={issue.id}
                  className={`hover:bg-muted/30 transition-colors cursor-pointer border-r-2 ${severityBorderColors[issue.severity] || "border-r-border"} ${issue.severity === "קריטי" ? "bg-destructive/5" : ""}`}
                  onClick={() => navigate(`/issues/${issue.id}`)}
                  data-navigate-to={`/issues/${issue.id}`}
                >
                  {isVisible("reported_date") && (
                    <td className="p-3">
                      <div className="text-xs text-foreground">{format(new Date(issue.reported_date), "dd/MM/yyyy")}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{relativeDate(issue.reported_date)}</div>
                    </td>
                  )}
                  {isVisible("product_id") && <td className="p-3 text-primary font-medium">{productMap[issue.product_id] || "—"}</td>}
                  {isVisible("supplier") && (
                    <td className="p-3" onClick={supplier ? (e) => navigateToSupplier(issue.product_id, e) : undefined}>
                      {supplier ? (
                        <button data-navigate-to={`/suppliers/${supplier.id}`} className="text-primary hover:underline text-sm">{supplier.company}</button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  {isVisible("reporter") && <td className="p-3 text-foreground">{issue.reporter}</td>}
                  {isVisible("description") && (
                    <td className="p-3 max-w-[250px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate block text-foreground cursor-default">{issue.description}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs text-xs">{issue.description}</TooltipContent>
                      </Tooltip>
                    </td>
                  )}
                  {isVisible("severity") && (
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors[issue.severity] || "bg-muted text-muted-foreground"}`}>
                        {(issue.severity === "קריטי" || issue.severity === "גבוה")
                          ? <AlertTriangle className="h-3 w-3" />
                          : issue.severity === "בינוני"
                            ? <Minus className="h-3 w-3" />
                            : <Circle className="h-2.5 w-2.5 fill-current" />}
                        {issue.severity}
                      </span>
                    </td>
                  )}
                  {isVisible("status") && (
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[issue.status] || "bg-muted text-muted-foreground"}`}>
                        {issue.status === "פתוח"
                          ? <Circle className="h-2.5 w-2.5" />
                          : issue.status === "בטיפול"
                            ? <Clock className="h-3 w-3" />
                            : <Check className="h-3 w-3" />}
                        {issue.status}
                      </span>
                    </td>
                  )}
                  {isVisible("ticket_number") && (
                    <td className="p-3">
                      {issue.ticket_number ? (
                        <span className="inline-flex items-center gap-0.5 bg-muted/70 border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                          <Hash className="h-3 w-3" />{issue.ticket_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            </TooltipProvider>
          </tbody>
        </table>
      </div>

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={prefs.sortField}
          sortDir={prefs.sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => prefs.savePreferences({ sortField: field, sortDir: "asc" })}
          onSortDesc={field => prefs.savePreferences({ sortField: field, sortDir: "desc" })}
        />
      )}

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
