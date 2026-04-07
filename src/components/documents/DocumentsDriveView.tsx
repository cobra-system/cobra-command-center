import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth } from "@/contexts/AppContext";
import { logger } from "@/lib/logger";
import {
  Folder, FolderOpen, FileText, FileSpreadsheet, File,
  LayoutGrid, List, ChevronLeft, Paperclip, Trash2, Eye,
  RefreshCw, ShoppingCart, Package, Copy, MoreVertical, CheckCircle2,
  Clock, Send, CircleCheck,
} from "lucide-react";
import { EntityContextMenu, type ContextMenuGroupItem } from "@/components/EntityContextMenu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { PurchaseDocument } from "./types";
import { docStatusFlow, docStatusColors, currencySymbol } from "./constants";
import { DocTypeBadge, DocStatusBadge } from "./DocStatusBadge";
import { usePermissions } from "@/hooks/usePermissions";

type ViewMode = "grid" | "list";

interface Folder {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  iconColor: string;
  description: string;
}

const FOLDERS: Folder[] = [
  {
    id: "PI",
    label: "חשבוניות PI",
    color: "border-blue-200",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-500",
    description: "Proforma Invoice",
  },
  {
    id: "PO",
    label: "הזמנות רכש PO",
    color: "border-green-200",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    iconColor: "text-green-500",
    description: "Purchase Order",
  },
  {
    id: "כללי",
    label: "מסמכים כלליים",
    color: "border-orange-200",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    iconColor: "text-orange-500",
    description: "General Documents",
  },
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  "ממתין לאישור": <Clock className="h-3 w-3" />,
  "אושר": <CheckCircle2 className="h-3 w-3" />,
  "נשלח לספק": <Send className="h-3 w-3" />,
  "בוצע": <CircleCheck className="h-3 w-3" />,
};

function getFileIcon(doc: PurchaseDocument) {
  const name = (doc.document_name || "").toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv"))
    return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
  if (name.endsWith(".pdf"))
    return <FileText className="h-8 w-8 text-red-500" />;
  return <File className="h-8 w-8 text-primary" />;
}

interface Props {
  docs: PurchaseDocument[];
  search: string;
  onRefresh: () => void;
}

export default function DocumentsDriveView({ docs, search, onRefresh }: Props) {
  const { suppliers, products, orders } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { hasEdit } = usePermissions("documents");

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company || "—";
  const productName = (id: string | null) => products.find(p => p.id === id)?.name || "—";
  const orderLabel = (id: string | null) => {
    if (!id) return null;
    const o = orders.find(o => o.id === id);
    return o ? (o.supplier_name || o.id.slice(0, 8)) : null;
  };

  const folderDocs = useMemo(() => {
    if (!activeFolder) return [];
    let result = docs.filter(d => d.type === activeFolder);
    if (statusFilter !== "all") result = result.filter(d => d.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        supplierName(d.supplier_id).toLowerCase().includes(q) ||
        productName(d.product_id).toLowerCase().includes(q) ||
        (d.document_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [docs, activeFolder, statusFilter, search, suppliers, products]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    FOLDERS.forEach(f => { counts[f.id] = docs.filter(d => d.type === f.id).length; });
    return counts;
  }, [docs]);

  const handleStatusChange = async (docId: string, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "אושר") {
      updates.approval_date = new Date().toISOString();
      updates.approved_by = currentUser?.id;
    }
    await supabase.from("purchase_documents").update(updates).eq("id", docId);
    onRefresh();
  };

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
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

  // ── Folder top-level view ──────────────────────────────────────────────────
  if (!activeFolder) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">בחר תיקייה לצפייה במסמכים</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FOLDERS.map(folder => {
            const count = folderCounts[folder.id] || 0;
            return (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={cn(
                  "group relative flex items-center gap-4 p-5 rounded-xl border-2 text-right transition-all duration-200",
                  "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
                  folder.bgColor, folder.color
                )}
              >
                <div className={cn("p-3 rounded-xl bg-white/60 dark:bg-black/20 shadow-sm flex-shrink-0", folder.iconColor)}>
                  <Folder className="h-8 w-8 fill-current opacity-80" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{folder.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{folder.description}</p>
                  <p className="text-xs font-medium mt-1.5 text-foreground/70">
                    {count} מסמכים
                  </p>
                </div>
                <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Recent documents strip */}
        {docs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">מסמכים אחרונים</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {docs.slice(0, 5).map(doc => (
                <button
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="group flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-muted/40 hover:shadow-sm transition-all text-center"
                >
                  <div className="relative">
                    {getFileIcon(doc)}
                    {doc.file_url && (
                      <Paperclip className="absolute -bottom-1 -right-1 h-3 w-3 text-muted-foreground bg-card rounded" />
                    )}
                  </div>
                  <div className="w-full">
                    <p className="text-xs font-medium text-foreground truncate">
                      {doc.document_name || doc.notes || "ללא שם"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(doc.created_at), "dd/MM/yy")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Inside a folder ────────────────────────────────────────────────────────
  const folder = FOLDERS.find(f => f.id === activeFolder)!;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Breadcrumb + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setActiveFolder(null)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Folder className="h-4 w-4" />
            <span>מסמכים</span>
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <FolderOpen className={cn("h-4 w-4", folder.iconColor)} />
            {folder.label}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {folderDocs.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {docStatusFlow.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {folderDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className={cn("h-16 w-16 mb-4 opacity-30", folder.iconColor)} />
          <p className="text-muted-foreground font-medium">התיקייה ריקה</p>
          <p className="text-sm text-muted-foreground mt-1">אין מסמכים מסוג {folder.label}</p>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {viewMode === "grid" && folderDocs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {folderDocs.map(doc => {
            const docName = doc.document_name || doc.notes || "ללא שם";
            return (
              <div
                key={doc.id}
                className="group relative flex flex-col rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                {/* Thumbnail area */}
                <div className="flex items-center justify-center h-24 bg-muted/30 border-b relative">
                  {getFileIcon(doc)}
                  {doc.file_url && (
                    <Paperclip className="absolute bottom-2 left-2 h-3 w-3 text-muted-foreground" />
                  )}
                  {/* Actions menu */}
                  <div
                    className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-full bg-background/80 hover:bg-background shadow-sm">
                          <MoreVertical className="h-3.5 w-3.5 text-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48" dir="rtl">
                        <DropdownMenuItem onClick={() => navigate(`/documents/${doc.id}`)}>
                          <Eye className="h-4 w-4 ml-2" />צפה במסמך
                        </DropdownMenuItem>
                        {doc.order_id && (
                          <DropdownMenuItem onClick={() => navigate(`/orders/${doc.order_id}`)}>
                            <ShoppingCart className="h-4 w-4 ml-2" />עבור להזמנה
                          </DropdownMenuItem>
                        )}
                        {doc.product_id && (
                          <DropdownMenuItem onClick={() => navigate(`/products/${doc.product_id}`)}>
                            <Package className="h-4 w-4 ml-2" />עבור למוצר
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => { navigator.clipboard.writeText(docName); toast.success("שם המסמך הועתק"); }}
                        >
                          <Copy className="h-4 w-4 ml-2" />העתק שם
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Status change sub-items */}
                        {docStatusFlow.map(s => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => handleStatusChange(doc.id, s)}
                            disabled={doc.status === s}
                            className="text-xs"
                          >
                            <RefreshCw className="h-3 w-3 ml-2" />{s}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        {hasEdit && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={e => e.preventDefault()}
                              >
                                <Trash2 className="h-4 w-4 ml-2" />מחק מסמך
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogTitle>מחיקת מסמך</AlertDialogTitle>
                              <AlertDialogDescription>
                                האם אתה בטוח שברצונך למחוק את "{docName}"? פעולה זו לא ניתנת לביטול.
                              </AlertDialogDescription>
                              <div className="flex gap-2 justify-end">
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(doc.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  מחק
                                </AlertDialogAction>
                              </div>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Info area */}
                <div className="p-2.5">
                  <p className="text-xs font-medium text-foreground truncate leading-tight">{docName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {supplierName(doc.supplier_id)}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                      {STATUS_ICONS[doc.status]}
                      {doc.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(doc.created_at), "dd/MM/yy")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && folderDocs.length > 0 && (
        <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">שם</th>
                <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
                <th className="text-right p-3 font-semibold text-foreground">מחיר כולל</th>
                <th className="text-right p-3 font-semibold text-foreground">הזמנה</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
                <th className="text-right p-3 font-semibold text-foreground">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {folderDocs.map(doc => {
                const docName = doc.document_name || doc.notes || "ללא שם";
                const docMenuGroups: ContextMenuGroupItem[][] = [
                  [
                    { label: "צפה במסמך", icon: Eye, onClick: () => navigate(`/documents/${doc.id}`) },
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
                    { label: "מחק מסמך", icon: Trash2, onClick: () => handleDelete(doc.id), variant: "destructive" as const, confirmTitle: "מחיקת מסמך", confirmDescription: `האם אתה בטוח שברצונך למחוק את המסמך "${docName}"? פעולה זו לא ניתנת לביטול.` },
                  ],
                ];
                return (
                  <EntityContextMenu key={doc.id} groups={docMenuGroups}>
                    <tr
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <td className="p-3 text-foreground">
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc)}
                          <div>
                            <p className="font-medium truncate max-w-[160px]">{docName}</p>
                            {doc.file_url && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Paperclip className="h-2.5 w-2.5" />קובץ מצורף
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-foreground">{supplierName(doc.supplier_id)}</td>
                      <td className="p-3 text-foreground">{productName(doc.product_id)}</td>
                      <td className="p-3 text-muted-foreground font-mono" dir="ltr">
                        {doc.total_price ? `${currencySymbol[doc.currency] || ""}${doc.total_price.toLocaleString()}` : "—"}
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        {doc.order_id && orderLabel(doc.order_id) ? (
                          <button className="text-xs text-accent hover:underline" onClick={() => navigate(`/orders/${doc.order_id}`)}>
                            {orderLabel(doc.order_id)}
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                              {STATUS_ICONS[doc.status]}
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
                      <td className="p-3 text-muted-foreground text-xs">{format(new Date(doc.created_at), "dd/MM/yy")}</td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === doc.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogTitle>מחיקת מסמך</AlertDialogTitle>
                            <AlertDialogDescription>
                              האם אתה בטוח שברצונך למחוק את "{docName}"? פעולה זו לא ניתנת לביטול.
                            </AlertDialogDescription>
                            <div className="flex gap-2 justify-end">
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(doc.id)}
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
      )}
    </div>
  );
}
