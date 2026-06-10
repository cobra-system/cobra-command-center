import type { Session } from "@supabase/supabase-js";
import type { PermissionLevel, RolePermissions } from "@/lib/permissions";

export type Role = "MANAGER" | "WAREHOUSE_MANAGER" | "LOGISTICS" | "DRIVER";
export type OrderStatus = "PENDING" | "ORDERED" | "SHIPPED" | "ARRIVED_PORT" | "CUSTOMS_CLEARANCE" | "DELIVERED" | "ARRIVED" | "CANCELLED";
export type Priority = "דחוף" | "גבוה" | "בינוני" | "נמוך";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface Profile {
  id: string;
  name: string;
  role: Role;
  role_definition_id?: string | null;
  allowed_product_ids?: string[] | null;
  division?: string | null;
}

export interface Product {
  id: string;
  category: string;
  division?: string | null;
  name: string;
  description?: string | null;
  sku: string;
  product_type: string;
  supplier?: string | null;
  supplier_id?: string | null;
  supplier_origin?: string | null;
  shipping?: string | null;
  purchase_price?: number | null;
  price_currency?: string;
  monthly_order?: number | null;
  sale_price?: number | null;
  stock_qty: number;
  incoming_qty: number;
  notes?: string | null;
  components?: ProductComponent[];
  reorder_point?: number | null;
  lead_time_days?: number | null;
  monthly_sales_avg?: number | null;
  end_product_url?: string | null;
  end_product_image?: string | null;
}

export interface ProductComponent {
  id: string;
  product_id: string;
  name: string;
  sku?: string | null;
  supplier?: string | null;
  origin?: string | null;
  stock_qty?: number | null;
  price?: number | null;
  notes?: string | null;
  image_url?: string | null;
}

export interface ProductCategory {
  id: string;
  name: string;
  color?: string | null;
}

export interface DivisionProduct {
  id: string;
  product_id: string;
  division: string;
  division_stock: number;
  quarterly_demand?: number | null;
  monthly_avg?: number | null;
  monthly_avg_updated_at?: string | null;
}

export interface SupplierContact {
  id: string;
  supplier_id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary: boolean;
}

export interface Supplier {
  id: string;
  contact_name: string;
  company: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  country?: string | null;
  products?: string | null;
  notes?: string | null;
  lead_time_days?: number | null;
  payment_terms?: string | null;
  risk_level?: string | null;
  backup_supplier_id?: string | null;
  website?: string | null;
  supplier_number?: string | null;
  contacts?: SupplierContact[];
}

export interface Order {
  id: string;
  priority: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  shipping?: string | null;
  status: string;
  order_date?: string | null;
  payment_date?: string | null;
  etd?: string | null;
  eta?: string | null;
  total_price?: number | null;
  contact_name?: string | null;
  notes?: string | null;
  tracking_number?: string | null;
  tracking_carrier?: "dhl" | "tclog" | "other" | null;
  tracking_status?: string | null;
  tracking_last_event?: string | null;
  tracking_updated_at?: string | null;
  tracking_status_code?: "pre-transit" | "transit" | "delivered" | "failure" | "unknown" | null;
  tracking_raw_status?: string | null;
  tracking_description?: string | null;
  tracking_eta?: string | null;
  tracking_last_location?: string | null;
  tracking_origin?: string | null;
  tracking_destination?: string | null;
  tracking_events?: Array<{ timestamp: string | null; code: string | null; description: string | null; location: string | null }> | null;
  tracking_last_synced_at?: string | null;
  tracking_sync_error?: string | null;
  pi_number?: string | null;
  vessel_name?: string | null;
  booking_number?: string | null;
  tclog_reference?: string | null;
  shipment_group_id?: string | null;
  destination_supplier_id?: string | null;
  destination_supplier_name?: string | null;
  updated_at?: string | null;
  order_image?: string | null;
  items: OrderItem[];
}

export interface ShipmentGroup {
  id: string;
  name: string;
  vessel_name?: string | null;
  departure_date?: string | null;
  arrival_date?: string | null;
  booking_number?: string | null;
  tclog_reference?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrderPayment {
  id: string;
  order_id: string;
  payment_type: "Deposit" | "Balance" | "Full";
  percentage?: number | null;
  amount: number;
  currency: "USD" | "EUR" | "ILS";
  due_date?: string | null;
  paid_date?: string | null;
  swift_reference?: string | null;
  status: "ממתין" | "שולם";
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Waste Management ────────────────────────────────────────────────────────

export type WasteStatus = "pending" | "destroyed" | "returning" | "repairing" | "sold";
export type WasteReturnStatus = "draft" | "shipped" | "delivered" | "settled";
export type WasteReturnSettlement = "rma" | "credit";

export interface WasteItem {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  product_sku?: string | null;
  quantity: number;
  condition_notes?: string | null;
  photo_url?: string | null;
  status: WasteStatus;
  source?: "manual" | "equipment_return" | null;
  return_item_id?: string | null;
  destruction_date?: string | null;
  destruction_certificate_url?: string | null;
  repair_technician_id?: string | null;
  repair_technician_name?: string | null;
  repair_expected_date?: string | null;
  repair_completed_date?: string | null;
  sale_buyer?: string | null;
  sale_price?: number | null;
  sale_date?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  return_id?: string | null;
  deleted_at?: string | null;
}

export interface WasteSupplierReturn {
  id: string;
  supplier_id: string;
  supplier_name?: string | null;
  status: WasteReturnStatus;
  tracking_number?: string | null;
  tracking_carrier?: "dhl" | "other" | null;
  tracking_status?: string | null;
  tracking_status_code?: "pre-transit" | "transit" | "delivered" | "failure" | "unknown" | null;
  tracking_raw_status?: string | null;
  tracking_description?: string | null;
  tracking_eta?: string | null;
  tracking_last_location?: string | null;
  tracking_origin?: string | null;
  tracking_destination?: string | null;
  tracking_events?: Array<{ timestamp: string | null; code: string | null; description: string | null; location: string | null }> | null;
  tracking_last_event?: string | null;
  tracking_last_synced_at?: string | null;
  tracking_updated_at?: string | null;
  tracking_sync_error?: string | null;
  return_reason?: string | null;
  settlement_type?: WasteReturnSettlement | null;
  rma_expected_return_date?: string | null;
  credit_amount?: number | null;
  notes?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  items?: WasteItem[];
  items_count?: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface OrderNoteHistory {
  id: string;
  order_id: string;
  note_text?: string | null;
  changed_by?: string | null;
  changed_at: string;
  change_reason?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  name: string;
  qty: number;
  price?: number | null;
  currency?: string;
}

export interface Goal {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  milestone?: string | null;
  deliverable?: string | null;
  notes?: string | null;
  is_daily: boolean;
  recurring_task_id?: string | null;
  depends_on?: string[] | null;
  frequency?: string | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  days_before?: number | null;
  time_of_day?: string | null;
  is_active?: boolean | null;
  last_generated?: string | null;
  completed_at?: string | null;
  created_by?: string | null;
  month_of_year?: number | null;
}

export interface RoleDefinition {
  id: string;
  name: string;
  system_key: string | null;
}

export interface RolePermissionRecord {
  id: string;
  role: string;
  module_key: string;
  permission_level: PermissionLevel;
}

export type OrderRequestUrgency = "דחוף" | "רגיל" | "נמוך";
export type OrderRequestType = "מיידית" | "חודשית" | "רבעונית" | "חצי שנתית";
export type OrderRequestStatus = "pending" | "ordered" | "rejected" | "cancelled";

export interface OrderRequest {
  id: string;
  division: string;
  product_id?: string | null;
  product_name: string;
  product_sku?: string | null;
  supplier?: string | null;
  supplier_id?: string | null;
  current_consumption?: string | null;
  reason?: string | null;
  quantity?: number | null;
  urgency: OrderRequestUrgency;
  order_type: OrderRequestType;
  status: OrderRequestStatus;
  order_id?: string | null;
  /** Every order this request was attached to. The first item mirrors order_id. */
  linked_order_ids?: string[] | null;
  ordered_at?: string | null;
  ordered_by?: string | null;
  ordered_by_name?: string | null;
  reject_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  estimated_unit_price?: number | null;
  created_at: string;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_at?: string | null;

  // Planning columns (bonded division Excel layout)
  main_warehouse_stock?: number | null;
  // Live division stock is now sourced from division_products.division_stock and
  // hydrated client-side at fetch time. Reads work as before; writes go through
  // division_products to avoid the dual-source-of-truth problem.
  division_stock?: number | null;
  // Immutable snapshot of division_stock at INSERT time (set by trigger). Useful
  // for audit. Stays NULL for older rows and rows without a product_id.
  division_stock_at_request?: number | null;
  quarterly_forecast?: number | null;
  utilization_pct?: number | null;
  incoming_orders?: number | null;
  smoothed_required?: number | null;
  required_to_order?: number | null;
  incoming_arrival_date?: string | null;
  order_execution_date?: string | null;
  payment_status?: string | null;
  actual_ordered_qty?: number | null;
  shipping_type?: string | null;
  estimated_arrival_date?: string | null;
  notes?: string | null;
  delivery_status?: "נשלחה" | "התקבלה" | "נקלטה" | null;
  received_qty?: number | null;
}

export interface OrderRequestHistory {
  id: string;
  request_id: string;
  changed_at: string;
  changed_by?: string | null;
  changed_by_name?: string | null;
  action: "created" | "updated" | "status_changed" | "fulfilled" | "rejected" | "cancelled" | "reverted";
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  note?: string | null;
}

export interface OrderRequestComment {
  id: string;
  request_id: string;
  body: string;
  created_at: string;
  created_by?: string | null;
  created_by_name?: string | null;
  created_by_role?: string | null;
}

export interface OrderRequestAttachment {
  id: string;
  request_id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  description?: string | null;
  created_at: string;
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface OrderRequestSnapshot {
  id: string;
  label: string;
  division?: string | null;
  captured_at: string;
  captured_by?: string | null;
  captured_by_name?: string | null;
  notes?: string | null;
  total_requests: number;
  total_required_qty?: number | null;
  total_estimated_value?: number | null;
  payload: OrderRequest[];
}

// ── Quarterly Planning ──────────────────────────────────────────────────────

export interface VehicleModel {
  id: string;
  division: string;
  brand: string;
  model_name: string;
  model_family: string | null;
  segment: string | null;
  model_code: string | null;
  is_active: boolean;
}

export interface QuarterlyVehicleForecast {
  id: string;
  vehicle_model_id: string;
  year: number;
  quarter: number;
  month1_qty: number;
  month2_qty: number;
  month3_qty: number;
  total_qty: number;
  notes: string | null;
  vehicle_models?: VehicleModel;
}

export interface ProductModelMapping {
  id: string;
  division: string;
  product_id: string;
  model_family: string;
  utilization_pct: number;
  notes: string | null;
  products?: { id: string; name: string; sku: string };
}

export interface QuarterlyProcurementPlan {
  id: string;
  division: string;
  product_id: string;
  year: number;
  quarter: number;
  computed_forecast: number | null;
  manual_forecast_override: number | null;
  utilization_pct: number;
  safety_buffer: number;
  smoothed_required: number | null;
  current_stock: number | null;
  incoming_orders: number | null;
  required_to_order: number | null;
  month1_demand: number | null;
  month2_demand: number | null;
  month3_demand: number | null;
  order_execution_date: string | null;
  payment_status: string | null;
  actual_ordered_qty: number | null;
  shipping_type: string | null;
  estimated_arrival_date: string | null;
  incoming_arrival_date: string | null;
  notes: string | null;
  products?: { id: string; name: string; sku: string; supplier?: string | null };
}

export interface QuarterlyPlanSnapshot {
  id: string;
  division: string;
  year: number;
  quarter: number;
  label: string;
  notes: string | null;
  payload: QuarterlyProcurementPlan[];
  total_products: number | null;
  total_required: number | null;
  captured_at: string;
  captured_by: string | null;
  captured_by_name: string | null;
}

export interface AuthState {
  currentUser: Profile | null;
  session: Session | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}
