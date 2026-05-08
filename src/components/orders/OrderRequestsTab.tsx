import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { OrderRequestDialog } from "@/components/orders/OrderRequestDialog";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart, Plus } from "lucide-react";
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הבקשות</SelectItem>
            <SelectItem value="pending">ממתינות {pendingCount > 0 && `(${pendingCount})`}</SelectItem>
            <SelectItem value="ordered">הוזמנו</SelectItem>
          </SelectContent>
        </Select>
        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="חטיבה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל החטיבות</SelectItem>
            {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        {canCreateRequest && (
          <Button
            size="sm"
            className="h-8 text-sm gap-1 ms-auto"
            onClick={() => setShowNewRequest(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            בקשה חדשה
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">טוען...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">אין בקשות הזמנה</div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                className="border-b bg-muted/50"
                onContextMenu={trContextMenu(hiddenCols, setMenu)}
              >
                {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                  <TableHead
                    key={col.id}
                    className="text-right p-3 font-semibold text-foreground text-xs"
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
                  </TableHead>
                ) : null)}
                {/* Fixed: actions column */}
                <TableHead className="p-3 w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(req => (
                <TableRow key={req.id} className="text-sm">
                  {isVisible("division") && (
                    <TableCell className="p-3">
                      <Badge variant="outline" className="text-xs">{req.division}</Badge>
                    </TableCell>
                  )}
                  {isVisible("product") && <TableCell className="p-3 font-medium">{req.product_name}</TableCell>}
                  {isVisible("supplier") && <TableCell className="p-3 text-muted-foreground">{req.supplier ?? "—"}</TableCell>}
                  {isVisible("quantity") && <TableCell className="p-3">{req.quantity ?? "—"}</TableCell>}
                  {isVisible("urgency") && (
                    <TableCell className="p-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        req.urgency === "דחוף" ? "bg-red-50 text-red-700 border-red-200" :
                        req.urgency === "רגיל" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-gray-50 text-gray-600 border-gray-200"
                      }`}>{req.urgency}</span>
                    </TableCell>
                  )}
                  {isVisible("order_type") && <TableCell className="p-3 text-muted-foreground">{req.order_type}</TableCell>}
                  {isVisible("consumption") && <TableCell className="p-3 text-muted-foreground">{req.current_consumption ?? "—"}</TableCell>}
                  {isVisible("reason") && <TableCell className="p-3 text-muted-foreground max-w-[160px] truncate">{req.reason ?? "—"}</TableCell>}
                  {isVisible("created_at") && (
                    <TableCell className="p-3 text-muted-foreground text-xs">
                      {format(new Date(req.created_at), "dd/MM/yyyy")}
                    </TableCell>
                  )}
                  {isVisible("status") && (
                    <TableCell className="p-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        req.status === "ordered"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {req.status === "ordered" ? "הוזמן" : "ממתינה"}
                      </span>
                    </TableCell>
                  )}
                  {isVisible("ordered_by") && <TableCell className="p-3 text-muted-foreground text-xs">{req.ordered_by_name ?? "—"}</TableCell>}
                  {isVisible("ordered_at") && (
                    <TableCell className="p-3 text-muted-foreground text-xs">
                      {req.ordered_at ? format(new Date(req.ordered_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                  )}
                  {/* Fixed: action button */}
                  <TableCell className="p-3">
                    {req.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => setFulfillingRequest(req)}
                      >
                        <ShoppingCart className="h-3 w-3" />
                        הזמן
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
