export interface PurchaseDocument {
  id: string;
  type: string;
  document_name: string | null;
  supplier_id: string | null;
  product_id: string | null;
  order_id: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  currency: string;
  status: string;
  approval_date: string | null;
  approved_by: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  supplier_id: string | null;
  order_id: string | null;
  document_id: string | null;
  amount: number;
  currency: string;
  payment_type: string;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
