import { useMemo } from "react";
import { useAuth, useData } from "@/contexts/AppContext";

export function useProductScope() {
  const { currentUser } = useAuth();
  const { products, orders, suppliers } = useData();

  const scope = currentUser?.allowed_product_ids;
  const isScoped = Array.isArray(scope) && scope.length > 0;

  return useMemo(() => {
    if (!isScoped) {
      return {
        isScoped: false as const,
        scopedProducts: products,
        scopedProductIds: new Set(products.map((p) => p.id)),
        scopedProductNames: new Set(products.map((p) => p.name)),
        scopedProductSkus: new Set(products.map((p) => p.sku)),
        scopedOrders: orders,
        scopedSuppliers: suppliers,
      };
    }

    const scopeSet = new Set(scope);
    const filtered = products.filter((p) => scopeSet.has(p.id));
    const productIds = new Set(filtered.map((p) => p.id));
    const productNames = new Set(filtered.map((p) => p.name));
    const productSkus = new Set(filtered.map((p) => p.sku));

    // Collect supplier IDs from scoped products (direct supplier_id + component suppliers)
    const supplierIds = new Set<string>();
    for (const p of filtered) {
      if (p.supplier_id) supplierIds.add(p.supplier_id);
      if (p.components) {
        for (const c of p.components) {
          if (c.supplier) {
            // component.supplier is a name, find matching supplier
            const match = suppliers.find((s) => s.company === c.supplier);
            if (match) supplierIds.add(match.id);
          }
        }
      }
    }

    const filteredOrders = orders.filter((o) =>
      o.items.some((item) => item.product_id && productIds.has(item.product_id))
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
    };
  }, [isScoped, scope, products, orders, suppliers]);
}
