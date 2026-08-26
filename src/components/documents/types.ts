export interface PurchaseDocument {
  id: string;
  type: string;
  /** Finer-grained kind within `type` — e.g. SWIFT, BL, INVOICE (see purchase_documents.document_subtype) */
  document_subtype?: string | null;
  document_name: string | null;
  supplier_id: string | null;
  product_id: string | null;
  order_id: string | null;
  /** Payment installment (order_payments) this document settles — SWIFT confirmations */
  order_payment_id?: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  currency: string;
  status: string;
  approval_date: string | null;
  approved_by: string | null;
  file_url: string | null;
  notes: string | null;
  folder_id: string | null;
  is_starred: boolean;
  document_number: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentFolder {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
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
