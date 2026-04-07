-- =============================================
-- Foreign key constraints with CASCADE/RESTRICT
-- =============================================

-- Order items: deleting an order cascades to its items
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
  ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- Product components: deleting a product cascades to its components
ALTER TABLE product_components
  DROP CONSTRAINT IF EXISTS product_components_product_id_fkey,
  ADD CONSTRAINT product_components_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Supplier contacts: deleting a supplier cascades to its contacts
ALTER TABLE supplier_contacts
  DROP CONSTRAINT IF EXISTS supplier_contacts_supplier_id_fkey,
  ADD CONSTRAINT supplier_contacts_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

-- Center contacts: deleting a center cascades to its contacts
ALTER TABLE center_contacts
  DROP CONSTRAINT IF EXISTS center_contacts_center_id_fkey,
  ADD CONSTRAINT center_contacts_center_id_fkey
    FOREIGN KEY (center_id) REFERENCES distribution_centers(id) ON DELETE CASCADE;

-- Center inventory: deleting a center cascades to its inventory records
ALTER TABLE center_inventory
  DROP CONSTRAINT IF EXISTS center_inventory_center_id_fkey,
  ADD CONSTRAINT center_inventory_center_id_fkey
    FOREIGN KEY (center_id) REFERENCES distribution_centers(id) ON DELETE CASCADE;

-- Compliance product links: cascade on both sides
ALTER TABLE compliance_product_links
  DROP CONSTRAINT IF EXISTS compliance_product_links_compliance_item_id_fkey,
  ADD CONSTRAINT compliance_product_links_compliance_item_id_fkey
    FOREIGN KEY (compliance_item_id) REFERENCES compliance_items(id) ON DELETE CASCADE;

ALTER TABLE compliance_product_links
  DROP CONSTRAINT IF EXISTS compliance_product_links_product_id_fkey,
  ADD CONSTRAINT compliance_product_links_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Workflow step logs: cascade when instance is deleted
ALTER TABLE workflow_step_logs
  DROP CONSTRAINT IF EXISTS workflow_step_logs_instance_id_fkey,
  ADD CONSTRAINT workflow_step_logs_instance_id_fkey
    FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE;

-- RESTRICT: prevent deleting suppliers that have orders
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_supplier_id_fkey,
  ADD CONSTRAINT orders_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT;

-- RESTRICT: prevent deleting products that have order items
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey,
  ADD CONSTRAINT order_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

-- =============================================
-- Default values for columns that should always have a value
-- =============================================

-- Note: orders.status DEFAULT 'PENDING', orders.priority DEFAULT 'P2',
-- tasks.status DEFAULT 'TODO', tasks.priority DEFAULT 'P2',
-- products.stock_qty DEFAULT 0, products.incoming_qty DEFAULT 0
-- are already set in the schema. Adding remaining defaults:

ALTER TABLE supplier_payments ALTER COLUMN status SET DEFAULT 'ממתין לתשלום';
ALTER TABLE inventory_transfers ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE product_issues ALTER COLUMN status SET DEFAULT 'פתוח';

-- =============================================
-- CHECK constraints for data integrity
-- =============================================

-- Products: quantities must be non-negative, price must be non-negative
ALTER TABLE products ADD CONSTRAINT chk_products_stock_qty_non_negative
  CHECK (stock_qty >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_incoming_qty_non_negative
  CHECK (incoming_qty >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_purchase_price_non_negative
  CHECK (purchase_price IS NULL OR purchase_price >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_sale_price_non_negative
  CHECK (sale_price IS NULL OR sale_price >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_lead_time_positive
  CHECK (lead_time_days IS NULL OR lead_time_days > 0);

-- Order items: quantity must be positive, prices non-negative
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_qty_positive
  CHECK (qty > 0);
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_unit_price_non_negative
  CHECK (unit_price IS NULL OR unit_price >= 0);

-- Center inventory: quantity and min_stock must be non-negative
ALTER TABLE center_inventory ADD CONSTRAINT chk_center_inventory_quantity_non_negative
  CHECK (quantity >= 0);
ALTER TABLE center_inventory ADD CONSTRAINT chk_center_inventory_min_stock_non_negative
  CHECK (min_stock IS NULL OR min_stock >= 0);

-- Inventory transfers: quantity must be positive
ALTER TABLE inventory_transfers ADD CONSTRAINT chk_inventory_transfers_qty_positive
  CHECK (quantity > 0);

-- Supplier payments: amount must be positive
ALTER TABLE supplier_payments ADD CONSTRAINT chk_supplier_payments_amount_positive
  CHECK (amount > 0);

-- Supplier price quotes: price must be non-negative
ALTER TABLE supplier_price_quotes ADD CONSTRAINT chk_supplier_price_quotes_unit_price_non_negative
  CHECK (unit_price >= 0);
