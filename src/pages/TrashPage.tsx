import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  RotateCcw,
  Search,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeletedItem {
  table_name: string;
  item_id: string;
  label: string;
  sub_label: string;
  deleted_at: string;
  expires_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  orders: "הזמנות",
  products: "מוצרים",
  suppliers: "ספקים",
  tasks: "משימות",
  purchase_documents: "מסמכים",
  compliance_items: "תאימות",
  meetings: "פגישות",
  goals: "יעדים",
  waste_items: "בלאי",
  installers: "מתקינים",
  equipment_pickups: "איסוף ציוד",
  equipment_returns: "החזרת ציוד",
  product_issues: "תקלות",
  supplier_payments: "תשלומים לספקים",
  order_payments: "תשלומי הזמנה",
  shipment_groups: "קבוצות משלוח",
  distribution_centers: "מרכזי הפצה",
  order_requests: "בקשות הזמנה",
  warehouse_zones: "אזורי מחסן",
};

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TrashPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterTable, setFilterTable] = useState<string | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<DeletedItem | null>(null);

  const { data: items = [], isLoading } = useQuery<DeletedItem[]>({
    queryKey: ["trash"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_deleted_items");
      if (error) throw error;
      return data as DeletedItem[];
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (item: DeletedItem) => {
      const { error } = await supabase.rpc("restore_item", {
        p_table: item.table_name,
        p_id: item.item_id,
      });
      if (error) throw error;
    },
    onSuccess: (_, item) => {
      toast.success(`"${item.label}" שוחזר בהצלחה`);
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
    onError: () => toast.error("שגיאה בשחזור הפריט"),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (item: DeletedItem) => {
      const { error } = await supabase.rpc("hard_delete_item", {
        p_table: item.table_name,
        p_id: item.item_id,
      });
      if (error) throw error;
    },
    onSuccess: (_, item) => {
      toast.success(`"${item.label}" נמחק לצמיתות`);
      setHardDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
    onError: () => toast.error("שגיאה במחיקת הפריט"),
  });

  const tableNames = [...new Set(items.map((i) => i.table_name))].sort(
    (a, b) => (TABLE_LABELS[a] ?? a).localeCompare(TABLE_LABELS[b] ?? b, "he")
  );

  const filtered = items.filter((item) => {
    if (filterTable && item.table_name !== filterTable) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.label.toLowerCase().includes(q) ||
        item.sub_label.toLowerCase().includes(q) ||
        (TABLE_LABELS[item.table_name] ?? item.table_name).includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trash2 className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">סל מחזור</h1>
          <p className="text-sm text-muted-foreground">
            פריטים שנמחקו נשמרים למשך 30 יום לפני מחיקה קבועה
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="pr-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterTable(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterTable === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            הכל ({items.length})
          </button>
          {tableNames.map((t) => {
            const count = items.filter((i) => i.table_name === t).length;
            return (
              <button
                key={t}
                onClick={() => setFilterTable(filterTable === t ? null : t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterTable === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                {TABLE_LABELS[t] ?? t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>טוען...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Trash2 className="h-12 w-12 opacity-20" />
          <p className="text-lg">{items.length === 0 ? "הסל ריק" : "אין תוצאות לחיפוש"}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">שם</th>
                <th className="text-right p-3 font-semibold text-foreground hidden sm:table-cell">סוג</th>
                <th className="text-right p-3 font-semibold text-foreground hidden md:table-cell">נמחק ב-</th>
                <th className="text-right p-3 font-semibold text-foreground">תפוגה</th>
                <th className="p-3 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const days = daysUntil(item.expires_at);
                const urgent = days <= 3;
                return (
                  <tr
                    key={`${item.table_name}-${item.item_id}`}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-medium leading-tight">{item.label}</div>
                      {item.sub_label && (
                        <div className="text-xs text-muted-foreground mt-0.5">{item.sub_label}</div>
                      )}
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <Badge variant="secondary" className="font-normal">
                        {TABLE_LABELS[item.table_name] ?? item.table_name}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {formatDate(item.deleted_at)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-medium ${
                          urgent ? "text-destructive" : days <= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`}
                      >
                        {days === 0 ? "היום" : `${days} יום`}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreMutation.mutate(item)}
                          disabled={restoreMutation.isPending}
                          className="h-7 px-2 gap-1"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline text-xs">שחזור</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setHardDeleteTarget(item)}
                          disabled={hardDeleteMutation.isPending}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hard-delete confirmation */}
      <AlertDialog open={!!hardDeleteTarget} onOpenChange={(o) => !o && setHardDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              מחיקה קבועה
            </AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק לצמיתות את <strong>"{hardDeleteTarget?.label}"</strong>?
              פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => hardDeleteTarget && hardDeleteMutation.mutate(hardDeleteTarget)}
            >
              {hardDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "מחק לצמיתות"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
