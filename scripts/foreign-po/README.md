# Foreign Supplier Order Import

Tooling to bring purchase documents from overseas suppliers — proforma invoices,
order confirmations, sales contracts, quotations — into the Cobra orders system.

Unlike the Israeli SAP export (`scripts/sap-po/`), these documents have no shared
template: each supplier sends its own layout, in its own language, as a text PDF
one time and a phone photo of a printout the next.

## Files

- `extract_doc.py` — reads one document into JSON. Handles text PDFs, scans and
  photos (rendered to page images for a visual read), `.xlsx`, `.csv` and plain
  text. Emits the raw text, per-field candidates with the source line each came
  from, reconciled line items, and a `_warnings` array for anything that did not
  add up.
- `requirements.txt` — `pdfminer.six` (text PDFs), `openpyxl` (spreadsheets), and
  `pymupdf` (rendering scans; poppler's `pdftoppm` works instead if installed).

## Usage

```bash
pip install -r scripts/foreign-po/requirements.txt
python3 scripts/foreign-po/extract_doc.py path/to/proforma.pdf --outdir /tmp/po-pages
```

The end-to-end import flow (read → normalise → match supplier/products →
preview → confirm → create the order) is driven by the
**`foreign-order-import`** Skill in `.claude/skills/foreign-order-import/`. Run
that skill in a Claude Code / Cowork session and upload the document; this script
is only its first step.

## How it finds line items without a template

A purchase-order row carries three numbers that multiply out — qty × unit price ≈
line amount. The parser tries every numeric triple on every line and keeps the
ones that reconcile within 1.5%, ranked by the size of the amount. This works
whether the columns run qty/price/total or price/qty/total, and it resolves the
`1.234,56` vs `1,234.56` ambiguity as a side effect: the reading that makes the
row reconcile is the right one.

Numbers that belong to a part code (`SR-4410`) or a fraction (`3/8"`) are skipped
by looking at the character before them.

## The browser twin

`src/lib/orderImport/foreignDoc.ts` is the same method in TypeScript, behind
"ייבוא מקובץ" in the app's new-order dialog: same qty × price = amount
reconciliation, same multilingual label matching. It handles text PDFs and
spreadsheets on the spot; scans and photos it cannot read, and it says so and
points the user here. Keep the two in step when either one's heuristics change —
`src/lib/orderImport/foreignDoc.test.ts` covers the shared cases.

## Deliberate limits

- The script is **not** the source of truth. It gets the document readable and
  offers candidates; the Skill reads the document itself and confirms every
  field. A regex cannot tell a freight line from an item line, and it does not
  try to.
- No OCR is performed. Scans and photos are rendered to PNG and read visually,
  which handles rotation, stamps and handwriting far better than an OCR pass.
- Legacy `.xls` is not supported — re-save as `.xlsx`.
