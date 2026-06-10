-- Add price_currency to products table (default USD for existing data)
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_currency TEXT NOT NULL DEFAULT 'USD';

-- Add currency to order_items table (default USD for existing data)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
