-- supplier_bank_details: bank wire transfer info per supplier
CREATE TABLE supplier_bank_details (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  beneficiary_name TEXT NOT NULL,
  bank_name        TEXT NOT NULL,
  swift_code       TEXT NOT NULL,
  account_number   TEXT NOT NULL,
  bank_address     TEXT,
  currency         TEXT NOT NULL DEFAULT 'USD',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supplier_bank_details_supplier_id ON supplier_bank_details(supplier_id);

-- updated_at trigger
CREATE TRIGGER supplier_bank_details_updated_at
  BEFORE UPDATE ON supplier_bank_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE supplier_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_bank_details_select" ON supplier_bank_details
  FOR SELECT USING (true);

CREATE POLICY "supplier_bank_details_insert" ON supplier_bank_details
  FOR INSERT WITH CHECK (true);

CREATE POLICY "supplier_bank_details_update" ON supplier_bank_details
  FOR UPDATE USING (true);

CREATE POLICY "supplier_bank_details_delete" ON supplier_bank_details
  FOR DELETE USING (true);

-- Seed known bank details (matched by supplier company name via subquery)
INSERT INTO supplier_bank_details (supplier_id, beneficiary_name, bank_name, swift_code, account_number, currency)
SELECT s.id, 'SHENZHEN ISTAR VIDEO TECHNOLOGY CO., LIMITED', 'DBS Bank Hong Kong Ltd', 'DHBKHKHHXXX', '79969000355208', 'USD'
FROM suppliers s WHERE s.company ILIKE '%istar%' LIMIT 1;

INSERT INTO supplier_bank_details (supplier_id, beneficiary_name, bank_name, swift_code, account_number, currency)
SELECT s.id, 'WOAN TECHNOLOGY LIMITED', 'HSBC Bank (China) Shenzhen Branch', 'HSBCCNSHXXX', '002-572485-055', 'USD'
FROM suppliers s WHERE s.company ILIKE '%woan%' OR s.company ILIKE '%switch%bot%' LIMIT 1;

INSERT INTO supplier_bank_details (supplier_id, beneficiary_name, bank_name, swift_code, account_number, currency)
SELECT s.id, 'HONGKONG KAIER TECHNOLOGY CO., LIMITED', 'HSBC Hong Kong', 'HSBCHKHHHKH', '098749435838', 'USD'
FROM suppliers s WHERE s.company ILIKE '%kaier%' LIMIT 1;

INSERT INTO supplier_bank_details (supplier_id, beneficiary_name, bank_name, swift_code, account_number, currency)
SELECT s.id, 'XIAMEN JUST SUPPLY CHAIN MANAGEMENT CO., LTD', 'Agricultural Bank of China, Xiamen', 'ABOCCNBJXXX', '40342014040018788', 'USD'
FROM suppliers s WHERE s.company ILIKE '%autostar%' OR s.company ILIKE '%just supply%' LIMIT 1;
