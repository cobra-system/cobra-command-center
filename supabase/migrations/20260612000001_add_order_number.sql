-- Human-readable order number (מספר הזמנה) for every order.
--
-- Until now an order had no number of its own: SAP orders carried
-- sap_doc_entry, foreign orders carried the supplier's pi_number, and orders
-- created by hand carried nothing. Every order now gets an internal
-- CO-<year>-<4-digit sequence> number, assigned by a trigger on insert.
--
-- The year comes from order_date when set, otherwise the row's creation date,
-- so an order backdated to last year is numbered in last year's series.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number text;

COMMENT ON COLUMN orders.order_number IS
  'Internal Cobra order number, format CO-YYYY-NNNN. Assigned automatically on insert; unique across all orders.';

-- Per-year counter. A single row per year, bumped atomically, so concurrent
-- inserts can never hand out the same number.
CREATE TABLE IF NOT EXISTS order_number_counters (
  year     int PRIMARY KEY,
  last_seq int NOT NULL DEFAULT 0
);

COMMENT ON TABLE order_number_counters IS
  'Allocation counter behind orders.order_number — one row per year, last_seq is the highest sequence handed out.';

ALTER TABLE order_number_counters ENABLE ROW LEVEL SECURITY;
-- No policies: the table is reached only through next_order_number(), which is
-- SECURITY DEFINER. Direct client access stays denied.

CREATE OR REPLACE FUNCTION next_order_number(p_year int DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year   int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_seq    int;
  v_number text;
  v_tries  int := 0;
BEGIN
  -- Loop past any number already taken — a hand-entered order_number, or a row
  -- restored from a backup — so the counter can never hand out a duplicate.
  LOOP
    INSERT INTO order_number_counters AS c (year, last_seq)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE SET last_seq = c.last_seq + 1
    RETURNING c.last_seq INTO v_seq;

    v_number := 'CO-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = v_number);

    v_tries := v_tries + 1;
    IF v_tries > 1000 THEN
      RAISE EXCEPTION 'could not allocate a free order number for %', v_year;
    END IF;
  END LOOP;

  RETURN v_number;
END;
$$;

COMMENT ON FUNCTION next_order_number(int) IS
  'Allocates the next CO-YYYY-NNNN order number for the given year (defaults to the current year).';

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.order_number IS NULL OR btrim(NEW.order_number) = '') THEN
    -- Never let an update blank out an already-assigned number.
    NEW.order_number := OLD.order_number;
  END IF;

  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number := next_order_number(
      EXTRACT(YEAR FROM COALESCE(NEW.order_date::date, NEW.created_at::date, CURRENT_DATE))::int
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_order_number ON orders;
CREATE TRIGGER orders_set_order_number
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- Backfill existing orders: number them per year in creation order.
WITH numbered AS (
  SELECT id,
         EXTRACT(YEAR FROM COALESCE(order_date::date, created_at::date))::int AS yr,
         row_number() OVER (
           PARTITION BY EXTRACT(YEAR FROM COALESCE(order_date::date, created_at::date))
           ORDER BY created_at, id
         ) AS seq
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders o
   SET order_number = 'CO-' || n.yr::text || '-' || lpad(n.seq::text, 4, '0')
  FROM numbered n
 WHERE o.id = n.id;

-- Seed the counters past everything the backfill just handed out.
INSERT INTO order_number_counters (year, last_seq)
SELECT split_part(order_number, '-', 2)::int,
       MAX(split_part(order_number, '-', 3)::int)
  FROM orders
 WHERE order_number ~ '^CO-\d{4}-\d+$'
 GROUP BY 1
ON CONFLICT (year) DO UPDATE
  SET last_seq = GREATEST(order_number_counters.last_seq, EXCLUDED.last_seq);

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON orders (order_number);
