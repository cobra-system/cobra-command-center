import React, { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { logActivity } from "@/lib/activityLogger";
import type { Product, ProductComponent } from "@/contexts/types";
import { useAuth } from "@/contexts/AuthContext";

interface ProductsState {
  products: Product[];
  refreshProducts: () => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  addProduct: (product: Omit<Product, "id" | "components">, components?: Omit<ProductComponent, "id" | "product_id">[]) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addComponent: (component: Omit<ProductComponent, "id">) => Promise<void>;
  updateComponent: (id: string, updates: Partial<ProductComponent>) => Promise<void>;
  deleteComponent: (id: string) => Promise<void>;
}

const ProductsContext = createContext<ProductsState | null>(null);

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be within ProductsProvider");
  return ctx;
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const { data: rawProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data: prods } = await supabase.from("products").select("*, product_components(*)").order("category").limit(500);
      if (!prods) return [];
      return prods.map(p => ({
        ...p,
        components: ((p as Record<string, unknown>).product_components || []) as ProductComponent[],
      })) as Product[];
    },
  });

  // Client-side division filtering (backup to RLS)
  const products = useMemo(() => {
    // If user is manager or has no division, return all products
    if (!currentUser || currentUser.role === "MANAGER" || !currentUser.division) {
      return rawProducts;
    }
    // Non-managers see only products where division includes their division
    return rawProducts.filter(p =>
      p.division?.split(",").map(d => d.trim()).includes(currentUser.division)
    );
  }, [rawProducts, currentUser]);

  const refreshProducts = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["products"] });
  }, [queryClient]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    try {
      const { components, supplier_id, ...dbUpdates } = updates as Partial<Product> & Record<string, unknown>;
      const { error } = await supabase.from("products").update(dbUpdates).eq("id", id);
      if (error) throw error;
      // Sync stock with main center inventory
      if (dbUpdates.stock_qty !== undefined) {
        const { data: mainCenter } = await supabase.from("distribution_centers").select("id").eq("is_main", true).maybeSingle();
        if (mainCenter) {
          await supabase.from("center_inventory").upsert(
            { center_id: mainCenter.id, product_id: id, quantity: dbUpdates.stock_qty } as Record<string, unknown>,
            { onConflict: "center_id,product_id" }
          );
        }
      }
      await queryClient.refetchQueries({ queryKey: ["products"] });
      toast.success("מוצר עודכן בהצלחה");
      logActivity({ action: "product.update", entityType: "product", entityId: id });
    } catch (err) {
      handleError(err, "שגיאה בעדכון מוצר: " + (err instanceof Error ? err.message : "נסה שוב"));
      throw err;
    }
  }, [queryClient]);

  const addProduct = useCallback(async (product: Omit<Product, "id" | "components">, components?: Omit<ProductComponent, "id" | "product_id">[]) => {
    try {
      const { supplier_id, ...productData } = product as Omit<Product, "id" | "components"> & Record<string, unknown>;
      const { data: newProd, error: prodError } = await supabase.from("products").insert(productData).select("id").single();
      if (prodError) throw prodError;
      if (newProd && components && components.length > 0) {
        const { error: compError } = await supabase.from("product_components").insert(components.map(c => ({ ...c, product_id: newProd.id })));
        if (compError) throw compError;
      }
      await queryClient.refetchQueries({ queryKey: ["products"] });
      toast.success("מוצר נוצר בהצלחה");
      if (newProd) logActivity({ action: "product.create", entityType: "product", entityId: newProd.id });
    } catch (err) {
      handleError(err, "שגיאה ביצירת מוצר: " + (err instanceof Error ? err.message : "נסה שוב"));
      throw err;
    }
  }, [queryClient]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const { error: compError } = await supabase.from("product_components").delete().eq("product_id", id);
      if (compError) throw compError;
      const { error: prodError } = await supabase.from("products").delete().eq("id", id);
      if (prodError) throw prodError;
      await queryClient.refetchQueries({ queryKey: ["products"] });
      toast.success("מוצר נמחק בהצלחה");
      logActivity({ action: "product.delete", entityType: "product", entityId: id });
    } catch (err) {
      handleError(err, "שגיאה במחיקת מוצר: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const addComponent = useCallback(async (component: Omit<ProductComponent, "id">) => {
    try {
      const { error } = await supabase.from("product_components").insert(component);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["products"] });
      toast.success("רכיב נוסף בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בהוספת רכיב: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const updateComponent = useCallback(async (id: string, updates: Partial<ProductComponent>) => {
    try {
      const { product_id, ...dbUpdates } = updates as Partial<ProductComponent> & Record<string, unknown>;
      const { error } = await supabase.from("product_components").update(dbUpdates).eq("id", id);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["products"] });
      toast.success("רכיב עודכן בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בעדכון רכיב: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const deleteComponent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("product_components").delete().eq("id", id);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["products"] });
      toast.success("רכיב נמחק בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה במחיקת רכיב: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  return (
    <ProductsContext.Provider value={{
      products,
      refreshProducts,
      updateProduct,
      addProduct,
      deleteProduct,
      addComponent,
      updateComponent,
      deleteComponent,
    }}>
      {children}
    </ProductsContext.Provider>
  );
}
