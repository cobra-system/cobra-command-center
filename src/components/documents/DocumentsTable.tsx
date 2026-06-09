import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth, useCurrency } from "@/contexts/AppContext";
import { logger } from "@/lib/logger";
import { ArrowUpDown, ArrowUp, ArrowDown, Paperclip, Trash2, Eye, RefreshCw, Pencil, ShoppingCart, Package, Copy } from "lucide-react";
import { EntityContextMenu, type ContextMenuGroupItem } from "@/components/EntityContextMenu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { supabase } from "@/lib/supabase";
import type { PurchaseDocument } from "./types";
import { docStatusFlow, docStatusColors, currencySymbol } from "./constants";
import { DocTypeBadge } from "./DocStatusBadge";

type SortField = "name" | "type" | "supplier" | "product" | "quantity" | "total_price" | "status" | "created_at" | "order";

interface Props {
  docs: PurchaseDocument[];
  search: string;
  onRefresh: () => void;
  onEdit?: (doc: PurchaseDocument) => void;
}

const COLUMN_DEFS = [
  { id: "name",        label: "שם",         sortField: "name" },
  { id: "type",        label: "סוג",        sortField: "type" },
  { id: "supplier",    label: "ספק",        sortField: "supplier" },
  { id: "product",     label: "מוצר",       sortField: "product" },
  { id: "quantity",    label: "כמות",       sortField: "quantity" },
  { id: "total_price", label: "מחיר כולל",  sortField: "total_price" },
  { id: "order",       label: "הזמנה" },
  { id: "status",      label: "סטטוס",      sortField: "status" },
  { id: "approval",    label: "אישור" },
  { id: "created_at",  label: "תאריך",      sortField: "created_at" },
] as const;

export default function DocumentsTable({ docs, search, onRefresh, onEdit }: Props) {
  const { suppliers, products, orders } = useData();
  const { currentUser } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const prefs = useTablePreferences("DocumentsTable", {
    sortField: "created_at",
    sortDir: "desc",
    filters: { typeFilter: "all", statusFilter: "all" },
  });
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility("documents:hidden-columns", COLUMN_DEFS);
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const sortField = prefs.sortField as SortField | null;
  const sortDir = prefs.sortDir;
  const typeFilter = prefs.filters.typeFilter || "all";
  const statusFilter = prefs.filters.statusFilter || "all";

  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company || "—";
  const productName = (id: string | null) => products.find(p => p.id === id)?.name || "—";
  const orderLabel = (id: string | null) => {
    if (!id) return null;
    const o = orders.find(o => o.id === id);
    return o ? (o.supplier_name || o.id.slice(0, 8)) : null;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filtered = useMemo(() => {
    let result = docs;

    if (typeFilter !== "all") result = result.filter(d => d.type === typeFilter);
    if (statusFilter !== "all") result = result.filter(d => d.status === statusFilter);
      if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        supplierName(d.supplier_id).toLowerCase().includes(q) ||
        productName(d.product_id).toLowerCase().includes(q) ||
        (d.document_name || "").toLowerCase().includes(q) ||
        (d.document_number || "").toLowerCase().includes(q)
      );
    }

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "name": cmp = (a.document_name || "").localeCompare(b.document_name || ""); break;
          case "type": cmp = a.type.localeCompare(b.type); break;
          case "supplier": cmp = supplierName(a.supplier_id).localeCompare(supplierName(b.supplier_id)); break;
          case "product": cmp = productName(a.product_id).localeCompare(productName(b.product_id)); break;
          case "quantity": cmp = (a.quantity || 0) - (b.quantity || 0); break;
          case "total_price": cmp = (a.total_price || 0) - (b.total_price || 0); break;
          case "status": cmp = docStatusFlow.indexOf(a.status) - docStatusFlow.indexOf(b.status); break;
          case "created_at": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [docs, typeFilter, statusFilter, search, sortField, sortDir]);

  const handleStatusChange = async (docId: string, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "אושר") {
      updates.approval_date = new Date().toISOString();
      updates.approved_by = currentUser?.id;
    }
    await supabase.from("purchase_documents").update(updates).eq("id", docId);
    onRefresh();
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingId(docId);
    try {
      // Delete from database
      const { error } = await supabase.from("purchase_documents").delete().eq("id", docId);
      if (error) throw error;

      toast.success("מסמך נמחק");
      onRefresh();
    } catch (err) {
      toast.error("שגיאה במחיקת המסמך");
      logger.error("Error deleting document", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Select value={typeFilter} onValueChange={(v) => prefs.setFilter("typeFilter", v)}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="סוג" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="PI">PI</SelectItem>
            <SelectItem value="PO">PO</SelectItem>
            <SelectItem value="כללי">כללי</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => prefs.setFilter("statusFilter", v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            {docStatusFlow.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2" dir="rtl">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין מסמכים</p>
        ) : filtered.map(doc => {
          const docName = doc.document_name || doc.notes || "ללא שם";
          return (
            <div
              key={doc.id}
              className="bg-card rounded-xl border shadow-sm p-4 cursor-pointer active:bg-muted/30 transition-colors"
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {doc.file_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <p className="font-semibold text-foreground truncate">{docName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <DocTypeBadge type={doc.type} />
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                      {doc.status}
                    </span>
                  </div>
                </div>
                {doc.total_price && (
                  <p className="font-bold text-foreground shrink-0 text-sm" dir="ltr">
                    {formatPrice(doc.total_price, doc.currency)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {supplierName(doc.supplier_id) !== "—" && <span>{supplierName(doc.supplier_id)}</span>}
                {productName(doc.product_id) !== "—" && <span>{productName(doc.product_id)}</span>}
                {doc.quantity && <span>{doc.quantity} יח׳</span>}
                <span>{format(new Date(doc.created_at), "dd/MM/yyyy")}</span>
              </div>
              <div className="mt-2 flex gap-3" onClick={e => e.stopPropagation()}>
                {onEdit && (
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onEdit(doc)}>
                    <Pencil className="h-3.5 w-3.5 inline ml-0.5" />עריכה
                  </button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-xs text-destructive hover:underline" disabled={deletingId === doc.id}>
                      <Trash2 className="h-3.5 w-3.5 inline ml-0.5" />מחק
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogTitle>מחיקת מסמך</AlertDialogTitle>
                    <AlertDialogDescription>
                      האם אתה בטוח שברצונך למחוק את המסמך "{docName}"? פעולה זו לא ניתנת לביטול.
                    </AlertDialogDescription>
                    <div className="flex gap-2 justify-end">
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteDocument(doc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        מחק
                      </AlertDialogAction>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto" dir="rtl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
              {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                  {col.sortField ? (
                    <button onClick={() => prefs.toggleSort(col.sortField!)} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
                      {col.label} <SortIcon field={col.sortField} />
                    </button>
                  ) : col.label}
                </th>
              ) : null)}
              <th className="text-right p-3 font-semibold text-foreground">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={visibleCount + 1} className="p-8 text-center text-muted-foreground">אין מסמכים</td></tr>
            ) : filtered.map(doc => {
              const docName = doc.document_name || doc.notes || "ללא שם";
              const docMenuGroups: ContextMenuGroupItem[][] = [
                [
                  { label: "צפה במסמך", icon: Eye, onClick: () => navigate(`/documents/${doc.id}`) },
                  { label: "ערוך מסמך", icon: Pencil, onClick: () => onEdit?.(doc), hidden: !onEdit },
                  { label: "עבור להזמנה", icon: ShoppingCart, onClick: () => navigate(`/orders/${doc.order_id}`), hidden: !doc.order_id },
                  { label: "עבור למוצר", icon: Package, onClick: () => navigate(`/products/${doc.product_id}`), hidden: !doc.product_id },
                ],
                [
                  {
                    label: "שנה סטטוס", icon: RefreshCw,
                    items: docStatusFlow.map(s => ({
                      label: s, onClick: () => handleStatusChange(doc.id, s),
                      disabled: doc.status === s,
                    })),
                  },
                ],
                [
                  { label: "העתק שם מסמך", icon: Copy, onClick: () => { navigator.clipboard.writeText(docName); toast.success("שם המסמך הועתק"); }, hidden: !doc.document_name && !doc.notes },
                ],
                [
                  { label: "מחק מסמך", icon: Trash2, onClick: () => handleDeleteDocument(doc.id), variant: "destructive" as const, confirmTitle: "מחיקת מסמך", confirmDescription: `האם אתה בטוח שברצונך למחוק את המסמך "${docName}"? פעולה זו לא ניתנת לביטול.` },
                ],
              ];
              return (
              <EntityContextMenu key={doc.id} groups={docMenuGroups}>
              <tr
                className="hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                {isVisible("name") && (
                  <td className="p-3 text-foreground">
                    <div className="flex items-center gap-1.5">
                      {doc.file_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                      <span className="truncate max-w-[200px]">{doc.document_name || doc.notes || "ללא שם"}</span>
                    </div>
                  </td>
                )}
                {isVisible("type") && <td className="p-3"><DocTypeBadge type={doc.type} /></td>}
                {isVisible("supplier") && <td className="p-3 text-foreground">{supplierName(doc.supplier_id)}</td>}
                {isVisible("product") && <td className="p-3 text-foreground">{productName(doc.product_id)}</td>}
                {isVisible("quantity") && <td className="p-3 text-muted-foreground">{doc.quantity || "—"}</td>}
                {isVisible("total_price") && (
                  <td className="p-3 text-muted-foreground font-mono" dir="ltr">
                    {doc.total_price ? formatPrice(doc.total_price, doc.currency) : "—"}
                  </td>
                )}
                {isVisible("order") && (
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    {doc.order_id && orderLabel(doc.order_id) ? (
                      <button
                        className="text-xs text-accent hover:underline"
                        onClick={() => navigate(`/orders/${doc.order_id}`)}
                      >
                        {orderLabel(doc.order_id)}
                      </button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                )}
                {isVisible("status") && (
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn("px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                          {doc.status}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-1" align="start">
                        <div className="flex flex-col gap-0.5">
                          {docStatusFlow.map(s => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(doc.id, s)}
                              className={cn("px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted", doc.status === s && "bg-muted")}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                )}
                {isVisible("approval") && (
                  <td className="p-3 text-xs text-muted-foreground">
                    {doc.approved_by ? format(new Date(doc.approval_date!), "dd/MM/yyyy") : "—"}
                  </td>
                )}
                {isVisible("created_at") && <td className="p-3 text-muted-foreground text-xs">{format(new Date(doc.created_at), "dd/MM/yyyy")}</td>}
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === doc.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogTitle>מחיקת מסמך</AlertDialogTitle>
                      <AlertDialogDescription>
                        האם אתה בטוח שברצונך למחוק את המסמך "{doc.document_name || doc.notes || "ללא שם"}"? פעולה זו לא ניתנת לביטול.
                      </AlertDialogDescription>
                      <div className="flex gap-2 justify-end">
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          מחק
                        </AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
              </EntityContextMenu>
              );
            })}
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
    </div>
  );
}
