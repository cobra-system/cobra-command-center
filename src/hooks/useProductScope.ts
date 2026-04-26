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

    // An order is in scope when any item references a scoped product —
    // either by id, or by name/sku for free-text items where product_id is null.
    const filteredOrders = orders.filter((o) =>
      o.items.some((item) => {
        if (item.product_id) return productIds.has(item.product_id);
        return productNames.has(item.name);
      })
    );

    // Suppliers in scope = suppliers of scoped products (direct + components)
    // PLUS suppliers referenced by scoped orders (origin + destination).
    // Without the order-side contribution, a scoped order's supplier can be
    // hidden from the suppliers list, breaking navigation from order → supplier.
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
    for (const o of filteredOrders) {
      if (o.supplier_id) supplierIds.add(o.supplier_id);
      if (o.destination_supplier_id) supplierIds.add(o.destination_supplier_id);
    }

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
