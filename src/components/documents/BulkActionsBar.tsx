/**
 * BulkActionsBar
 * Fixed bottom bar that appears when one or more documents are selected.
 * Supports: status change, move-to-folder, star/unstar, export to Excel, delete.
 */
import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { PurchaseDocument, DocumentFolder } from "./types";
import { docStatusFlow, currencySymbol } from "./constants";
import {
  CheckSquare, RefreshCw, FolderSymlink, Star, FileDown,
  Trash2, X, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";

interface Props {
  selectedIds: Set<string>;
  docs: PurchaseDocument[];
  folders: DocumentFolder[];
  onClearSelection: () => void;
  onRefresh: () => void;
  suppliers: { id: string; company: string }[];
}

export default function BulkActionsBar({ selectedIds, docs, folders, onClearSelection, onRefresh, suppliers }: Props) {
  const [working, setWorking] = useState(false);
  const count = selectedIds.size;
  if (count === 0) return null;

  const selectedDocs = docs.filter(d => selectedIds.has(d.id));
  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company || "—";

  // ── helpers ─────────────────────────────────────────────────────────────────
  async function bulkUpdate(updates: Record<string, unknown>) {
    setWorking(true);
    const ids = [...selectedIds];
    const { error } = await supabase
      .from("purchase_documents")
      .update(updates)
      .in("id", ids);
    if (error) { toast.error("שגיאה בעדכון"); }
    else { toast.success(`${count} מסמכים עודכנו`); onClearSelection(); onRefresh(); }
    setWorking(false);
  }

  async function bulkDelete() {
    setWorking(true);
    const ids = [...selectedIds];
    const { error } = await supabase.from("purchase_documents").delete().in("id", ids);
    if (error) { toast.error("שגיאה במחיקה"); }
    else { toast.success(`${count} מסמכים נמחקו`); onClearSelection(); onRefresh(); }
    setWorking(false);
  }

  function exportExcel() {
    const rows = selectedDocs.map(d => ({
      "שם מסמך":      d.document_name || d.notes || "ללא שם",
      "מספר מסמך":    d.document_number || "",
      "סוג":          d.type,
      "ספק":          supplierName(d.supplier_id),
      "כמות":         d.quantity,
      "מחיר כולל":    d.total_price ?? "",
      "מטבע":         d.currency,
      "סטטוס":        d.status,
      "תאריך יצירה":  format(new Date(d.created_at), "dd/MM/yyyy"),
      "תאריך תפוגה":  d.expiry_date ? format(new Date(d.expiry_date), "dd/MM/yyyy") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "מסמכים");
    XLSX.writeFile(wb, `documents_export_${Date.now()}.xlsx`);
    toast.success("Excel יוצא בהצלחה");
  }

  const allStarred = selectedDocs.every(d => d.is_starred);

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl border",
        "bg-background/95 backdrop-blur-sm",
        "animate-in slide-in-from-bottom-4 duration-200"
      )}
      dir="rtl"
    >
      {/* Count badge */}
      <div className="flex items-center gap-1.5 text-sm font-medium pl-2 border-l">
        <CheckSquare className="h-4 w-4 text-primary" />
        <span>{count} נבחרו</span>
      </div>

      {/* Status change */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled={working}>
            <RefreshCw className="h-3.5 w-3.5" />סטטוס
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" dir="rtl">
          {docStatusFlow.map(s => (
            <DropdownMenuItem key={s} onClick={() => bulkUpdate({ status: s })}>{s}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Move to folder */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled={working}>
            <FolderSymlink className="h-3.5 w-3.5" />תיקייה
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" dir="rtl">
          <DropdownMenuItem onClick={() => bulkUpdate({ folder_id: null })}>— ללא תיקייה —</DropdownMenuItem>
          {folders.length > 0 && <DropdownMenuSeparator />}
          {folders.map(f => (
            <DropdownMenuItem key={f.id} onClick={() => bulkUpdate({ folder_id: f.id })}>{f.name}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Star / Unstar */}
      <Button
        variant="outline" size="sm"
        className={cn("gap-1.5 h-8", allStarred && "border-yellow-400 text-yellow-600")}
        disabled={working}
        onClick={() => bulkUpdate({ is_starred: !allStarred })}
      >
        <Star className={cn("h-3.5 w-3.5", allStarred && "fill-yellow-400 text-yellow-500")} />
        {allStarred ? "הסר מועדף" : "מועדף"}
      </Button>

      {/* Export Excel */}
      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={exportExcel} disabled={working}>
        <FileDown className="h-3.5 w-3.5" />Excel
      </Button>

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-destructive border-destructive/40 hover:bg-destructive/10" disabled={working}>
            <Trash2 className="h-3.5 w-3.5" />מחק
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent dir="rtl">
          <AlertDialogTitle>מחיקת {count} מסמכים</AlertDialogTitle>
          <AlertDialogDescription>
            האם למחוק את כל {count} המסמכים שנבחרו? פעולה זו לא ניתנת לביטול.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground">
              מחק {count} מסמכים
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Divider + clear */}
      <div className="w-px h-5 bg-border mx-1" />
      <Button variant="ghost" size="sm" className="gap-1 h-8 text-muted-foreground" onClick={onClearSelection}>
        <X className="h-3.5 w-3.5" />ביטול בחירה
      </Button>
    </div>
  );
}
