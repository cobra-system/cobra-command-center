import { X, Truck, Ship, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface OrderBulkActionsBarProps {
  selectedIds: Set<string>;
  onClear: () => void;
  onAfterUpdate: () => Promise<void>;
}

async function setCarrierForOrders(ids: string[], carrier: "dhl" | "tclog" | "other" | null): Promise<number> {
  const { error, count } = await supabase
    .from("orders")
    .update({ tracking_carrier: carrier }, { count: "exact" })
    .in("id", ids);
  if (error) {
    toast.error(`שגיאה בעדכון: ${error.message}`);
    return 0;
  }
  return count ?? ids.length;
}

export function OrderBulkActionsBar({ selectedIds, onClear, onAfterUpdate }: OrderBulkActionsBarProps) {
  if (selectedIds.size === 0) return null;
  const ids = Array.from(selectedIds);

  const apply = async (carrier: "dhl" | "tclog" | "other" | null, label: string) => {
    const updated = await setCarrierForOrders(ids, carrier);
    if (updated > 0) toast.success(`${updated} הזמנות עודכנו: ${label}`);
    onClear();
    await onAfterUpdate();
  };

  return (
    <div className="sticky bottom-4 z-30 mx-auto max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap rounded-2xl border bg-card shadow-lg px-4 py-3">
        <div className="flex items-center gap-2 me-auto">
          <Button variant="ghost" size="icon" onClick={onClear} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{selectedIds.size} הזמנות נבחרו</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => apply("dhl", "סומנו כ-DHL")}>
          <Truck className="h-4 w-4 ml-1" /> סמן כ-DHL
        </Button>
        <Button size="sm" variant="outline" onClick={() => apply("tclog", "סומנו כ-TCLOG")}>
          <Ship className="h-4 w-4 ml-1" /> סמן כ-TCLOG
        </Button>
        <Button size="sm" variant="outline" onClick={() => apply("other", "סומנו כאחר")}>
          סמן כאחר
        </Button>
        <Button size="sm" variant="ghost" onClick={() => apply(null, "ספק המעקב נוקה")}>
          <HelpCircle className="h-4 w-4 ml-1" /> נקה
        </Button>
      </div>
    </div>
  );
}
