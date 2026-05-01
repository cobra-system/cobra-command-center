import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import type { Order, OrderStatus } from "@/contexts/types";

const STALE_HOURS = 24;
const SESSION_FLAG = "tracking:syncedAt";
const CHUNK_SIZE = 25;

const INACTIVE_STATUSES: OrderStatus[] = ["DELIVERED", "ARRIVED", "CANCELLED"];

interface SyncState {
  syncing: boolean;
  done: number;
  total: number;
}

export function useBackgroundTrackingSync(orders: Order[]): SyncState {
  const [state, setState] = useState<SyncState>({ syncing: false, done: 0, total: 0 });
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!orders || orders.length === 0) return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;

    const now = Date.now();
    const staleMs = STALE_HOURS * 3600 * 1000;
    const stale = orders.filter(o => {
      if (!o.tracking_number) return false;
      // tracking_carrier is the explicit signal; fall back to "has tracking_number means DHL".
      const isDhl = o.tracking_carrier ? o.tracking_carrier === "dhl" : !!o.tracking_number;
      if (!isDhl) return false;
      if (INACTIVE_STATUSES.includes(o.status as OrderStatus)) return false;
      const last = o.tracking_last_synced_at ? new Date(o.tracking_last_synced_at).getTime() : 0;
      return now - last > staleMs;
    });

    if (stale.length === 0) {
      sessionStorage.setItem(SESSION_FLAG, String(now));
      return;
    }

    startedRef.current = true;
    sessionStorage.setItem(SESSION_FLAG, String(now));
    setState({ syncing: true, done: 0, total: stale.length });

    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        let done = 0;
        for (let i = 0; i < stale.length; i += CHUNK_SIZE) {
          const chunk = stale.slice(i, i + CHUNK_SIZE);
          try {
            await fetch(`${baseUrl}/functions/v1/track-shipments-bulk`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({ order_ids: chunk.map(o => o.id) }),
            });
          } catch {
            // continue on chunk failure — individual order errors are persisted server-side.
          }
          done += chunk.length;
          setState({ syncing: true, done, total: stale.length });
        }
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
      } finally {
        setState(prev => ({ ...prev, syncing: false }));
      }
    };

    void run();
  }, [orders, queryClient]);

  return state;
}
