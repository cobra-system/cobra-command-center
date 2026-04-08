import { useState, useMemo, useEffect, useCallback } from "react";
import { differenceInDays, isPast, isValid, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useData, useAuth } from "@/contexts/AppContext";
import { logger } from "@/lib/logger";
import {
  Folder, FolderOpen, FileText, FileSpreadsheet, File,
  LayoutGrid, List, ChevronLeft, Paperclip, Trash2, Eye,
  RefreshCw, ShoppingCart, Package, Copy, MoreVertical,
  CheckCircle2, Clock, Send, CircleCheck, Star, Download,
  Pencil, FolderPlus, FolderSymlink, AlertCircle, CalendarX,
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { PurchaseDocument, DocumentFolder } from "./types";
import { docStatusFlow, docStatusColors, currencySymbol } from "./constants";
import { DocStatusBadge } from "./DocStatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import CreateFolderDialog from "./CreateFolderDialog";
import DocumentPdfViewerDialog from "./DocumentPdfViewerDialog";
import BulkActionsBar from "./BulkActionsBar";

// ── folder color helpers ───────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; border: string; icon: string; fill: string }> = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-200",  icon: "text-blue-500",   fill: "fill-blue-400" },
  green:  { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200", icon: "text-green-500",  fill: "fill-green-400" },
  orange: { bg: "bg-orange-50 dark:bg-orange-950/30",border: "border-orange-200",icon: "text-orange-500",fill: "fill-orange-400" },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/30",border: "border-purple-200",icon: "text-purple-500",fill: "fill-purple-400" },
  red:    { bg: "bg-red-50 dark:bg-red-950/30",     border: "border-red-200",   icon: "text-red-500",    fill: "fill-red-400" },
  gray:   { bg: "bg-gray-50 dark:bg-gray-900/30",   border: "border-gray-200",  icon: "text-gray-500",   fill: "fill-gray-400" },
};
function folderColors(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.blue;
}

// ── smart folders (client-side, by document type) ──────────────────────────────
const SMART_FOLDERS = [
  { id: "PI",    label: "חשבוניות PI",       description: "Proforma Invoice", color: "blue" },
  { id: "PO",    label: "הזמנות רכש PO",    description: "Purchase Order",   color: "green" },
  { id: "כללי", label: "מסמכים כלליים",     description: "General",          color: "orange" },
] as const;

// ── view types ─────────────────────────────────────────────────────────────────
type FolderView =
  | { kind: "root" }
  | { kind: "smart"; typeId: string }
  | { kind: "real"; folder: DocumentFolder }
  | { kind: "starred" };

type ViewMode = "grid" | "list";

// ── status icons ───────────────────────────────────────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
  "ממתין לאישור": <Clock className="h-3 w-3" />,
  "אושר":         <CheckCircle2 className="h-3 w-3" />,
  "נשלח לספק":   <Send className="h-3 w-3" />,
  "בוצע":         <CircleCheck className="h-3 w-3" />,
};

function getFileIcon(doc: PurchaseDocument, size = "h-8 w-8") {
  const name = (doc.document_name || "").toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv"))
    return <FileSpreadsheet className={cn(size, "text-green-500")} />;
  if (name.endsWith(".pdf"))
    return <FileText className={cn(size, "text-red-500")} />;
  return <File className={cn(size, "text-primary")} />;
}

function isPdf(doc: PurchaseDocument) {
  const url = doc.file_url || doc.document_name || "";
  return url.toLowerCase().includes(".pdf");
}

/** Extract the storage path from a Supabase public URL (e.g. ".../documents/uploads/foo.pdf" → "uploads/foo.pdf") */
function extractStoragePath(publicUrl: string): string | null {
  const marker = "/documents/";
  const idx = publicUrl.lastIndexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length).split("?")[0];
}

// ── expiry badge ───────────────────────────────────────────────────────────────
function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return null;
  const date = parseISO(expiryDate);
  if (!isValid(date)) return null;
  const daysLeft = differenceInDays(date, new Date());
  if (isPast(date) && daysLeft < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/15 text-destructive">
        <CalendarX className="h-2.5 w-2.5" />פג תוקף
      </span>
    );
  }
  if (daysLeft <= 30) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warning/15 text-warning">
        <CalendarX className="h-2.5 w-2.5" />{daysLeft}י׳
      </span>
    );
  }
  return null;
}

// ── props ──────────────────────────────────────────────────────────────────────
interface Props {
  docs: PurchaseDocument[];
  search: string;
  onRefresh: () => void;
  onAnnotate?: (doc: PurchaseDocument) => void;
}

export default function DocumentsDriveView({ docs, search, onRefresh, onAnnotate }: Props) {
  const { suppliers, products, orders } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { hasEdit } = usePermissions("documents");

  // ── folder state ─────────────────────────────────────────────────────────────
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [view, setView] = useState<FolderView>({ kind: "root" });
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // dialogs
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
  const [renameDocOpen, setRenameDocOpen] = useState(false);
  const [renamingDoc, setRenamingDoc] = useState<PurchaseDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [viewingPdf, setViewingPdf] = useState<PurchaseDocument | null>(null);

  // ── bulk selection ───────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });
  const selectAll = (ids: string[]) => setSelectedIds(new Set(ids));
  const clearSelection = () => setSelectedIds(new Set());

  // Clear selection when navigating between views
  useEffect(() => { setSelectedIds(new Set()); }, [view]);

  // ── fetch real folders ────────────────────────────────────────────────────────
  const fetchFolders = useCallback(async () => {
    const { data } = await supabase.from("document_folders").select("*").order("created_at");
    if (data) setFolders(data as DocumentFolder[]);
  }, []);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  // ── helpers ───────────────────────────────────────────────────────────────────
  const supplierName = useCallback((id: string | null) => suppliers.find(s => s.id === id)?.company || "—", [suppliers]);
  const productName  = useCallback((id: string | null) => products.find(p => p.id === id)?.name || "—", [products]);
  const orderLabel   = (id: string | null) => {
    if (!id) return null;
    const o = orders.find(o => o.id === id);
    return o ? (o.supplier_name || o.id.slice(0, 8)) : null;
  };

  // ── docs filtered for current view ────────────────────────────────────────────
  const visibleDocs = useMemo(() => {
    let result: PurchaseDocument[] = [];

    if (view.kind === "root") return [];
    if (view.kind === "smart")   result = docs.filter(d => d.type === view.typeId);
    if (view.kind === "real")    result = docs.filter(d => d.folder_id === view.folder.id);
    if (view.kind === "starred") result = docs.filter(d => d.is_starred);

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
  }, [docs, view, statusFilter, search, supplierName, productName]);

  const smartCounts  = useMemo(() => Object.fromEntries(
    SMART_FOLDERS.map(f => [f.id, docs.filter(d => d.type === f.id).length])
  ), [docs]);
  const realCounts   = useMemo(() => Object.fromEntries(
    folders.map(f => [f.id, docs.filter(d => d.folder_id === f.id).length])
  ), [docs, folders]);
  const starredCount = useMemo(() => docs.filter(d => d.is_starred).length, [docs]);

  // ── mutations ─────────────────────────────────────────────────────────────────
  const handleStatusChange = async (docId: string, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "אושר") {
      updates.approval_date = new Date().toISOString();
      updates.approved_by   = currentUser?.id;
    }
    const { error } = await supabase.from("purchase_documents").update(updates).eq("id", docId);
    if (error) { toast.error("שגיאה בעדכון סטטוס"); return; }
    onRefresh();
  };

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      // Find the doc to clean up its storage file
      const targetDoc = docs.find(d => d.id === docId);
      const { error } = await supabase.from("purchase_documents").delete().eq("id", docId);
      if (error) throw error;
      // Clean up storage file if it exists
      if (targetDoc?.file_url) {
        const storagePath = extractStoragePath(targetDoc.file_url);
        if (storagePath) await supabase.storage.from("documents").remove([storagePath]);
      }
      toast.success("מסמך נמחק");
      onRefresh();
    } catch (err) {
      toast.error("שגיאה במחיקת המסמך");
      logger.error("Error deleting document", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStar = async (doc: PurchaseDocument) => {
    const { error } = await supabase.from("purchase_documents").update({ is_starred: !doc.is_starred }).eq("id", doc.id);
    if (error) { toast.error("שגיאה בעדכון"); return; }
    onRefresh();
  };

  const handleMoveToFolder = async (docId: string, folderId: string | null) => {
    const { error } = await supabase.from("purchase_documents").update({ folder_id: folderId }).eq("id", docId);
    if (error) { toast.error("שגיאה בהעברת מסמך"); return; }
    toast.success(folderId ? "הועבר לתיקייה" : "הוסר מהתיקייה");
    onRefresh();
  };

  const handleDeleteFolder = async (folder: DocumentFolder) => {
    // Move documents to root first
    const { error: moveErr } = await supabase.from("purchase_documents").update({ folder_id: null }).eq("folder_id", folder.id);
    if (moveErr) { toast.error("שגיאה בהעברת מסמכים מהתיקייה"); return; }
    const { error: delErr } = await supabase.from("document_folders").delete().eq("id", folder.id);
    if (delErr) { toast.error("שגיאה במחיקת התיקייה"); return; }
    toast.success("התיקייה נמחקה");
    if (view.kind === "real" && view.folder.id === folder.id) setView({ kind: "root" });
    fetchFolders();
    onRefresh();
  };

  const openRename = (doc: PurchaseDocument) => {
    setRenamingDoc(doc);
    setRenameValue(doc.document_name || "");
    setRenameDocOpen(true);
  };

  const handleRenameDoc = async () => {
    if (!renamingDoc) return;
    const { error } = await supabase.from("purchase_documents")
      .update({ document_name: renameValue.trim() })
      .eq("id", renamingDoc.id);
    if (error) { toast.error("שגיאה בשינוי שם"); return; }
    toast.success("שם עודכן");
    setRenameDocOpen(false);
    onRefresh();
  };

  // ── breadcrumb label ──────────────────────────────────────────────────────────
  function breadcrumbLabel() {
    if (view.kind === "smart")   return SMART_FOLDERS.find(f => f.id === view.typeId)?.label ?? view.typeId;
    if (view.kind === "real")    return view.folder.name;
    if (view.kind === "starred") return "מועדפים";
    return "";
  }
  function breadcrumbColor() {
    if (view.kind === "smart")   return folderColors(SMART_FOLDERS.find(f => f.id === view.typeId)?.color ?? "blue").icon;
    if (view.kind === "real")    return folderColors(view.folder.color).icon;
    if (view.kind === "starred") return "text-yellow-500";
    return "";
  }

  // ── doc action menus (context + dropdown) ─────────────────────────────────────
  function buildDocMenuGroups(doc: PurchaseDocument): ContextMenuGroupItem[][] {
    const docName = doc.document_name || doc.notes || "ללא שם";
    return [
      [
        { label: "צפה במסמך",     icon: Eye,          onClick: () => navigate(`/documents/${doc.id}`) },
        { label: "שנה שם",        icon: Pencil,        onClick: () => openRename(doc) },
        ...(doc.file_url ? [{ label: "הורד קובץ", icon: Download, onClick: () => { const a = document.createElement("a"); a.href = doc.file_url!; a.download = docName; a.click(); } }] : []),
        ...(isPdf(doc) && onAnnotate ? [{ label: "ערוך / חתום", icon: Pencil, onClick: () => onAnnotate(doc) }] : []),
      ],
      [
        { label: doc.is_starred ? "הסר מועדף" : "הוסף למועדפים", icon: Star, onClick: () => handleToggleStar(doc) },
        {
          label: "העבר לתיקייה", icon: FolderSymlink,
          items: [
            { label: "— ללא תיקייה —", onClick: () => handleMoveToFolder(doc.id, null) },
            ...folders.map(f => ({ label: f.name, onClick: () => handleMoveToFolder(doc.id, f.id) })),
          ],
        },
      ],
      [
        {
          label: "שנה סטטוס", icon: RefreshCw,
          items: docStatusFlow.map(s => ({
            label: s, onClick: () => handleStatusChange(doc.id, s), disabled: doc.status === s,
          })),
        },
      ],
      [
        { label: "עבור להזמנה", icon: ShoppingCart, onClick: () => navigate(`/orders/${doc.order_id}`),   hidden: !doc.order_id },
        { label: "עבור למוצר",  icon: Package,      onClick: () => navigate(`/products/${doc.product_id}`), hidden: !doc.product_id },
        { label: "העתק שם",     icon: Copy,         onClick: () => { navigator.clipboard.writeText(docName); toast.success("הועתק"); }, hidden: !docName },
      ],
      [
        { label: "מחק מסמך", icon: Trash2, onClick: () => handleDelete(doc.id), variant: "destructive" as const,
          confirmTitle: "מחיקת מסמך", confirmDescription: `האם למחוק את "${docName}"? פעולה זו לא ניתנת לביטול.` },
      ],
    ];
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // ROOT VIEW
  // ──────────────────────────────────────────────────────────────────────────────
  if (view.kind === "root") {
    return (
      <div className="space-y-6" dir="rtl">
        {/* Smart folders */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">תיקיות לפי סוג</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SMART_FOLDERS.map(sf => {
              const c = folderColors(sf.color);
              return (
                <button
                  key={sf.id}
                  onClick={() => setView({ kind: "smart", typeId: sf.id })}
                  className={cn("group flex items-center gap-4 p-4 rounded-xl border-2 text-right transition-all hover:shadow-md hover:-translate-y-0.5", c.bg, c.border)}
                >
                  <div className={cn("p-2.5 rounded-xl bg-white/60 dark:bg-black/20 shadow-sm flex-shrink-0", c.icon)}>
                    <Folder className="h-7 w-7 fill-current opacity-80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{sf.label}</p>
                    <p className="text-xs text-muted-foreground">{sf.description}</p>
                    <p className="text-xs font-medium mt-1 text-foreground/60">{smartCounts[sf.id] ?? 0} מסמכים</p>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </section>

        {/* Real folders */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">התיקיות שלי</p>
            {hasEdit && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => { setEditingFolder(null); setCreateFolderOpen(true); }}>
                <FolderPlus className="h-3.5 w-3.5" />תיקייה חדשה
              </Button>
            )}
          </div>
          {folders.length === 0 ? (
            <button
              onClick={() => { setEditingFolder(null); setCreateFolderOpen(true); }}
              className="w-full flex flex-col items-center gap-2 py-8 border-2 border-dashed border-muted-foreground/20 rounded-xl text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <FolderPlus className="h-8 w-8" />
              <span className="text-sm">צור את התיקייה הראשונה שלך</span>
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {folders.map(folder => {
                const c = folderColors(folder.color);
                return (
                  <div key={folder.id} className="group relative">
                    <button
                      onClick={() => setView({ kind: "real", folder })}
                      className={cn("w-full flex items-center gap-3 p-4 rounded-xl border-2 text-right transition-all hover:shadow-md hover:-translate-y-0.5", c.bg, c.border)}
                    >
                      <Folder className={cn("h-8 w-8 flex-shrink-0", c.icon, c.fill)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{realCounts[folder.id] ?? 0} מסמכים</p>
                      </div>
                    </button>
                    {/* Folder actions */}
                    {hasEdit && (
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-md bg-background/80 hover:bg-background shadow-sm" onClick={e => e.stopPropagation()}>
                              <MoreVertical className="h-3.5 w-3.5 text-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" dir="rtl" className="w-40">
                            <DropdownMenuItem onClick={() => { setEditingFolder(folder); setCreateFolderOpen(true); }}>
                              <Pencil className="h-4 w-4 ml-2" />שנה שם
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={e => e.preventDefault()}>
                                  <Trash2 className="h-4 w-4 ml-2" />מחק תיקייה
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogTitle>מחיקת תיקייה</AlertDialogTitle>
                                <AlertDialogDescription>
                                  המסמכים בתיקייה יועברו לשורש. פעולה זו לא ניתנת לביטול.
                                </AlertDialogDescription>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteFolder(folder)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Add folder tile */}
              {hasEdit && (
                <button
                  onClick={() => { setEditingFolder(null); setCreateFolderOpen(true); }}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-h-[80px]"
                >
                  <FolderPlus className="h-6 w-6" />
                  <span className="text-xs">תיקייה חדשה</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* Starred */}
        {starredCount > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">מועדפים</p>
            </div>
            <button
              onClick={() => setView({ kind: "starred" })}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 hover:shadow-sm transition-all"
            >
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-400" />
              <span className="font-medium text-foreground">{starredCount} מסמכים מסומנים</span>
              <ChevronLeft className="h-4 w-4 text-muted-foreground/40 mr-auto" />
            </button>
          </section>
        )}

        {/* Recent */}
        {docs.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">מסמכים אחרונים</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {docs.slice(0, 6).map(doc => (
                <button
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="group flex flex-col items-center gap-2 p-3 rounded-xl border bg-card hover:bg-muted/40 hover:shadow-sm transition-all text-center"
                >
                  <div className="relative">
                    {getFileIcon(doc)}
                    {doc.is_starred && <Star className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500 fill-yellow-400" />}
                  </div>
                  <p className="text-xs font-medium text-foreground truncate w-full">
                    {doc.document_name || doc.notes || "ללא שם"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(doc.created_at), "dd/MM/yy")}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Dialogs */}
        <CreateFolderDialog
          open={createFolderOpen}
          onOpenChange={setCreateFolderOpen}
          onSaved={fetchFolders}
          editFolder={editingFolder}
        />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // INSIDE A FOLDER (smart / real / starred)
  // ──────────────────────────────────────────────────────────────────────────────
  const currentColor = view.kind === "starred" ? "text-yellow-500" : breadcrumbColor();

  return (
    <div className="space-y-4" dir="rtl">
      {/* Breadcrumb + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setView({ kind: "root" })}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Folder className="h-4 w-4" /><span>מסמכים</span>
          </button>
          <span className="text-muted-foreground">/</span>
          <span className={cn("flex items-center gap-1.5 font-medium text-foreground")}>
            {view.kind === "starred"
              ? <Star className={cn("h-4 w-4", currentColor, "fill-yellow-400")} />
              : <FolderOpen className={cn("h-4 w-4", currentColor)} />
            }
            {breadcrumbLabel()}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{visibleDocs.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="סטטוס" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {docStatusFlow.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty */}
      {visibleDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className={cn("h-16 w-16 mb-4 opacity-30", currentColor)} />
          <p className="text-muted-foreground font-medium">אין מסמכים</p>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {viewMode === "grid" && visibleDocs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {visibleDocs.map(doc => {
            const docName = doc.document_name || doc.notes || "ללא שם";
            return (
              <EntityContextMenu key={doc.id} groups={buildDocMenuGroups(doc)}>
                <div
                  className={cn(
                    "group relative flex flex-col rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer",
                    selectedIds.has(doc.id) && "ring-2 ring-primary border-primary"
                  )}
                  onClick={() => isPdf(doc) && doc.file_url ? setViewingPdf(doc) : navigate(`/documents/${doc.id}`)}
                >
                  {/* Checkbox (top-right, visible on hover or when selected) */}
                  <div
                    className={cn("absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity", selectedIds.has(doc.id) && "opacity-100")}
                    onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}
                  >
                    <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center", selectedIds.has(doc.id) ? "bg-primary border-primary" : "bg-background/90 border-muted-foreground/50")}>
                      {selectedIds.has(doc.id) && <span className="text-primary-foreground text-[10px] font-bold leading-none">✓</span>}
                    </div>
                  </div>

                  {/* Star button */}
                  <button
                    className={cn("absolute top-2 left-2 z-10 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity", doc.is_starred && "opacity-100")}
                    onClick={e => { e.stopPropagation(); handleToggleStar(doc); }}
                    title={doc.is_starred ? "הסר מועדפים" : "הוסף למועדפים"}
                  >
                    <Star className={cn("h-4 w-4", doc.is_starred ? "text-yellow-500 fill-yellow-400" : "text-muted-foreground")} />
                  </button>

                  {/* Thumbnail */}
                  <div className="flex items-center justify-center h-20 bg-muted/30 border-b relative">
                    {getFileIcon(doc)}
                    {doc.file_url && <Paperclip className="absolute bottom-1.5 right-1.5 h-3 w-3 text-muted-foreground" />}
                    {/* Actions menu */}
                    <div className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-full bg-background/80 hover:bg-background shadow-sm">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" dir="rtl" className="w-48">
                          {isPdf(doc) && doc.file_url && (
                            <DropdownMenuItem onClick={() => setViewingPdf(doc)}>
                              <Eye className="h-4 w-4 ml-2" />צפה ב-PDF
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => navigate(`/documents/${doc.id}`)}>
                            <Eye className="h-4 w-4 ml-2" />פרטי מסמך
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openRename(doc)}>
                            <Pencil className="h-4 w-4 ml-2" />שנה שם
                          </DropdownMenuItem>
                          {doc.file_url && (
                            <DropdownMenuItem asChild>
                              <a href={doc.file_url} download={docName}>
                                <Download className="h-4 w-4 ml-2" />הורד
                              </a>
                            </DropdownMenuItem>
                          )}
                          {isPdf(doc) && onAnnotate && (
                            <DropdownMenuItem onClick={() => onAnnotate(doc)}>
                              <Pencil className="h-4 w-4 ml-2" />ערוך / חתום
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger><FolderSymlink className="h-4 w-4 ml-2" />העבר לתיקייה</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent dir="rtl">
                              <DropdownMenuItem onClick={() => handleMoveToFolder(doc.id, null)}>— ללא תיקייה —</DropdownMenuItem>
                              {folders.map(f => (
                                <DropdownMenuItem key={f.id} onClick={() => handleMoveToFolder(doc.id, f.id)}>{f.name}</DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          {docStatusFlow.map(s => (
                            <DropdownMenuItem key={s} disabled={doc.status === s} onClick={() => handleStatusChange(doc.id, s)} className="text-xs">
                              <RefreshCw className="h-3 w-3 ml-2" />{s}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          {hasEdit && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={e => e.preventDefault()}>
                                  <Trash2 className="h-4 w-4 ml-2" />מחק
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogTitle>מחיקת מסמך</AlertDialogTitle>
                                <AlertDialogDescription>האם למחוק את "{docName}"?</AlertDialogDescription>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(doc.id)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-foreground truncate leading-tight">{docName}</p>
                    {doc.document_number && (
                      <p className="text-[10px] text-primary/80 font-mono mt-0.5">{doc.document_number}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{supplierName(doc.supplier_id)}</p>
                    <div className="flex items-center justify-between mt-1.5 gap-1 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                        {STATUS_ICONS[doc.status]}{doc.status}
                      </span>
                      <ExpiryBadge expiryDate={doc.expiry_date} />
                      <span className="text-[10px] text-muted-foreground">{format(new Date(doc.created_at), "dd/MM/yy")}</span>
                    </div>
                  </div>
                </div>
              </EntityContextMenu>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && visibleDocs.length > 0 && (
        <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-8 p-3">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedIds.size === visibleDocs.length && visibleDocs.length > 0}
                    onChange={e => e.target.checked ? selectAll(visibleDocs.map(d => d.id)) : clearSelection()}
                  />
                </th>
                <th className="w-8 p-3" />
                <th className="text-right p-3 font-semibold">שם</th>
                <th className="text-right p-3 font-semibold">ספק</th>
                <th className="text-right p-3 font-semibold">מחיר</th>
                <th className="text-right p-3 font-semibold">סטטוס</th>
                <th className="text-right p-3 font-semibold">תאריך</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleDocs.map(doc => {
                const docName = doc.document_name || doc.notes || "ללא שם";
                return (
                  <EntityContextMenu key={doc.id} groups={buildDocMenuGroups(doc)}>
                    <tr
                      className={cn("hover:bg-muted/30 cursor-pointer transition-colors", selectedIds.has(doc.id) && "bg-primary/5")}
                      onClick={() => isPdf(doc) && doc.file_url ? setViewingPdf(doc) : navigate(`/documents/${doc.id}`)}
                    >
                      {/* Checkbox */}
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div
                          className={cn("w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer", selectedIds.has(doc.id) ? "bg-primary border-primary" : "border-muted-foreground/50")}
                          onClick={() => toggleSelect(doc.id)}
                        >
                          {selectedIds.has(doc.id) && <span className="text-primary-foreground text-[10px] font-bold leading-none">✓</span>}
                        </div>
                      </td>
                      {/* Star */}
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleToggleStar(doc)}>
                          <Star className={cn("h-4 w-4", doc.is_starred ? "text-yellow-500 fill-yellow-400" : "text-muted-foreground/30 hover:text-yellow-400")} />
                        </button>
                      </td>
                      {/* Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc, "h-5 w-5")}
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{docName}</p>
                            {doc.document_number && (
                              <p className="text-[10px] text-primary/80 font-mono">{doc.document_number}</p>
                            )}
                            {doc.file_url && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Paperclip className="h-2.5 w-2.5" />קובץ</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{supplierName(doc.supplier_id)}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">
                        {doc.total_price ? `${currencySymbol[doc.currency] || ""}${doc.total_price.toLocaleString()}` : "—"}
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer", docStatusColors[doc.status] || "bg-muted text-muted-foreground")}>
                              {STATUS_ICONS[doc.status]}{doc.status}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1" align="start">
                            <div className="flex flex-col gap-0.5">
                              {docStatusFlow.map(s => (
                                <button key={s} onClick={() => handleStatusChange(doc.id, s)} className={cn("px-3 py-1.5 rounded text-xs font-medium text-right hover:bg-muted", doc.status === s && "bg-muted")}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        <div className="flex flex-col gap-1">
                          <span>{format(new Date(doc.created_at), "dd/MM/yy")}</span>
                          <ExpiryBadge expiryDate={doc.expiry_date} />
                        </div>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {isPdf(doc) && doc.file_url && (
                            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setViewingPdf(doc); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {doc.file_url && (
                            <a href={doc.file_url} download={docName} onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                            </a>
                          )}
                          {isPdf(doc) && onAnnotate && (
                            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); onAnnotate(doc); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {hasEdit && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={deletingId === doc.id}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogTitle>מחיקת מסמך</AlertDialogTitle>
                                <AlertDialogDescription>האם למחוק את "{docName}"?</AlertDialogDescription>
                                <div className="flex gap-2 justify-end">
                                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(doc.id)} className="bg-destructive text-destructive-foreground">מחק</AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  </EntityContextMenu>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rename document dialog */}
      <Dialog open={renameDocOpen} onOpenChange={setRenameDocOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>שינוי שם מסמך</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRenameDoc()}
              placeholder="שם המסמך..."
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRenameDocOpen(false)}>ביטול</Button>
              <Button onClick={handleRenameDoc} disabled={!renameValue.trim()}>שמור</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CreateFolderDialog (accessible from breadcrumb area too) */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onSaved={fetchFolders}
        editFolder={editingFolder}
      />

      {/* PDF Viewer */}
      {viewingPdf && (
        <DocumentPdfViewerDialog
          open={!!viewingPdf}
          onOpenChange={v => { if (!v) setViewingPdf(null); }}
          doc={viewingPdf}
          onAnnotate={onAnnotate}
        />
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedIds}
        docs={visibleDocs}
        folders={folders}
        onClearSelection={clearSelection}
        onRefresh={onRefresh}
        suppliers={suppliers}
      />
    </div>
  );
}
