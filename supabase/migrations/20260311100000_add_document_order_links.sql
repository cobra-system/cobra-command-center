-- Add order_id to purchase_documents for linking documents to orders
ALTER TABLE purchase_documents
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL;

-- Add document_id to supplier_payments for linking payments to documents
ALTER TABLE supplier_payments
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES purchase_documents(id) ON DELETE SET NULL;
