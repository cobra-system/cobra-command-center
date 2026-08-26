---
name: foreign-order-import
description: >-
  Turn a foreign supplier's purchase document into a Cobra order — proforma
  invoice, PI, order confirmation, sales contract or quotation, in any layout:
  text PDF, scan, photo, Excel or an email body. Use whenever the user uploads
  or points at a document from an overseas supplier and wants it read and
  entered — "תכניס את ההזמנה הזאת", "this is a PI from the supplier", "תקרא את
  החשבונית ותפתח הזמנה", "import this proforma". Reads the document (visually
  when it is a scan), fills in every order field, matches supplier and products
  against live data, shows a preview, and creates the order only after explicit
  approval. For Hebrew SAP purchase orders use `sap-order-import` instead.
---

# Foreign Supplier Order Import

An order placed in Israel comes out of SAP and always looks the same — that is
what `sap-order-import` parses. An order placed abroad does not: every supplier
sends its own proforma invoice, order confirmation or sales contract, in its own
layout, its own language, its own number format, as a clean PDF one time and a
phone photo of a printout the next.

So this skill does not have a template. It has a **method**: get the document
readable, read it yourself, map what you read onto the fields an order has, show
your reading to the user, and only then write it.

The flow is **extract → read → normalise → match → preview → confirm → create**.
Never create an order without showing the preview and getting explicit approval
— this writes to production data.

**The app can do the easy cases without you.** "ייבוא מקובץ" in the new-order
dialog parses a text PDF or a spreadsheet in the browser (`src/lib/orderImport/`)
and drops the result into the form. Use this skill when that is not enough: a
scan or a photo (the browser cannot read one), a document the in-app reader
returned warnings on, several files at once, or anything needing judgement about
what the document actually is. If the user's document is a clean PDF/Excel and
they are in front of the app, say so — it is faster than a chat round-trip.

## 0. One-time setup (per session/container)

```bash
pip install -r scripts/foreign-po/requirements.txt
```

If an import fails with `No module named '_cffi_backend'`, the environment's
crypto libs are broken — repair once with
`pip install --force-reinstall cffi cryptography`.

## 1. Extract

Run the extractor once per file the user sent (a PI and its packing list are two
files — extract both, treat the PI as the order):

```bash
python3 scripts/foreign-po/extract_doc.py "<path>" --outdir /tmp/po-pages
```

It handles text PDFs, scans, photos, `.xlsx`, `.csv` and plain text, and prints
JSON:

| Field | Meaning |
|---|---|
| `source_kind` | `pdf` / `image` / `spreadsheet` / `delimited` / `text` |
| `raw_text` | everything it could read as text — **this is what you read** |
| `page_images` | rendered page PNGs, for documents with no usable text layer |
| `_needs_vision` | `true` → the text layer is missing or too thin to trust |
| `document_type` | proforma_invoice / order_confirmation / quotation / … (a guess) |
| `candidates` | hints per field, each with the source line it came from |
| `items[]` | rows where qty × unit price reconciled against the line amount |
| `_warnings` | what did not add up — **always read these out to the user** |

## 2. Read the document yourself

**`candidates` are hints, not answers.** They come from regexes that know nothing
about this supplier. Confirm every one of them against the document, and fill in
what the regexes missed — that is the whole point of the skill.

- Always read `raw_text` end to end. It carries the letterhead, the terms and the
  small print that no field extractor models.
- If `_needs_vision` is `true`, **read every path in `page_images` with the Read
  tool** and take the document's contents from what you see. When `page_images`
  is empty because nothing could render it, read the original file directly.
- For spreadsheets, `sheets` holds the raw grid per sheet — use it when the
  flattened text is ambiguous about which column is which.
- Numbers written `1.234,56` (Europe) and `1,234.56` (US/Asia) both appear. The
  extractor resolves the ambiguity by reconciling qty × price = amount; where it
  could not, resolve it yourself against the document total.

### Is this document even an order?

Before filling anything in, decide what you are looking at. A document is a
purchase order to enter when it has, together: a seller and a buyer, line items
with quantities and unit prices, a total, and the supplier's own document number.

- **Proforma invoice / order confirmation / sales contract** → an order. Proceed.
- **Quotation / offer / price list** → *not* an order yet. Say so and ask whether
  the user wants it entered as a `PENDING` order anyway.
- **Packing list / bill of lading / commercial invoice for goods already shipped**
  → usually belongs on an existing order. Look the order up (step 4) and offer to
  update it rather than creating a second one.

State which of these it is in the preview, and why.

## 3. Normalise what you read

Build this in your head (or a scratch file) before touching any tool:

| Field | Where it comes from on a foreign document |
|---|---|
| supplier | the letterhead / Seller / Shipper / Beneficiary block |
| supplier's document number | PI No. / Invoice No. / Order No. / Nr. ordine / 发票号 |
| order date | Date / Data / Fecha / 日期 — the document's own issue date |
| currency | the symbol or code on the prices; never assume USD |
| items | code, description, qty, unit price, line total |
| goods value | the pre-freight, pre-tax subtotal |
| grand total | what the supplier expects to be paid |
| incoterm + place | FOB Ningbo, CIF Ashdod, EXW … |
| payment terms | 30% T/T deposit, balance against B/L, net 60 … |
| ETD / ETA | shipment date, delivery date, "within 45 days" |
| bank details | SWIFT/BIC, IBAN, account, beneficiary bank |

Freight, insurance and discount lines are **not** order items — keep them out of
`items[]` and record them in the notes, otherwise the item sum will not match the
document total.

## 4. Guard against a duplicate import

Before anything else is written:

- `get_order_by_pi` with the supplier's document number (fuzzy — it catches
  `…rev1`, `…b` revisions).
- `get_order_by_reference` with the same number as a second pass.
- If a matching order exists, **stop** and tell the user. Offer to update that
  order (a revised PI, an added item, a confirmed ETD) instead of creating a
  second one.

## 5. Match the supplier

- `list_suppliers` with `search` = the name as printed on the letterhead.
- Prefer, in order: exact `company` match, a match on the supplier's contact
  email domain, then a single fuzzy match.
- A foreign supplier should have `country` ≠ ישראל. If the only match is an
  Israeli supplier, say so — it is probably the wrong one.
- **0 matches or >1 plausible matches → ask the user** which supplier (or to
  create it first). Never guess the supplier.

## 6. Match each line item to a product

For every item, resolve `product_id`:

1. `get_product_by_sku` with the supplier's item code.
2. Otherwise `search_products` by code, then by description — including a
   translated description when the document is not in English.
3. Still nothing → leave `product_id` unset. The line keeps its free-text `name`,
   and you flag it in the preview as **unmatched** so the user can link it later.

Never invent a `product_id`, and never bend a code to fit a near-miss SKU — an
unmatched line is a fine outcome, a wrong link is not.

## 7. Reconcile the arithmetic

Check, and report each one in the preview:

- every line: qty × unit price = line total;
- Σ line totals = the document's goods subtotal;
- subtotal + freight/insurance − discount = grand total;
- one currency across the document.

Anything that does not reconcile goes to the user **before** the order is
created, together with `_warnings` from the extractor. Do not quietly round.

## 8. Show the preview (required)

A compact table the user can check without opening the document:

- what the document is (PI / order confirmation / quotation) and its number;
- matched supplier + how it matched;
- order date, currency, incoterm, payment terms, ETD/ETA;
- one row per item: code → matched product name (or **UNMATCHED**), qty, unit
  price, line total;
- subtotal, freight/other, grand total;
- every warning, and every field you had to infer rather than read.

Then ask for explicit approval to create the order.

## 9. Create the order

Only after approval, call `create_order`:

| create_order arg | value |
|---|---|
| `supplier_id` | matched supplier UUID |
| `supplier_name` | matched supplier company (auto-filled if omitted) |
| `pi_number` | the supplier's own document number — **always set this** |
| `order_date` | the document's issue date (YYYY-MM-DD) |
| `total_price` | goods value (pre-freight, pre-tax) |
| `status` | `ORDERED` for a PI/order confirmation the user has committed to, `PENDING` for a quotation |
| `priority` | `בינוני` unless the user says otherwise |
| `etd` / `eta` | shipment / arrival dates when the document states them |
| `contact_name` | the supplier-side contact on the document |
| `notes` | incoterm + place, payment terms, freight/discount lines, bank details, and anything you inferred |
| `items[]` | `{ product_id?, name: description, qty, price: unit_price, currency }` per line |

Set `currency` on every item when the supplier invoices in anything other than
USD — it defaults to USD and a EUR price stored as USD is a silent 8% error.

Do **not** pass an order number: `order_number` (`CO-YYYY-NNNN`) is assigned by
the database and comes back in the response.

## 10. Report back

Give the user:

- the **order number** (`CO-2026-0042`) — this is how the order is referred to
  from here on, and it is searchable in the orders screen;
- the order id, supplier, item count and total;
- any unmatched item, with a reminder to link the product;
- anything still unconfirmed (an ambiguous date, a missing ETD).

Then offer to attach the source document to the order (`upload_document` /
Documents section) so the original stays with the record.

## SWIFT confirmations

A bank's SWIFT confirmation is not an order — it settles one. The app reads text
PDFs of them itself (`src/lib/swiftImport/`), fills the payment in and marks it
paid; a **scan or screenshot** it cannot read, and it tells the user to send it
here. When that happens:

1. Read the document (visually if it is a scan) and pull out: amount, currency,
   value date, sender's reference (`:20:`), beneficiary (`:59:`), and the
   remittance line (`:70:`) — which usually quotes the PI number.
2. Find the order: `get_order_by_pi` with the PI from the remittance line, else
   `get_order_by_reference`, else the beneficiary name via `list_suppliers`.
3. `list_order_payments` and identify the installment by amount + currency. A gap
   of a percent or two is bank fees, not a different payment; anything larger,
   ask rather than assume.
4. Show what you read and which installment it settles, get approval, then
   `upload_swift_document` (it files the document, links it to the installment,
   records the reference and can mark it paid).

Never mark an installment paid off a document you could not read in full.

## Notes on robustness

- Codes, quantities, prices and dates extract reliably; free-text descriptions in
  Chinese, Italian or Turkish are secondary — match on the **code** first.
- The extractor never fails a document silently: if it cannot reconcile the
  items, it says so in `_warnings` and expects you to build the list by hand from
  your own read. That is a normal path, not an error.
- A document that is a photo at an angle, half-cut or unreadable → say exactly
  what you cannot read and ask for a better copy. Do not fill a field you could
  not actually see.
- Creating orders goes through the app's own MCP server (`create_order`), the
  controlled and audited path — never insert into production tables directly.
