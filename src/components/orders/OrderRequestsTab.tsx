import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { OrderRequestDialog } from "@/components/orders/OrderRequestDialog";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart, Plus, ClipboardList, Inbox } from "lucide-react";
import type { ColDef } from "@/hooks/useColumnVisibility";
import type { OrderRequest } from "@/contexts/types";
import { DIVISIONS, BONDED_DIVISIONS } from "@/components/equipment/constants";
import { isDivisionManager } from "@/lib/permissions";

const COLUMN_DEFS: ColDef[] = [
  { id: "division", label: "חטיבה", sortField: "division" },
  { id: "product", label: "מוצר", sortField: "product_name" },
  { id: "supplier", label: "ספק", sortField: "supplier" },
  { id: "quantity", label: "כמות", sortField: "quantity" },
  { id: "urgency", label: "דחיפות", sortField: "urgency" },
  { id: "order_type", label: "סוג הזמנה" },
  { id: "consumption", label: "צריכה נוכחית" },
  { id: "reason", label: "סיבה" },
  { id: "created_at", label: "תאריך בקשה", sortField: "created_at" },
  { id: "status", label: "סטטוס", sortField: "status" },
  { id: "ordered_by", label: "הוזמן ע\"י" },
  { id: "ordered_at", label: "תאריך הזמנה", sortField: "ordered_at" },
];

function SortIcon({ field, currentField, currentDir }: { field: string; currentField: string | null; currentDir: "asc" | "desc" }) {
  if (currentField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function OrderRequestsTab() {
  const { addOrder, suppliers, products } = useData();
  const { currentUser } = useAuth();

  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "ordered">("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string | null>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [fulfillingRequest, setFulfillingRequest] = useState<OrderRequest | null>(null);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [divisionProductIds, setDivisionProductIds] = useState<string[]>([]);

  // Bonded division managers can submit requests for their own division.
  // Procurement managers fulfill requests but don't create them here.
  const userDivision = currentUser?.division ?? "";
  const canCreateRequest =
    isDivisionManager(currentUser) && BONDED_DIVISIONS.has(userDivision);

  const { isVisible, hide, show, hiddenCols } = useColumnVisibility(
    "manager-order-requests:hidden-columns",
    COLUMN_DEFS,
    ["consumption", "reason", "ordered_by", "ordered_at"]
  );
  const { menu, setMenu, closeMenu } = useColMenu();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("order_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { toast.error("שגיאה בטעינת בקשות"); }
    else { setRequests((data ?? []) as OrderRequest[]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Load this user's division products so the new-request dialog
  // can offer the same product list as DivisionDetailPage does.
  useEffect(() => {
    if (!canCreateRequest) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("division_products")
        .select("product_id")
        .eq("division", userDivision);
      if (cancelled) return;
      if (error) { setDivisionProductIds([]); return; }
      setDivisionProductIds((data ?? []).map(d => d.product_id as string));
    })();
    return () => { cancelled = true; };
  }, [canCreateRequest, userDivision]);

  const dialogDivisionProducts = useMemo(
    () => divisionProductIds.map(product_id => ({
      product_id,
      products: { id: product_id, name: "", sku: "" },
    })),
    [divisionProductIds],
  );

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleOrderCreated = useCallback(async (orderId: string) => {
    if (!fulfillingRequest) return;
    const { error } = await supabase
      .from("order_requests")
      .update({
        status: "ordered",
        order_id: orderId,
        ordered_at: new Date().toISOString(),
        ordered_by: currentUser?.id ?? null,
        ordered_by_name: currentUser?.name ?? null,
      })
      .eq("id", fulfillingRequest.id);
    if (error) { toast.error("שגיאה בעדכון הבקשה"); }
    else { toast.success("הבקשה סומנה כהוזמנה"); }
    setFulfillingRequest(null);
    await fetchRequests();
  }, [fulfillingRequest, currentUser, fetchRequests]);

  const filtered = requests
    .filter(r => statusFilter === "all" || r.status === statusFilter)
    .filter(r => divisionFilter === "all" || r.division === divisionFilter)
    .sort((a, b) => {
      if (!sortField) return 0;
      const av = (a as Record<string, unknown>)[sortField] ?? "";
      const bv = (b as Record<string, unknown>)[sortField] ?? "";
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const prefillProduct = fulfillingRequest?.product_id
    ? products.find(p => p.id === fulfillingRequest.product_id)
    : undefined;
  const prefillSupplier = prefillProduct?.supplier
    ? suppliers.find(s => s.company === prefillProduct.supplier)
    : undefined;

  const orderedCount = requests.filter(r => r.status === "ordered").length;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header card */}
      <div className="bg-card rounded-xl border shadow-sm p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">בקשות הזמנה</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingCount > 0
                  ? <><span className="font-semibold text-amber-600">{pendingCount}</span> ממתינות לטיפול · {orderedCount} הוזמנו</>
                  : <>אין בקשות ממתינות · {orderedCount} הוזמנו</>}
              </p>
            </div>
          </div>
          {canCreateRequest && (
            <Button size="sm" onClick={() => setShowNewRequest(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />בקשה חדשה
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">סטטוס</label>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הבקשות ({requests.length})</SelectItem>
                <SelectItem value="pending">ממתינות{pendingCount > 0 && ` (${pendingCount})`}</SelectItem>
                <SelectItem value="ordered">הוזמנו{orderedCount > 0 && ` (${orderedCount})`}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">חטיבה</label>
            <Select value={divisionFilter} onValueChange={setDivisionFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל החטיבות</SelectItem>
                {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Body: loading / empty / table */}
      {loading ? (
        <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
          <div className="inline-block h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3">טוען בקשות…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
          <div className="inline-flex h-12 w-12 rounded-full bg-muted items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">אין בקשות הזמנה</p>
          <p className="text-xs text-muted-foreground mt-1">
            {statusFilter !== "all" || divisionFilter !== "all"
              ? "נסה לשנות את הסינון או לבחור 'כל הבקשות'"
              : canCreateRequest
              ? "פתחו בקשה חדשה כדי להתחיל"
              : "כשמנהלי חטיבה יפתחו בקשות, הן יופיעו כאן"}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {filtered.map(req => (
              <div key={req.id} className="bg-card rounded-xl border shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm">{req.product_name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{req.division}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{req.quantity} יח׳</span>
                      {req.supplier && <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">{req.supplier}</span>
                      </>}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                    req.status === "ordered"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    {req.status === "ordered" ? "הוזמן" : "ממתינה"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    req.urgency === "דחוף" ? "bg-red-50 text-red-700 border-red-200" :
                    req.urgency === "רגיל" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    "bg-gray-50 text-gray-600 border-gray-200"
                  }`}>{req.urgency}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(req.created_at), "dd/MM/yyyy")}</span>
                  {req.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 ms-auto" onClick={() => setFulfillingRequest(req)}>
                      <ShoppingCart className="h-3 w-3" />הזמן
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto" dir="rtl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setMenu)}>
                  {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                    <th
                      key={col.id}
                      className="text-right p-3 font-semibold text-foreground text-xs whitespace-nowrap"
                      onContextMenu={colThContextMenu(col, setMenu)}
                    >
                      {col.sortField ? (
                        <button
                          onClick={() => toggleSort(col.sortField!)}
                          className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                        >
                          {col.label}
                          <SortIcon field={col.sortField} currentField={sortField} currentDir={sortDir} />
                        </button>
                      ) : col.label}
                    </th>
                  ) : null)}
                  <th className="p-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(req => (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    {isVisible("division") && (
                      <td className="p-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{req.division}</span>
                      </td>
                    )}
                    {isVisible("product") && <td className="p-3 font-medium text-foreground">{req.product_name}</td>}
                    {isVisible("supplier") && <td className="p-3 text-muted-foreground">{req.supplier ?? "—"}</td>}
                    {isVisible("quantity") && <td className="p-3 tabular-nums">{req.quantity}</td>}
                    {isVisible("urgency") && (
                      <td className="p-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          req.urgency === "דחוף" ? "bg-red-50 text-red-700 border-red-200" :
                          req.urgency === "רגיל" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-gray-50 text-gray-600 border-gray-200"
                        }`}>{req.urgency}</span>
                      </td>
                    )}
                    {isVisible("order_type") && <td className="p-3 text-muted-foreground text-xs">{req.order_type}</td>}
                    {isVisible("consumption") && <td className="p-3 text-muted-foreground tabular-nums">{req.current_consumption ?? "—"}</td>}
                    {isVisible("reason") && <td className="p-3 text-muted-foreground max-w-[180px] truncate" title={req.reason ?? ""}>{req.reason ?? "—"}</td>}
                    {isVisible("created_at") && (
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(req.created_at), "dd/MM/yyyy")}
                      </td>
                    )}
                    {isVisible("status") && (
                      <td className="p-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          req.status === "ordered"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {req.status === "ordered" ? "הוזמן" : "ממתינה"}
                        </span>
                      </td>
                    )}
                    {isVisible("ordered_by") && <td className="p-3 text-muted-foreground text-xs">{req.ordered_by_name ?? "—"}</td>}
                    {isVisible("ordered_at") && (
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {req.ordered_at ? format(new Date(req.ordered_at), "dd/MM/yyyy") : "—"}
                      </td>
                    )}
                    <td className="p-3">
                      {req.status === "pending" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setFulfillingRequest(req)}>
                          <ShoppingCart className="h-3 w-3" />הזמן
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* New-request dialog (bonded division managers) */}
      {canCreateRequest && (
        <OrderRequestDialog
          open={showNewRequest}
          onOpenChange={setShowNewRequest}
          division={userDivision}
          divisionProducts={dialogDivisionProducts}
          allProducts={products}
          onCreated={fetchRequests}
        />
      )}

      {/* Fulfill dialog */}
      {fulfillingRequest && (
        <NewOrderDialog
          open={!!fulfillingRequest}
          onOpenChange={(open) => { if (!open) setFulfillingRequest(null); }}
          suppliers={suppliers}
          products={products}
          addOrder={addOrder}
          defaultProductId={fulfillingRequest.product_id ?? undefined}
          defaultSupplierId={prefillSupplier?.id}
          defaultQuantity={fulfillingRequest.quantity ?? undefined}
          hideTrigger
          onOrderCreated={handleOrderCreated}
        />
      )}

      {menu && (
        <ColContextMenu
          menu={menu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={(field) => { setSortField(field); setSortDir("asc"); closeMenu(); }}
          onSortDesc={(field) => { setSortField(field); setSortDir("desc"); closeMenu(); }}
        />
      )}
    </div>
  );
}
