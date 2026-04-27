import { useMemo } from "react";
import { useAuth, useData } from "@/contexts/AppContext";

export function useProductScope() {
  const { currentUser } = useAuth();
  const { products, orders, suppliers } = useData();

  const allowedIds = currentUser?.allowed_product_ids;
  const hasAllowedIds = Array.isArray(allowedIds) && allowedIds.length > 0;
  // Division managers (non-MANAGER role with a division) get scoped via ProductsContext,
  // which already filters `products` by division. We extend scoping to orders, suppliers,
  // and order items so they see a consistent slice of the system.
  const hasDivisionScope = !!currentUser && currentUser.role !== "MANAGER" && !!currentUser.division;
  const isScoped = hasAllowedIds || hasDivisionScope;

  return useMemo(() => {
    let filtered = products;
    if (hasAllowedIds) {
      const allowedSet = new Set(allowedIds);
      filtered = filtered.filter((p) => allowedSet.has(p.id));
    }
    const productIds = new Set(filtered.map((p) => p.id));
    const productNames = new Set(filtered.map((p) => p.name));
    const productSkus = new Set(filtered.map((p) => p.sku));

    const scopeOrderItems = <T extends { product_id?: string | null; name?: string | null }>(
      items: T[],
    ): T[] => {
      if (!isScoped) return items;
      return items.filter((it) => {
        if (it.product_id && productIds.has(it.product_id)) return true;
        if (!it.product_id && it.name && productNames.has(it.name)) return true;
        return false;
      });
    };

    if (!isScoped) {
      return {
        isScoped: false as const,
        scopedProducts: filtered,
        scopedProductIds: productIds,
        scopedProductNames: productNames,
        scopedProductSkus: productSkus,
        scopedOrders: orders,
        scopedSuppliers: suppliers,
        scopeOrderItems,
      };
    }

    const supplierIds = new Set<string>();
    for (const p of filtered) {
      if (p.supplier_id) supplierIds.add(p.supplier_id);
      if (p.components) {
        for (const c of p.components) {
          if (c.supplier) {
            const match = suppliers.find((s) => s.company === c.supplier);
            if (match) supplierIds.add(match.id);
          }
        }
      }
    }

    const filteredOrders = orders.filter((o) =>
      o.items.some((item) => item.product_id && productIds.has(item.product_id)),
    );
    const filteredSuppliers = suppliers.filter((s) => supplierIds.has(s.id));

    return {
      isScoped: true as const,
      scopedProducts: filtered,
      scopedProductIds: productIds,
      scopedProductNames: productNames,
      scopedProductSkus: productSkus,
      scopedOrders: filteredOrders,
      scopedSuppliers: filteredSuppliers,
      scopeOrderItems,
    };
  }, [isScoped, hasAllowedIds, allowedIds, products, orders, suppliers]);
}
