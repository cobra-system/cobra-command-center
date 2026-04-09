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
  monthly_sales?: number | null;
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
  pi_number?: string | null;
  vessel_name?: string | null;
  booking_number?: string | null;
  tclog_reference?: string | null;
  shipment_group_id?: string | null;
  updated_at?: string | null;
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

export interface AuthState {
  currentUser: Profile | null;
  session: Session | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}
