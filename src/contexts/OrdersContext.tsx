import React, { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { logActivity } from "@/lib/activityLogger";
import type { Order, OrderItem, OrderStatus } from "@/contexts/types";
import { useAuth } from "@/contexts/AuthContext";

interface OrdersState {
  orders: Order[];
  refreshOrders: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  addOrder: (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => Promise<string | undefined>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
}

const OrdersContext = createContext<OrdersState | null>(null);

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be within OrdersProvider");
  return ctx;
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const { data: rawOrders = [] } = useQuery({
    queryKey: ["orders"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data: ords } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(500);
      if (ords) {
        return ords.map(o => {
          const items = o.order_items || [];
          const calculatedTotal = items.reduce((sum: number, item: Record<string, number | null>) => {
            const itemTotal = (item.price || 0) * (item.qty || 0);
            return sum + itemTotal;
          }, 0);
          return { ...o, items, total_price: calculatedTotal };
        }) as unknown as Order[];
      }
      return [] as Order[];
    },
  });

  // Client-side division filtering (backup to RLS).
  // orders.division is a comma-separated aggregate of every division covered by
  // the order's items (see derive_order_division). Exact equality would drop
  // multi-division rows like "AWACS, פריזבי קרסו" for a user whose division is
  // just "פריזבי קרסו" — so we split and check membership instead.
  const orders = useMemo(() => {
    if (!currentUser || currentUser.role === "MANAGER" || !currentUser.division) {
      return rawOrders;
    }
    return rawOrders.filter(order =>
      order.division?.split(",").map(d => d.trim()).includes(currentUser.division)
    );
  }, [rawOrders, currentUser]);

  const refreshOrders = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  }, [queryClient]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const prevOrders = queryClient.getQueryData<Order[]>(["orders"]) ?? [];
    queryClient.setQueryData(["orders"], (prev: Order[] | undefined) =>
      (prev ?? []).map(o => o.id === orderId ? { ...o, status } : o)
    );
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) {
      queryClient.setQueryData(["orders"], prevOrders);
      handleError(error, "שגיאה בעדכון סטטוס הזמנה: " + (error.message || "נסה שוב"));
    }
  }, [queryClient]);

  const addOrder = useCallback(async (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }): Promise<string | undefined> => {
    try {
      const { items, ...orderData } = order;
      const { data: newOrder, error: orderError } = await supabase.from("orders").insert(orderData).select("id").single();
      if (orderError) {
        handleError(orderError, "שגיאה ביצירת הזמנה: " + (orderError.message || "נסה שוב"));
        return undefined;
      }
      if (newOrder) {
        const orderItems = items.map(item => ({ ...item, order_id: newOrder.id }));
        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
        if (itemsError) {
          handleError(itemsError, "שגיאה בהוספת פריטים: " + (itemsError.message || "נסה שוב"));
          return undefined;
        }
        await queryClient.refetchQueries({ queryKey: ["orders"] });
        toast.success("הזמנה נוצרה בהצלחה");
        logActivity({ action: "order.create", entityType: "order", entityId: newOrder.id });
        return newOrder.id;
      }
    } catch (err) {
      handleError(err, "שגיאה בלתי צפויה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
    return undefined;
  }, [queryClient]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    try {
      const { items, ...dbUpdates } = updates as Partial<Order> & Record<string, unknown>;
      const { error } = await supabase.from("orders").update(dbUpdates).eq("id", id);
      if (error) {
        handleError(error, "שגיאה בעדכון הזמנה: " + (error.message || "נסה שוב"));
        return;
      }
      await queryClient.refetchQueries({ queryKey: ["orders"] });
      toast.success("הזמנה עודכנה בהצלחה");
      logActivity({ action: "order.update", entityType: "order", entityId: id });
    } catch (err) {
      handleError(err, "שגיאה בלתי צפויה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const deleteOrder = useCallback(async (id: string) => {
    try {
      const { error: itemsError } = await supabase.from("order_items").delete().eq("order_id", id);
      if (itemsError) throw itemsError;
      const { error: orderError } = await supabase.from("orders").delete().eq("id", id);
      if (orderError) throw orderError;
      await queryClient.refetchQueries({ queryKey: ["orders"] });
      toast.success("הזמנה נמחקה בהצלחה");
      logActivity({ action: "order.delete", entityType: "order", entityId: id });
    } catch (err) {
      handleError(err, "שגיאה במחיקת הזמנה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  return (
    <OrdersContext.Provider value={{
      orders,
      refreshOrders,
      updateOrderStatus,
      addOrder,
      updateOrder,
      deleteOrder,
    }}>
      {children}
    </OrdersContext.Provider>
  );
}
