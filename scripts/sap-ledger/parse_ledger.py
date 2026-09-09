#!/usr/bin/env python3
"""Parse a SAP item-ledger export (כרטסת פריטים) into structured monthly movement data.

Reads the raw export and emits JSON on stdout: per product, per month, per
warehouse — units sold, returned, transferred and adjusted, plus a balance
reconciliation and warnings.

The export is *not* a real .xls despite the extension: SAP writes UTF-16LE
tab-separated text. .xlsx and plain CSV/TSV are accepted too.

Usage:
    python3 scripts/sap-ledger/parse_ledger.py <file> [--json-only]
"""
from __future__ import annotations

import argparse
import calendar
import csv
import io
import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime

# ── SAP document prefixes ────────────────────────────────────────────────────
# Only תמ (delivery note) and חש (invoice) are actual sales out of stock.
SALES_DOCS = {"תמ", "חש"}
RETURN_DOCS = {"הח", "חז", "כמ"}
TRANSFER_DOCS = {"מח"}
ADJUSTMENT_DOCS = {"ימ"}

COLUMNS = {
    "תאריך אסמכתא": "date",
    "מסמך": "doc",
    "שורה במסמך": "doc_line",
    "מחסן": "warehouse",
    "קוד ח-ן/כרטיס": "account_code",
    "שם ח-ן/כרטיס": "account_name",
    "יחידת מידה של מלאי": "uom",
    "כמות": "qty",
    "מחיר לאחר הנחה": "price",
    "יתרה": "balance",
}


def read_rows(path: str) -> list[list[str]]:
    """Return the sheet as a list of string rows, whatever the container is."""
    if path.lower().endswith((".xlsx", ".xlsm")):
        import openpyxl  # optional dependency, only needed for real xlsx

        ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
        return [["" if c is None else str(c) for c in row]
                for row in ws.iter_rows(values_only=True)]

    with open(path, "rb") as fh:
        raw = fh.read()
    for encoding in ("utf-16", "utf-8-sig", "cp1255"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit(f"cannot decode {path} as utf-16/utf-8/cp1255")

    # SAP does not quote consistently (names contain stray double quotes), so
    # read the delimiter literally rather than letting csv interpret quotes.
    delimiter = "\t" if "\t" in text.split("\n", 1)[0] else ","
    return list(csv.reader(io.StringIO(text), delimiter=delimiter,
                           quoting=csv.QUOTE_NONE))


def to_number(value: str) -> float | None:
    value = (value or "").replace(",", "").strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def clean(value: str) -> str:
    return (value or "").strip().strip('"').replace('""', '"').strip()


def parse_date(value: str) -> date | None:
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def doc_prefix(doc: str) -> str:
    parts = doc.split()
    return parts[0] if parts else ""


def parse(path: str) -> dict:
    rows = read_rows(path)
    if not rows:
        raise SystemExit("empty file")

    header = [clean(c) for c in rows[0]]
    idx = {COLUMNS[label]: i for i, label in enumerate(header) if label in COLUMNS}
    missing = {"date", "doc", "warehouse", "qty", "balance"} - set(idx)
    if missing:
        raise SystemExit(f"unexpected ledger layout, missing columns: {sorted(missing)}")

    def cell(row: list[str], key: str) -> str:
        i = idx.get(key)
        return clean(row[i]) if i is not None and i < len(row) else ""

    products: list[dict] = []
    current: dict | None = None

    for row in rows[1:]:
        if not any(clean(c) for c in row):
            continue
        movement_date = parse_date(cell(row, "date"))
        qty = to_number(cell(row, "qty"))

        if movement_date is None or qty is None:
            # Product banner ("Z4K | name | opening balance") or closing-balance row.
            values = [clean(c) for c in row if clean(c)]
            balance = to_number(cell(row, "balance"))
            if len(values) >= 2 and balance is not None:
                current = {
                    "product_code": values[0],
                    "product_name": values[1] if len(values) > 2 else "",
                    "opening_balance": balance,
                    "movements": [],
                }
                products.append(current)
            elif current is not None and balance is not None:
                current["closing_balance"] = balance
            continue

        if current is None:  # ledger without a product banner
            current = {"product_code": "", "product_name": "",
                       "opening_balance": None, "movements": []}
            products.append(current)

        current["movements"].append({
            "date": movement_date,
            "doc": cell(row, "doc"),
            "warehouse": cell(row, "warehouse"),
            "account_code": cell(row, "account_code"),
            "account_name": cell(row, "account_name"),
            "qty": qty,
            "balance": to_number(cell(row, "balance")),
        })

    return {"source_file": path, "products": [summarize(p) for p in products]}


def summarize(product: dict) -> dict:
    movements = product["movements"]
    warnings: list[str] = []

    if not movements:
        return {**{k: v for k, v in product.items() if k != "movements"},
                "movement_count": 0, "warnings": ["no movement rows parsed"]}

    dates = [m["date"] for m in movements]
    first_date, last_date = min(dates), max(dates)

    # ── balance reconciliation ───────────────────────────────────────────────
    net = sum(m["qty"] for m in movements)
    opening = product.get("opening_balance")
    closing = product.get("closing_balance")
    if closing is None:
        closing = movements[-1]["balance"]
    reconciled = None
    if opening is not None and closing is not None:
        reconciled = abs((opening + net) - closing) < 0.5
        if not reconciled:
            warnings.append(
                f"balance does not reconcile: opening {opening:.0f} + net {net:+.0f} "
                f"!= closing {closing:.0f} — the export may be truncated")

    # ── partial-month detection ──────────────────────────────────────────────
    # A month whose data stops before its last day understates consumption and
    # must never be charted or imported as a whole month.
    last_month = f"{last_date:%Y-%m}"
    last_day_of_month = calendar.monthrange(last_date.year, last_date.month)[1]
    partial_months = []
    if last_date.day < last_day_of_month:
        partial_months.append(last_month)
        warnings.append(
            f"{last_month} is partial — ledger ends {last_date:%d/%m/%Y}, "
            f"month ends on day {last_day_of_month}. Do not import it as a full month.")

    # ── aggregation ──────────────────────────────────────────────────────────
    by_month_wh: dict[tuple[str, str], dict[str, float]] = defaultdict(
        lambda: {"sold": 0.0, "returned": 0.0, "transferred_in": 0.0,
                 "transferred_out": 0.0, "adjusted": 0.0, "transactions": 0})
    doc_types: dict[str, dict[str, float]] = defaultdict(lambda: {"rows": 0, "units": 0.0})
    transfers: dict[tuple[str, str], float] = defaultdict(float)
    customers: dict[str, dict] = defaultdict(lambda: {"units": 0.0, "warehouses": set()})
    unknown_docs: set[str] = set()

    # Transfers appear twice (out of one warehouse, into another) under the same
    # document number — pair them up to reconstruct the movement network.
    transfer_legs: dict[str, dict[str, list[str]]] = defaultdict(
        lambda: {"from": [], "to": []})

    for m in movements:
        month = f"{m['date']:%Y-%m}"
        prefix = doc_prefix(m["doc"])
        bucket = by_month_wh[(month, m["warehouse"])]
        bucket["transactions"] += 1
        doc_types[prefix]["rows"] += 1
        doc_types[prefix]["units"] += abs(m["qty"])

        if prefix in SALES_DOCS:
            if m["qty"] < 0:
                bucket["sold"] += -m["qty"]
                entry = customers[m["account_name"] or "(ללא שם)"]
                entry["units"] += -m["qty"]
                entry["warehouses"].add(m["warehouse"])
            else:
                bucket["returned"] += m["qty"]
        elif prefix in RETURN_DOCS:
            bucket["returned"] += abs(m["qty"])
        elif prefix in TRANSFER_DOCS:
            if m["qty"] < 0:
                bucket["transferred_out"] += -m["qty"]
                transfer_legs[m["doc"]]["from"].append(m["warehouse"])
            else:
                bucket["transferred_in"] += m["qty"]
                transfer_legs[m["doc"]]["to"].append(m["warehouse"])
        elif prefix in ADJUSTMENT_DOCS:
            bucket["adjusted"] += m["qty"]
        else:
            unknown_docs.add(prefix)

    for doc, legs in transfer_legs.items():
        if len(legs["from"]) == 1 and len(legs["to"]) == 1:
            transfers[(legs["from"][0], legs["to"][0])] += 1

    if unknown_docs:
        warnings.append(
            "unclassified document types (counted nowhere): "
            + ", ".join(sorted(unknown_docs))
            + " — classify them in parse_ledger.py before importing")

    adjustment_units = sum(abs(v["adjusted"]) for v in by_month_wh.values())
    if adjustment_units:
        warnings.append(
            f"{adjustment_units:.0f} units moved on stock-adjustment documents "
            f"({'/'.join(sorted(ADJUSTMENT_DOCS))}) — excluded from sales, review them")

    months = sorted({month for month, _ in by_month_wh})
    warehouses = sorted({wh for _, wh in by_month_wh})

    monthly = []
    for month in months:
        per_wh = {}
        for wh in warehouses:
            values = by_month_wh.get((month, wh))
            if values and any(v for k, v in values.items() if k != "transactions"):
                per_wh[wh] = {k: round(v, 2) if isinstance(v, float) else v
                              for k, v in values.items()}
        monthly.append({
            "month": month,
            "partial": month in partial_months,
            "total_sold": round(sum(v["sold"] for v in per_wh.values()), 2),
            "by_warehouse": per_wh,
        })

    top_customers = sorted(customers.items(), key=lambda kv: kv[1]["units"], reverse=True)

    return {
        "product_code": product.get("product_code", ""),
        "product_name": product.get("product_name", ""),
        "period": {"from": first_date.isoformat(), "to": last_date.isoformat()},
        "opening_balance": product.get("opening_balance"),
        "closing_balance": closing,
        "net_movement": round(net, 2),
        "reconciled": reconciled,
        "movement_count": len(movements),
        "total_sold": round(sum(m["total_sold"] for m in monthly), 2),
        "partial_months": partial_months,
        "warehouses": warehouses,
        "doc_types": {k: {"rows": v["rows"], "units": round(v["units"], 2)}
                      for k, v in sorted(doc_types.items())},
        "transfer_routes": [{"from": f, "to": t, "documents": int(n)}
                            for (f, t), n in sorted(transfers.items(),
                                                    key=lambda kv: -kv[1])],
        "top_customers": [{"name": name, "units": round(v["units"], 2),
                           "warehouses": len(v["warehouses"])}
                          for name, v in top_customers[:25]],
        "monthly": monthly,
        "warnings": warnings,
    }


def print_report(result: dict) -> None:
    for p in result["products"]:
        print(f"\n{'='*72}")
        print(f"{p['product_code']}  {p['product_name']}")
        print(f"{'='*72}")
        print(f"period          : {p['period']['from']} → {p['period']['to']}")
        print(f"movements       : {p['movement_count']:,}")
        print(f"balance         : {p['opening_balance']:,.0f} "
              f"{p['net_movement']:+,.0f} = {p['closing_balance']:,.0f}"
              f"   [{'OK' if p['reconciled'] else 'MISMATCH'}]")
        print(f"units sold      : {p['total_sold']:,.0f}")
        print(f"doc types       : " + ", ".join(
            f"{k}={v['rows']}" for k, v in p["doc_types"].items()))
        print(f"\n{'month':10}{'sold':>9}  by warehouse")
        for m in p["monthly"]:
            flag = "  ← PARTIAL" if m["partial"] else ""
            top = sorted(m["by_warehouse"].items(),
                         key=lambda kv: -kv[1]["sold"])[:6]
            detail = "  ".join(f"{wh}:{v['sold']:.0f}" for wh, v in top if v["sold"])
            print(f"{m['month']:10}{m['total_sold']:>9,.0f}  {detail}{flag}")
        if p["warnings"]:
            print("\nwarnings:")
            for w in p["warnings"]:
                print(f"  ! {w}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("file", help="the SAP ledger export")
    ap.add_argument("--json-only", action="store_true",
                    help="emit JSON only, no human-readable report")
    args = ap.parse_args()

    result = parse(args.file)
    if args.json_only:
        json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
        print()
    else:
        print_report(result)


if __name__ == "__main__":
    main()
