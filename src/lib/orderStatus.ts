import type { OrderStatus } from "@/contexts/types";

/**
 * Statuses that take an order out of the active pipeline.
 *
 * "נמסר" (DELIVERED) means the shipment reached us — the order is finished, so
 * it belongs in the archive next to ARRIVED (the legacy delivered status) and
 * CANCELLED, not in the active orders list or in any "open orders" count.
 */
export const CLOSED_ORDER_STATUSES: OrderStatus[] = ["DELIVERED", "ARRIVED", "CANCELLED"];

/** Statuses an order moves through while it is still being worked. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "ORDERED",
  "SHIPPED",
  "ARRIVED_PORT",
  "CUSTOMS_CLEARANCE",
];

/** Closed *and* successful — the goods actually arrived (excludes CANCELLED). */
export const COMPLETED_ORDER_STATUSES: OrderStatus[] = ["DELIVERED", "ARRIVED"];

/** True for orders that are done (delivered/arrived) or cancelled. */
export function isOrderClosed(status?: string | null): boolean {
  return !!status && (CLOSED_ORDER_STATUSES as string[]).includes(status);
}

/** True while the order is still in the pipeline. Unknown statuses count as active. */
export function isOrderActive(status?: string | null): boolean {
  return !isOrderClosed(status);
}

/** True when the goods arrived (delivered or the legacy "arrived" status). */
export function isOrderCompleted(status?: string | null): boolean {
  return !!status && (COMPLETED_ORDER_STATUSES as string[]).includes(status);
}
