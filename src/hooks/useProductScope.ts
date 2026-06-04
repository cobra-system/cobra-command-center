import { useMemo } from "react";
import { useAuth, useProducts, useOrders, useSuppliers } from "@/contexts/AppContext";

export function useProductScope() {
  const { currentUser } = useAuth();
  const { products } = useProducts();
  const { orders } = useOrders();
  const { suppliers } = useSuppliers();

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

    // Component names/skus of scoped products — orders for sub-items should
    // also be visible when the parent product is in scope.
    const componentNames = new Set<string>();
    const componentSkus = new Set<string>();
    for (const p of filtered) {
      for (const c of p.components ?? []) {
        if (c.name) componentNames.add(c.name);
        if (c.sku) componentSkus.add(c.sku);
      }
    }

    // An item is in scope when it references a scoped product —
    // by id, by product name/sku (free-text), or by component name/sku.
    const itemInScope = (item: { product_id?: string | null; name?: string | null }) => {
      if (item.product_id) return productIds.has(item.product_id);
      if (!item.name) return false;
      return (
        productNames.has(item.name) ||
        productSkus.has(item.name) ||
        componentNames.has(item.name) ||
        componentSkus.has(item.name)
      );
    };

    const scopeOrderItems = <T extends { product_id?: string | null; name?: string | null }>(
      items: T[],
    ): T[] => (isScoped ? items.filter(itemInScope) : items);

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

    const filteredOrders = orders.filter((o) => o.items.some(itemInScope));

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
      scopeOrderItems,
    };
  }, [isScoped, hasAllowedIds, allowedIds, products, orders, suppliers]);
}
