/**
 * What the shipments behind one order cost to move.
 *
 * Sums the shipping charges across every import dossier linked to the order,
 * so the figure can sit in the order header rather than only inside the import
 * section further down the page. It is the number a person opens an order to
 * find: "what did it cost me to get this here".
 *
 * Deliberately a separate small query rather than state lifted out of
 * ImportFilesSection — the header renders above that section and must not wait
 * on it, and one narrow read is easier to reason about than a callback that
 * fires on every refetch.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  sumImportCosts,
  shipmentModeLabels,
  type ImportCostLine,
  type ShipmentMode,
} from "@/lib/importFiles";

export interface OrderShippingCost {
  /** Transport charges only — freight, terminal, inland and the rest. */
  shipping: number;
  /** Shipping plus duty, brokerage and fees. Excludes recoverable VAT. */
  landed: number;
  /** Modes that actually carried something, e.g. ["ימי"] or ["ימי", "אווירי"]. */
  modes: string[];
  loading: boolean;
}

const EMPTY: OrderShippingCost = { shipping: 0, landed: 0, modes: [], loading: false };

export function useOrderShippingCost(orderId: string | undefined): OrderShippingCost {
  const [result, setResult] = useState<OrderShippingCost>({ ...EMPTY, loading: true });

  useEffect(() => {
    if (!orderId) { setResult(EMPTY); return; }

    let cancelled = false;

    const run = async () => {
      const { data: links } = await supabase
        .from("import_file_orders")
        .select("import_file_id")
        .eq("order_id", orderId);

      const fileIds = (links ?? []).map(l => l.import_file_id);
      if (fileIds.length === 0) {
        if (!cancelled) setResult(EMPTY);
        return;
      }

      const [filesRes, linesRes] = await Promise.all([
        supabase.from("import_files").select("id, shipment_mode").in("id", fileIds).is("deleted_at", null),
        supabase.from("import_cost_lines").select("*").in("import_file_id", fileIds),
      ]);

      if (cancelled) return;

      const files = filesRes.data ?? [];
      const lines = (linesRes.data ?? []) as ImportCostLine[];

      let shipping = 0;
      let landed = 0;
      const modes = new Set<string>();

      for (const file of files) {
        // Per dossier, so the shipping/customs split and the two exclusions
        // (recoverable VAT, lines nested in a summary invoice) are applied by
        // the same code the rest of the app uses.
        const totals = sumImportCosts(lines.filter(l => l.import_file_id === file.id));
        shipping += totals.shipping;
        landed += totals.landed;
        if (totals.shipping > 0) {
          modes.add(shipmentModeLabels[file.shipment_mode as ShipmentMode] ?? file.shipment_mode);
        }
      }

      setResult({ shipping, landed, modes: [...modes], loading: false });
    };

    void run();
    return () => { cancelled = true; };
  }, [orderId]);

  return result;
}
