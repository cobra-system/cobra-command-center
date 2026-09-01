import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ExternalLink, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { WasteSupplierReturn } from "@/contexts/types";
import { WasteReturnStatusBadge } from "./WasteStatusBadge";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  supplierId: string;
}

// ─── Settlement label ─────────────────────────────────────────────────────────

function SettlementLabel({ type }: { type?: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  if (type === "rma") {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-purple-100 text-purple-800 border-purple-200">
        RMA
      </span>
    );
  }
  if (type === "credit") {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-green-100 text-green-800 border-green-200">
        זיכוי
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{type}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const MAX_ROWS = 5;

export function SupplierReturnsSection({ supplierId }: Props) {
  const navigate = useNavigate();

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["waste-supplier-returns", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_supplier_returns")
        .select("*")
        .eq("supplier_id", supplierId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WasteSupplierReturn[];
    },
  });

  const visible = returns.slice(0, MAX_ROWS);
  const hasMore = returns.length > MAX_ROWS;

  return (
    <div className="bg-card rounded-xl border shadow-sm" dir="rtl">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm text-foreground">החזרות בלאי</h3>
          {!isLoading && (
            <span className={cn(
              "inline-flex items-center justify-center rounded-full text-[10px] font-semibold min-w-[20px] h-5 px-1.5",
              returns.length > 0
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}>
              {returns.length}
            </span>
          )}
        </div>

        <button
          onClick={() => navigate(`/waste-management?tab=returns&supplier=${supplierId}`)}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
        >
          צפה בהכל
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : returns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
          <Truck className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">אין החזרות בלאי לספק זה</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[380px]">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-right px-4 py-2 font-semibold text-foreground">מצב</th>
                  <th className="text-right px-4 py-2 font-semibold text-foreground">מספר מעקב</th>
                  <th className="text-right px-4 py-2 font-semibold text-foreground">תאריך</th>
                  <th className="text-right px-4 py-2 font-semibold text-foreground">סגירה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(ret => (
                  <tr
                    key={ret.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/waste-management/returns/${ret.id}`)}
                  >
                    <td className="px-4 py-2.5">
                      <WasteReturnStatusBadge status={ret.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono">
                      {ret.tracking_number ?? <span className="not-italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                      {format(new Date(ret.created_at), "dd/MM/yyyy")}
                    </td>
                    <td className="px-4 py-2.5">
                      <SettlementLabel type={ret.settlement_type} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="px-4 py-2.5 border-t">
              <button
                onClick={() => navigate(`/waste-management?tab=returns&supplier=${supplierId}`)}
                className="text-xs text-primary hover:underline transition-colors"
              >
                + עוד {returns.length - MAX_ROWS} החזרות
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
