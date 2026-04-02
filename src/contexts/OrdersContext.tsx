import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { logActivity } from "@/lib/activityLogger";
import type { Order, OrderItem, OrderStatus } from "@/contexts/types";

interface OrdersState {
  orders: Order[];
  refreshOrders: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  addOrder: (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => Promise<void>;
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
  const [orders, setOrders] = useState<Order[]>([]);

  const refreshOrders = useCallback(async () => {
    const { data: ords } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(500);
    if (ords) {
      setOrders(ords.map(o => {
        const items = o.order_items || [];
        const calculatedTotal = items.reduce((sum: number, item: Record<string, number | null>) => {
          const itemTotal = (item.price || 0) * (item.qty || 0);
          return sum + itemTotal;
        }, 0);
        return { ...o, items, total_price: calculatedTotal };
      }) as unknown as Order[]);
    }
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const prevOrders = orders;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) {
      setOrders(prevOrders);
      handleError(error, "שגיאה בעדכון סטטוס הזמנה: " + (error.message || "נסה שוב"));
    }
  }, [orders]);

  const addOrder = useCallback(async (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => {
    try {
      const { items, ...orderData } = order;
      const { data: newOrder, error: orderError } = await supabase.from("orders").insert(orderData).select("id").single();
      if (orderError) {
        handleError(orderError, "שגיאה ביצירת הזמנה: " + (orderError.message || "נסה שוב"));
        return;
      }
      if (newOrder) {
        const orderItems = items.map(item => ({ ...item, order_id: newOrder.id }));
        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
        if (itemsError) {
          handleError(itemsError, "שגיאה בהוספת פריטים: " + (itemsError.message || "נסה שוב"));
          return;
        }
        // Auto-start procurement workflow — use different template for Israeli suppliers
        let workflowCategory = "procurement";
        if (order.supplier_id) {
          const { data: supplierData } = await supabase
            .from("suppliers")
            .select("country")
            .eq("id", order.supplier_id)
            .maybeSingle();
          if (supplierData?.country === "ישראל") {
            workflowCategory = "procurement_israel";
          }
        }
        const { data: tpl } = await supabase.from("workflow_templates").select("id").eq("category", workflowCategory).limit(1).maybeSingle();
        if (tpl) {
          await supabase.from("workflow_instances").insert({ template_id: tpl.id, order_id: newOrder.id });
        }
        await refreshOrders();
        toast.success("הזמנה נוצרה בהצלחה");
        logActivity({ action: "order.create", entityType: "order", entityId: newOrder.id });
      }
    } catch (err) {
      handleError(err, "שגיאה בלתי צפויה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshOrders]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    try {
      const { items, ...dbUpdates } = updates as any;
      const { error } = await supabase.from("orders").update(dbUpdates).eq("id", id);
      if (error) {
        handleError(error, "שגיאה בעדכון הזמנה: " + (error.message || "נסה שוב"));
        return;
      }
      await refreshOrders();
      toast.success("הזמנה עודכנה בהצלחה");
      logActivity({ action: "order.update", entityType: "order", entityId: id });
    } catch (err) {
      handleError(err, "שגיאה בלתי צפויה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    try {
      // Delete workflow step logs first (referenced by workflow_instances)
      const { data: instances } = await supabase.from("workflow_instances").select("id").eq("order_id", id);
      if (instances && instances.length > 0) {
        const instanceIds = instances.map((i: any) => i.id);
        await supabase.from("workflow_step_logs").delete().in("instance_id", instanceIds);
        await supabase.from("workflow_instances").delete().eq("order_id", id);
      }
      const { error: itemsError } = await supabase.from("order_items").delete().eq("order_id", id);
      if (itemsError) throw itemsError;
      const { error: orderError } = await supabase.from("orders").delete().eq("id", id);
      if (orderError) throw orderError;
      await refreshOrders();
      toast.success("הזמנה נמחקה בהצלחה");
      logActivity({ action: "order.delete", entityType: "order", entityId: id });
    } catch (err) {
      handleError(err, "שגיאה במחיקת הזמנה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshOrders]);

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
