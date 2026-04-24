import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { markItemAsFaulty, unmarkItemAsFaulty } from "@/lib/inventoryUtils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Package,
  PackageX,
  TrendingDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { NewPickupDialog } from "@/components/equipment/NewPickupDialog";
import { NewReturnDialog } from "@/components/equipment/NewReturnDialog";
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import type { ColDef } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Installer {
  id: string;
  name: string;
  warehouse_number: number | null;
  division: string;
  status: string;
  coordinator: string | null;
  phone: string | null;
  entity_type: string | null;
}

interface PickupRow {
  id: string;
  pickup_date: string;
  notes: string | null;
  created_by: string | null;
  product_name: string;
  product_id: string;
  quantity: number;
  serial_numbers: string[] | null;
}

interface ReturnRow {
  id: string;
  return_item_id: string;
  return_date: string;
  product_name: string;
  product_id: string;
  quantity: number;
  reason: string;
  reason_detail: string | null;
  sticker_label: string | null;
  is_actually_faulty: boolean | null;
  logged_by: string | null;
  serial_numbers: string[] | null;
  photo_url: string | null;
}

// ─── Column Defs ──────────────────────────────────────────────────────────────

const FIELD_INV_COLS: ColDef[] = [
  { id: "product", label: "מוצר", sortField: "product" },
  { id: "sku", label: 'מק"ט' },
  { id: "balance", label: "בשטח", sortField: "balance" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SortIcon({ field, currentField, currentDir }: { field: string; currentField: string | null; currentDir: "asc" | "desc" }) {
  if (currentField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function returnPctColor(pct: number) {
  if (pct <= 5) return "text-green-600";
  if (pct <= 15) return "text-yellow-600";
  return "text-red-600";
}

function returnPctBadge(pct: number) {
  if (pct <= 5) return "bg-green-100 text-green-700 hover:bg-green-100";
  if (pct <= 15) return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
  return "bg-red-100 text-red-700 hover:bg-red-100";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InstallerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products } = useData();
  const { user } = useAuth();

  const [installer, setInstaller] = useState<Installer | null>(null);
  const [pickupRows, setPickupRows] = useState<PickupRow[]>([]);
  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingFaulty, setUpdatingFaulty] = useState<string | null>(null);

  const [showNewPickup, setShowNewPickup] = useState(false);
  const [showNewReturn, setShowNewReturn] = useState(false);

  const [invSortField, setInvSortField] = useState<string | null>("product");
  const [invSortDir, setInvSortDir] = useState<"asc" | "desc">("asc");
  const fieldInvColVis = useColumnVisibility("installer-inventory:hidden-columns", FIELD_INV_COLS);
  const { menu: invMenu, setMenu: setInvMenu, closeMenu: closeInvMenu } = useColMenu();

  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [products]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [instRes, pickRes, retRes] = await Promise.all([
        supabase.from("installers").select("*").eq("id", id).single(),
        supabase
          .from("equipment_pickups")
          .select("id, pickup_date, notes, created_by, equipment_pickup_items(id, product_id, quantity, serial_numbers)")
          .eq("installer_id", id)
          .order("pickup_date", { ascending: false }),
        supabase
          .from("equipment_returns")
          .select(
            "id, return_date, logged_by, equipment_return_items(id, product_id, quantity, reason, reason_detail, sticker_label, is_actually_faulty, serial_numbers, photo_url)"
          )
          .eq("installer_id", id)
          .order("return_date", { ascending: false }),
      ]);

      if (instRes.error) throw instRes.error;
      if (pickRes.error) throw pickRes.error;
      if (retRes.error) throw retRes.error;

      setInstaller(instRes.data as Installer);

      type PickupItemRaw = { id: string; product_id: string; quantity: number; serial_numbers: string[] | null };
      type PickupRaw = { id: string; pickup_date: string; notes: string | null; created_by: string | null; equipment_pickup_items: PickupItemRaw[] };
      type ReturnItemRaw = { id: string; product_id: string; quantity: number; reason: string; reason_detail: string | null; sticker_label: string | null; is_actually_faulty: boolean | null; serial_numbers: string[] | null; photo_url: string | null };
      type ReturnRaw = { id: string; return_date: string; logged_by: string | null; equipment_return_items: ReturnItemRaw[] };

      // Flatten pickup items
      const pRows: PickupRow[] = [];
      ((pickRes.data ?? []) as PickupRaw[]).forEach((pickup) => {
        (pickup.equipment_pickup_items ?? []).forEach((item) => {
          pRows.push({
            id: pickup.id,
            pickup_date: pickup.pickup_date,
            notes: pickup.notes,
            created_by: pickup.created_by,
            product_name: productMap.get(item.product_id) ?? item.product_id,
            product_id: item.product_id,
            quantity: item.quantity,
            serial_numbers: item.serial_numbers,
          });
        });
      });
      setPickupRows(pRows);

      // Flatten return items
      const rRows: ReturnRow[] = [];
      ((retRes.data ?? []) as ReturnRaw[]).forEach((ret) => {
        (ret.equipment_return_items ?? []).forEach((item) => {
          rRows.push({
            id: ret.id,
            return_item_id: item.id,
            return_date: ret.return_date,
            product_name: productMap.get(item.product_id) ?? item.product_id,
            product_id: item.product_id,
            quantity: item.quantity,
            reason: item.reason,
            reason_detail: item.reason_detail,
            sticker_label: item.sticker_label,
            is_actually_faulty: item.is_actually_faulty,
            logged_by: ret.logged_by,
            serial_numbers: item.serial_numbers,
            photo_url: item.photo_url,
          });
        });
      });
      setReturnRows(rRows);
    } catch (err) {
      toast.error("שגיאה בטעינת נתוני המתקין");
    } finally {
      setLoading(false);
    }
  }, [id, productMap]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPI computations
  const totalTaken = useMemo(
    () => pickupRows.reduce((sum, r) => sum + r.quantity, 0),
    [pickupRows]
  );
  const totalReturned = useMemo(
    () => returnRows.reduce((sum, r) => sum + r.quantity, 0),
    [returnRows]
  );
  const returnPct = totalTaken > 0 ? Math.round((totalReturned / totalTaken) * 100) : 0;
  const inField = totalTaken - totalReturned;

  const fieldInventory = useMemo(() => {
    const map = new Map<string, { taken: number; returned: number }>();
    pickupRows.forEach((r) => {
      const cur = map.get(r.product_id) ?? { taken: 0, returned: 0 };
      cur.taken += r.quantity;
      map.set(r.product_id, cur);
    });
    returnRows.forEach((r) => {
      const cur = map.get(r.product_id) ?? { taken: 0, returned: 0 };
      cur.returned += r.quantity;
      map.set(r.product_id, cur);
    });
    const items = [...map.entries()]
      .map(([productId, { taken, returned }]) => {
        const prod = products.find((p) => p.id === productId);
        return {
          productId,
          productName: prod?.name ?? productId,
          sku: prod?.sku ?? null,
          balance: taken - returned,
        };
      })
      .filter((e) => e.balance > 0);

    return [...items].sort((a, b) => {
      const dir = invSortDir === "asc" ? 1 : -1;
      if (invSortField === "balance") return (a.balance - b.balance) * dir;
      return a.productName.localeCompare(b.productName, "he") * dir;
    });
  }, [pickupRows, returnRows, products, invSortField, invSortDir]);

  const handleFaultyToggle = async (returnItemId: string, current: boolean | null) => {
    // Cycle: null → false → true → null
    const next = current === null ? false : current === false ? true : null;
    setUpdatingFaulty(returnItemId);

    const row = returnRows.find((r) => r.return_item_id === returnItemId);
    const prod = row ? products.find((p) => p.id === row.product_id) : null;
    const userName = (user as { name?: string } | null)?.name ?? null;
    const userId = (user as { id?: string } | null)?.id ?? null;

    try {
      const { error } = await supabase
        .from("equipment_return_items")
        .update({
          is_actually_faulty: next,
          checked_at: next !== null ? new Date().toISOString() : null,
        })
        .eq("id", returnItemId);
      if (error) throw error;

      // Waste / inventory side-effects (fire-and-forget)
      if (row) {
        if (next === true && current !== true) {
          // Newly confirmed faulty → deduct from inventory + create waste item
          markItemAsFaulty({
            productId: row.product_id,
            productName: row.product_name,
            sku: prod?.sku ?? null,
            quantity: row.quantity,
            returnItemId,
            changedBy: userId,
            changedByName: userName,
          }).catch(() => toast.error("שגיאה בעדכון המלאי"));
        } else if (current === true && next !== true) {
          // Un-confirmed faulty → restore inventory + delete waste item
          unmarkItemAsFaulty({
            productId: row.product_id,
            quantity: row.quantity,
            returnItemId,
            changedBy: userId,
            changedByName: userName,
          }).catch(() => toast.error("שגיאה בעדכון המלאי"));
        }
      }

      setReturnRows((prev) =>
        prev.map((r) =>
          r.return_item_id === returnItemId ? { ...r, is_actually_faulty: next } : r
        )
      );
    } catch {
      toast.error("שגיאה בעדכון הסטטוס");
    } finally {
      setUpdatingFaulty(null);
    }
  };

  const handlePhotoSave = async (returnItemId: string, url: string) => {
    const { error } = await supabase
      .from("equipment_return_items")
      .update({ photo_url: url })
      .eq("id", returnItemId);
    if (error) { toast.error("שגיאה בשמירת תמונה"); return; }
    setReturnRows((prev) =>
      prev.map((r) => r.return_item_id === returnItemId ? { ...r, photo_url: url } : r)
    );
  };

  const FaultyCell = ({ row }: { row: ReturnRow }) => {
    const isUpdating = updatingFaulty === row.return_item_id;
    if (isUpdating) return <Loader2 className="h-4 w-4 animate-spin mx-auto" />;
    const v = row.is_actually_faulty;
    return (
      <button
        title="לחץ לשינוי סטטוס"
        className="flex items-center justify-center mx-auto hover:scale-110 transition-transform"
        onClick={() => handleFaultyToggle(row.return_item_id, v)}
      >
        {v === true && <CheckCircle2 className="h-5 w-5 text-red-500" />}
        {v === false && <XCircle className="h-5 w-5 text-green-600" />}
        {v === null && <Clock className="h-5 w-5 text-muted-foreground/50" />}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  if (!installer) {
    return (
      <div className="p-6 text-center text-muted-foreground">מתקין לא נמצא</div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/equipment")}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{installer.name}</h1>
              {installer.entity_type === "bonded" ? (
                <Badge variant="outline" className="text-xs gap-1">
                  <Building2 className="h-3 w-3" />
                  ישות מסחרית
                </Badge>
              ) : (
                installer.warehouse_number && (
                  <Badge variant="outline">מחסן {installer.warehouse_number}</Badge>
                )
              )}
              <Badge variant="outline" className="text-xs">{installer.division}</Badge>
              <Badge
                className={`text-xs ${installer.status === "פעיל" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}`}
              >
                {installer.status}
              </Badge>
            </div>
            {(installer.coordinator || installer.phone) && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {installer.coordinator && <span>מתאם: {installer.coordinator}</span>}
                {installer.phone && (
                  <span dir="ltr" className={installer.coordinator ? "ms-3" : ""}>
                    {installer.phone}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowNewPickup(true)}>
            <Package className="h-4 w-4 me-1" />
            הצטיידות חדשה
          </Button>
          <Button size="sm" onClick={() => setShowNewReturn(true)}>
            <PackageX className="h-4 w-4 me-1" />
            החזרה חדשה
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "פריטים נלקחו", value: totalTaken, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "פריטים הוחזרו", value: totalReturned, icon: PackageX, color: "text-orange-600", bg: "bg-orange-50" },
          {
            label: "אחוז החזרה",
            value: totalTaken > 0 ? `${returnPct}%` : "—",
            icon: TrendingDown,
            color: returnPctColor(returnPct),
            bg: returnPct <= 5 ? "bg-green-50" : returnPct <= 15 ? "bg-yellow-50" : "bg-red-50",
          },
          {
            label: "בשטח כעת",
            value: inField,
            icon: Layers,
            color: returnPctColor(returnPct),
            bg: returnPct <= 5 ? "bg-green-50" : returnPct <= 15 ? "bg-yellow-50" : "bg-red-50",
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className={`inline-flex p-1.5 rounded-lg ${kpi.bg} mb-2`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Field inventory breakdown */}
      <div>
        <h2 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
          מלאי שטח
        </h2>
        {fieldInventory.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border rounded-md">
            אין ציוד בשטח ✅
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b bg-muted/50"
                      onContextMenu={trContextMenu(fieldInvColVis.hiddenCols, setInvMenu)}
                    >
                      {FIELD_INV_COLS.map((col) =>
                        fieldInvColVis.isVisible(col.id) ? (
                          <th
                            key={col.id}
                            className="text-right p-3 font-semibold text-foreground"
                            onContextMenu={colThContextMenu(col, setInvMenu)}
                          >
                            {col.sortField ? (
                              <button
                                onClick={() => {
                                  if (invSortField === col.sortField) setInvSortDir((d) => (d === "asc" ? "desc" : "asc"));
                                  else { setInvSortField(col.sortField!); setInvSortDir("asc"); }
                                }}
                                className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                              >
                                {col.label}
                                <SortIcon field={col.sortField} currentField={invSortField} currentDir={invSortDir} />
                              </button>
                            ) : col.label}
                          </th>
                        ) : null
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {fieldInventory.map((item) => (
                      <tr key={item.productId} className="border-b last:border-0 hover:bg-muted/20">
                        {fieldInvColVis.isVisible("product") && <td className="p-3 font-medium">{item.productName}</td>}
                        {fieldInvColVis.isVisible("sku") && (
                          <td className="p-3 font-mono text-xs text-muted-foreground" dir="ltr">{item.sku ?? "—"}</td>
                        )}
                        {fieldInvColVis.isVisible("balance") && (
                          <td className={`p-3 font-bold ${returnPctColor(returnPct)}`}>{item.balance}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pickup history table */}
      <div>
        <h2 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
          היסטוריית הצטיידויות
        </h2>
        {pickupRows.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
            אין הצטיידויות עדיין
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>מוצר</TableHead>
                  <TableHead className="text-center">כמות</TableHead>
                  <TableHead className="hidden md:table-cell">מספרים סידוריים</TableHead>
                  <TableHead className="hidden md:table-cell">הערות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pickupRows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">
                      {format(new Date(row.pickup_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{row.product_name}</TableCell>
                    <TableCell className="text-center">{row.quantity}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground dir-ltr">
                      {row.serial_numbers?.join(", ") ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {row.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Return history table */}
      <div>
        <h2 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
          היסטוריית החזרות
        </h2>
        {returnRows.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
            אין החזרות עדיין ✅
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>מוצר</TableHead>
                  <TableHead className="text-center">כמות</TableHead>
                  <TableHead>סיבה</TableHead>
                  <TableHead className="hidden md:table-cell">מדבקה</TableHead>
                  <TableHead className="text-center">תמונה</TableHead>
                  <TableHead className="text-center">באמת פגום?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnRows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">
                      {format(new Date(row.return_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{row.product_name}</TableCell>
                    <TableCell className="text-center">{row.quantity}</TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="secondary" className="text-xs">{row.reason}</Badge>
                        {row.reason_detail && (
                          <p className="text-xs text-muted-foreground mt-0.5">{row.reason_detail}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {row.sticker_label ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <PhotoCaptureButton
                          imageUrl={row.photo_url}
                          storagePath={`wear-return-items/${row.return_item_id}`}
                          onSave={(url) => handlePhotoSave(row.return_item_id, url)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <FaultyCell row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewPickupDialog
        open={showNewPickup}
        onOpenChange={setShowNewPickup}
        onCreated={fetchData}
        preselectedInstallerId={id}
      />
      <NewReturnDialog
        open={showNewReturn}
        onOpenChange={setShowNewReturn}
        onCreated={fetchData}
        preselectedInstallerId={id}
      />

      {invMenu && (
        <ColContextMenu
          menu={invMenu}
          sortField={invSortField}
          sortDir={invSortDir}
          hiddenCols={fieldInvColVis.hiddenCols}
          onClose={closeInvMenu}
          onHide={fieldInvColVis.hide}
          onShow={fieldInvColVis.show}
          onSortAsc={(field) => { setInvSortField(field); setInvSortDir("asc"); closeInvMenu(); }}
          onSortDesc={(field) => { setInvSortField(field); setInvSortDir("desc"); closeInvMenu(); }}
        />
      )}
    </div>
  );
}
