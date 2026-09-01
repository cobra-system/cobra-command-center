import React, { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { logActivity } from "@/lib/activityLogger";
import type { Supplier, SupplierContact } from "@/contexts/types";

interface SuppliersState {
  suppliers: Supplier[];
  refreshSuppliers: () => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, "id">) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
}

const SuppliersContext = createContext<SuppliersState | null>(null);

export function useSuppliers() {
  const ctx = useContext(SuppliersContext);
  if (!ctx) throw new Error("useSuppliers must be within SuppliersProvider");
  return ctx;
}

export function SuppliersProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("*, supplier_contacts(*)").order("company");
      if (!data) return [];
      return data.map((s: Record<string, unknown>) => ({
        ...s,
        contacts: (((s as Record<string, unknown>).supplier_contacts || []) as SupplierContact[]).sort((a, b) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
        ),
      })) as Supplier[];
    },
  });

  const refreshSuppliers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }, [queryClient]);

  const addSupplier = useCallback(async (supplier: Omit<Supplier, "id">) => {
    try {
      const { error } = await supabase.from("suppliers").insert(supplier);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["suppliers"] });
      toast.success("ספק נוסף בהצלחה");
      logActivity({ action: "supplier.create", entityType: "supplier" });
    } catch (err) {
      handleError(err, "שגיאה בהוספת ספק");
      throw err;
    }
  }, [queryClient]);

  const updateSupplier = useCallback(async (id: string, updates: Partial<Supplier>) => {
    try {
      const { error } = await supabase.from("suppliers").update(updates as Record<string, unknown>).eq("id", id);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["suppliers"] });
      toast.success("ספק עודכן בהצלחה");
      logActivity({ action: "supplier.update", entityType: "supplier", entityId: id });
    } catch (err) {
      handleError(err, "שגיאה בעדכון ספק");
      throw err;
    }
  }, [queryClient]);

  const deleteSupplier = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["suppliers"] });
      toast.success("ספק נמחק בהצלחה");
      logActivity({ action: "supplier.delete", entityType: "supplier", entityId: id });
    } catch (err) {
      handleError(err, "שגיאה במחיקת ספק");
    }
  }, [queryClient]);

  return (
    <SuppliersContext.Provider value={{ suppliers, refreshSuppliers, addSupplier, updateSupplier, deleteSupplier }}>
      {children}
    </SuppliersContext.Provider>
  );
}
