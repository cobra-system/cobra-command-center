---
name: sap-order-import
description: >-
  Import a purchase order exported from SAP (a Hebrew RTL PDF) into the Cobra
  orders system. Use whenever the user uploads or points to a SAP purchase-order
  PDF and wants it turned into an order — "תעלה את ההזמנה מ-SAP", "import this PO",
  "הכנס את ההזמנה הזו למערכת". Parses the PDF, matches the supplier and products
  against live data, shows a preview, and after explicit approval creates the
  order via the create_order MCP tool with its SAP document number recorded.
---

# SAP Purchase-Order Import

Turn a SAP purchase-order PDF into a Cobra order. The flow is **parse → match →
preview → confirm → create**. Never create an order without showing the preview
and getting explicit approval first — this writes to production data.

## 0. One-time setup (per session/container)

The parser needs `pdfminer.six`:

```bash
pip install -r scripts/sap-po/requirements.txt
```

If import fails with `No module named '_cffi_backend'`, the environment's crypto
libs are broken — repair once with `pip install --force-reinstall cffi cryptography`.

## 1. Parse the PDF

```bash
python3 scripts/sap-po/extract_po.py "<path-to-uploaded-po.pdf>"
```

This prints JSON. Key fields:

| JSON field | Meaning | SAP label (Hebrew) |
|---|---|---|
| `po_number` | SAP purchase-order number | הזמנת רכש |
| `supplier_name` | Vendor being ordered from | לכבוד |
| `supplier_vat` | Vendor company/VAT id (9 digits) | מספר ע.מ |
| `order_date` | ISO date | תאריך |
| `payment_terms` | e.g. שוטף+90 | תנאי תשלום |
| `agent` | Sales agent | סוכן |
| `notes` | Free-text comment | (הזמנה עבור …) |
| `subtotal` / `vat_rate` / `vat_amount` / `total` | Money (goods / VAT% / VAT / incl. VAT) | סה"כ / מע"מ |
| `items[]` | Line items | table body |
| `items[].code` | **Item code — the primary match key** | קוד פריט / מק"ט יצרן |
| `items[].qty` / `unit_price` / `line_total` | quantities & prices | כמות / מחיר / סה"כ |

**Stop and show the user `_warnings` if it is non-empty** (arithmetic didn't
reconcile, or no items parsed → the template may have changed). Do not proceed on
unreconciled numbers.

## 2. Guard against duplicate import

Before anything else, check whether this PO is already in the system:

- Call `get_order_by_reference` with `po_number` (it resolves `orders.sap_doc_entry`).
- If a matching order exists, **stop** and tell the user — don't create a duplicate.

## 3. Match the supplier

- Call `list_suppliers` with `search` = the parsed `supplier_name` (Hebrew).
- The returned rows include `sap_code`, `supplier_number`, `company`, `contact_name`.
- Prefer, in order: a row whose `sap_code` or `supplier_number` equals the SAP
  vendor code, then an exact `company` name match, then a single fuzzy match.
- **0 matches or >1 plausible matches → ask the user** which supplier (or to
  create one first). Never guess the supplier.

## 4. Match each line item to a product

**`9999` (and `999` / `99999`) is SAP's generic item code** — it is written on lines
that have no catalogue item, and the whole item lives in the description. Never
resolve such a line by its code: leave `product_id` unset and keep the description
as the line name (only bind a product if the *description* itself is a known SKU or
an exact product name). Say so in the preview rather than flagging it as "unmatched".

For every other `items[]` entry, resolve `product_id`:

1. `get_product_by_sku` with `items[].code` (SAP item code often equals the SKU).
2. If not found, `search_products` by code / `sap_code` / description.
3. Still nothing → leave `product_id` unset. The order line keeps the free-text
   `name` (use the parsed `description`), and you flag it in the preview as
   **unmatched** so the user can fix it later.

## 5. Show the preview (required)

Present a compact table the user can verify without opening the PDF:

- Supplier (matched name + how it matched), SAP PO number, order date, payment terms.
- One row per item: code → matched product name (or **UNMATCHED**), qty, unit price, line total.
- Subtotal, VAT, total. Repeat any `_warnings`.

Then ask for explicit approval to create the order.

## 6. Create the order

Only after approval, call `create_order`:

| create_order arg | value |
|---|---|
| `supplier_id` | matched supplier UUID |
| `supplier_name` | matched supplier company (auto-filled if omitted) |
| `sap_doc_entry` | `po_number` — **always set this** (the SAP anchor) |
| `order_date` | `order_date` (YYYY-MM-DD) |
| `total_price` | `subtotal` (goods value, pre-VAT) |
| `status` | `ORDERED` (the PO is already issued in SAP) |
| `priority` | `בינוני` unless the user says otherwise |
| `notes` | compose: parsed `notes` (the document's free-text comment) + `agent` + payment terms + VAT/total summary + the line descriptions (they are the only record of a generic `9999` line) |
| `items[]` | `{ product_id?, name: description, qty, price: unit_price }` per line |

Report the created order's id and a one-line summary. If any item was unmatched,
remind the user to link the product.

## Notes on robustness

- Item **codes, quantities, prices, dates, and the PO number extract reliably**
  (digits aren't affected by RTL). Hebrew descriptions are de-reversed best-effort
  and are secondary — matching keys off `code`, not the description text.
- The parser targets Cobra's fixed SAP PO template. If SAP's layout changes, the
  x-band column boundaries in `extract_po.py` are the thing to adjust; the
  `_warnings` block is designed to catch such drift rather than fail silently.
- This session's Supabase MCP may not be connected to the production project.
  Creating orders goes through the app's own MCP server (`create_order`), which
  is the controlled, audited path — never insert into production tables directly.
