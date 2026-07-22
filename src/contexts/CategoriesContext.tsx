import React, { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { logger } from "@/lib/logger";

export interface ProductCategory {
  id: string;
  name: string;
  is_default: boolean;
  sort_order: number;
}

interface CategoriesState {
  categories: ProductCategory[];
  addCategory: (name: string) => Promise<void>;
  renameCategory: (id: string, newName: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesState | null>(null);

export function useProductCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useProductCategories must be within CategoriesProvider");
  return ctx;
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name, is_default, sort_order")
        .order("sort_order")
        .order("name");
      if (error) {
        if (error.code === "42P01") {
          logger.warn("product_categories table missing — run migration");
          return [];
        }
        throw error;
      }
      return (data as ProductCategory[]) ?? [];
    },
  });

  const invalidate = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: ["product_categories"] }),
    [queryClient]
  );

  const addCategory = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("product_categories")
      .insert({ name: trimmed, is_default: false });
    if (error) {
      if (error.code === "23505") {
        toast.error("קטגוריה בשם זה כבר קיימת");
      } else {
        handleError(error, "שגיאה בהוספת קטגוריה");
      }
      return;
    }
    await invalidate();
    toast.success(`קטגוריה "${trimmed}" נוספה`);
  }, [invalidate]);

  const renameCategory = useCallback(async (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("product_categories")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) {
      if (error.code === "23505") {
        toast.error("קטגוריה בשם זה כבר קיימת");
      } else {
        handleError(error, "שגיאה בעדכון קטגוריה");
      }
      return;
    }
    await invalidate();
    toast.success("קטגוריה עודכנה");
  }, [invalidate]);

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", id);
    if (error) {
      handleError(error, "שגיאה במחיקת קטגוריה");
      return;
    }
    await invalidate();
    toast.success("קטגוריה נמחקה");
  }, [invalidate]);

  return (
    <CategoriesContext.Provider value={{ categories, addCategory, renameCategory, deleteCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
}
