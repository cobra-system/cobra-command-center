-- Create junction table for document-product many-to-many relationship
CREATE TABLE IF NOT EXISTS document_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES purchase_documents(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(document_id, product_id)
);

-- Add RLS policies
ALTER TABLE document_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON document_products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON document_products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON document_products
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON document_products
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create index for performance
CREATE INDEX idx_document_products_document_id ON document_products(document_id);
CREATE INDEX idx_document_products_product_id ON document_products(product_id);
