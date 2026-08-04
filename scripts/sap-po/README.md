# SAP Purchase-Order Import

Tooling to bring purchase orders exported from SAP (Hebrew RTL PDFs) into the
Cobra orders system.

## Files

- `extract_po.py` — parses a SAP PO PDF into structured JSON (PO number, supplier
  + VAT, line items with code/qty/price, totals). Dates are ISO-normalised so the
  output feeds straight into the `create_order` MCP tool. Emits a `_warnings`
  array when the arithmetic doesn't reconcile.
- `requirements.txt` — Python dependency (`pdfminer.six`).

## Usage

```bash
pip install -r scripts/sap-po/requirements.txt
python3 scripts/sap-po/extract_po.py path/to/po.pdf
```

The end-to-end import flow (parse → match supplier/products → preview → confirm →
create the order) is driven by the **`sap-order-import`** Skill in
`.claude/skills/sap-order-import/`. Run that skill in a Claude Code / Cowork
session and upload the PO; this script is the parsing step it relies on.

## Template note

The parser targets Cobra's fixed SAP PO layout. If SAP's export layout changes,
adjust the x-band column boundaries in the `band()` function of `extract_po.py`.
The `_warnings` output is designed to catch such drift (e.g. "no line items
parsed") rather than fail silently.
