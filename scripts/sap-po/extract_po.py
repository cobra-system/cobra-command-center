#!/usr/bin/env python3
"""Extract a Cobra/SAP purchase-order PDF into structured JSON.

Usage:
    python3 scripts/sap-po/extract_po.py <path-to-po.pdf>

Emits JSON on stdout with: po_number, supplier_name, supplier_vat, order_date,
payment_terms, agent, notes, subtotal, vat_rate, vat_amount, total, and items[]
(code, mfr_sku, description, delivery_date, qty, unit_price, line_total).

Dates are normalised to ISO (YYYY-MM-DD) so the output feeds straight into the
`create_order` MCP tool. `_warnings` is non-empty when the arithmetic does not
reconcile (line-item sum vs subtotal, subtotal*VAT vs total) — always surface it.

This targets the fixed SAP purchase-order template that Cobra exports (Hebrew,
right-to-left). Requires pdfminer.six (see requirements.txt).
"""
import sys, json, re
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextLineHorizontal, LTTextContainer

HEB = re.compile(r'[֐-׿]')


def fix(s):
    """De-reverse visual RTL text and repair the נ->ð font glitch."""
    s = s.replace('ð', 'נ')
    # pdfminer emits Hebrew glyphs in visual order; reverse to logical order.
    if HEB.search(s):
        return s[::-1]
    return s


def collect(pdf_path):
    lines = []
    for page in extract_pages(pdf_path):
        def walk(o):
            for el in o:
                if isinstance(el, LTTextLineHorizontal):
                    t = el.get_text().strip()
                    if t:
                        lines.append({'y': round(el.y0), 'x0': round(el.x0),
                                      'x1': round(el.x1), 'raw': t, 'norm': fix(t)})
                elif isinstance(el, LTTextContainer):
                    walk(el)
        walk(page)
        break  # page 1 holds the order; extend here for multi-page bodies
    return lines


def label_y(lines, needle):
    for ln in lines:
        if needle in ln['norm']:
            return ln['y']
    return None


def row_tokens(lines, y, tol=4):
    return [l for l in lines if abs(l['y'] - y) <= tol]


def iso(d):
    """DD/MM/YY(YY) -> YYYY-MM-DD (SAP prints day/month/year)."""
    if not d:
        return None
    m = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', d)
    if not m:
        return None
    dd, mm, yy = m.groups()
    yy = ('20' + yy) if len(yy) == 2 else yy
    return f"{yy}-{int(mm):02d}-{int(dd):02d}"


def num(s):
    s = s.replace(',', '').replace('₪', '').strip()
    try:
        return float(s)
    except ValueError:
        return None


def parse(pdf_path):
    lines = collect(pdf_path)
    out = {'source': pdf_path.split('/')[-1], 'items': []}

    # --- header scalars -------------------------------------------------
    m = re.search(r'\b(\d{9})\b', ' '.join(l['raw'] for l in lines))
    out['supplier_vat'] = m.group(1) if m else None

    # supplier name: widest Hebrew token on the "לכבוד" row
    y = label_y(lines, 'לכבוד')
    if y is not None:
        cands = [l for l in row_tokens(lines, y) if 'לכבוד' not in l['norm'] and HEB.search(l['norm'])]
        if cands:
            out['supplier_name'] = re.sub(r'\s+', ' ', max(cands, key=lambda l: l['x1'] - l['x0'])['norm']).strip()

    # order number: numeric token on the "הזמנת רכש" title row
    y = label_y(lines, 'הזמנת רכש')
    if y is not None:
        for l in row_tokens(lines, y):
            if re.fullmatch(r'\d{4,8}', l['raw']):
                out['po_number'] = l['raw']
                break

    # order date
    y = label_y(lines, 'תאריך')
    if y is not None:
        for l in row_tokens(lines, y):
            if re.fullmatch(r'\d{1,2}/\d{1,2}/\d{2,4}', l['raw']):
                out['order_date'] = iso(l['raw']); break

    # payment terms (שוטף+90 etc.)
    y = label_y(lines, 'תנאי תשלום')
    if y is not None:
        parts = [l['norm'] for l in row_tokens(lines, y) if 'תנאי' not in l['norm']]
        if parts:
            out['payment_terms'] = ''.join(reversed(parts)).replace(' ', '')

    # agent
    y = label_y(lines, 'סוכן')
    if y is not None:
        parts = [l['norm'] for l in row_tokens(lines, y) if 'סוכן' not in l['norm'] and HEB.search(l['norm'])]
        if parts:
            out['agent'] = ' '.join(parts)

    # free-text comment line SAP prints above the totals: "הזמנה עבור מחסן מרכזי",
    # "הזמנה לתל אביב תוצרת הארץ 15". Join the whole row right-to-left so a trailing
    # house number in its own token is not lost, and stay out of the totals columns.
    for l in lines:
        n = l['norm'].strip()
        if n.startswith('הזמנה') and 'הזמנת רכש' not in n:
            row = [t for t in row_tokens(lines, l['y'], tol=3) if t['x0'] >= 258]
            row.sort(key=lambda t: -t['x1'])
            out['notes'] = ' '.join(t['norm'].strip() for t in row if t['norm'].strip())
            break

    # totals
    def total_near(label):
        yy = label_y(lines, label)
        if yy is None:
            return None
        vals = [v for l in row_tokens(lines, yy) if (v := num(l['raw'])) and v > 1]
        return max(vals) if vals else None
    out['subtotal'] = total_near('חייב מע"מ')
    for l in lines:
        if re.fullmatch(r'\d{1,2}\.\d{2}', l['raw']) and 15 <= (num(l['raw']) or 0) <= 20:
            out['vat_rate'] = num(l['raw']); break
    # grand total: largest properly money-formatted value (thousands comma or .dd)
    money = re.compile(r'^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d+\.\d{2}$')
    monies = [v for l in lines if money.fullmatch(l['raw'].replace('₪', '').strip()) and (v := num(l['raw']))]
    out['vat_amount'] = round(out['subtotal'] * out['vat_rate'] / 100, 2) \
        if out.get('subtotal') and out.get('vat_rate') else None
    out['total'] = max(monies) if monies else None

    # --- line items -----------------------------------------------------
    # item rows carry a small integer in the '#' column (x0 >= 560), above the totals.
    hdr_y = label_y(lines, 'קוד פריט')
    item_rows = sorted({l['y'] for l in lines
                        if l['x0'] >= 560 and re.fullmatch(r'\d{1,3}', l['raw'])
                        and (hdr_y is None or l['y'] < hdr_y)}, reverse=True)

    # x-band boundaries (right→left): #, code, mfr_sku, desc, deliv/qty, price, total
    def band(x):
        if x >= 560: return 'idx'
        if x >= 505: return 'code'
        if x >= 450: return 'mfr_sku'
        if x >= 258: return 'desc'
        if x >= 168: return 'deliv_or_qty'
        if x >= 115: return 'price'
        return 'total'

    for iy in item_rows:
        toks = row_tokens(lines, iy, tol=3)
        item = {'code': None, 'mfr_sku': None, 'description': None,
                'delivery_date': None, 'qty': None, 'unit_price': None, 'line_total': None}
        desc, mid = [], []
        for t in sorted(toks, key=lambda l: -l['x0']):
            b = band((t['x0'] + t['x1']) / 2)
            if b == 'code' and re.search(r'\w', t['raw']): item['code'] = t['raw']
            elif b == 'mfr_sku': item['mfr_sku'] = t['raw']
            elif b == 'desc': desc.append(t['norm'])
            elif b == 'deliv_or_qty': mid.append(t)
            elif b == 'price': item['unit_price'] = num(t['raw'])
            elif b == 'total': item['line_total'] = num(t['raw'])
        item['description'] = ' '.join(desc) if desc else None
        for t in mid:
            if re.fullmatch(r'\d{1,2}/\d{1,2}/\d{2,4}', t['raw']):
                item['delivery_date'] = iso(t['raw'])
            elif num(t['raw']) is not None:
                item['qty'] = num(t['raw'])
        if item['code'] or item['line_total']:
            out['items'].append(item)

    # --- validation -----------------------------------------------------
    warn = []
    s = sum(i['line_total'] or 0 for i in out['items'])
    if out.get('subtotal') and abs(s - out['subtotal']) > 0.5:
        warn.append(f"line-item sum {s} != subtotal {out['subtotal']}")
    if out.get('subtotal') and out.get('vat_rate') and out.get('total'):
        exp = round(out['subtotal'] * (1 + out['vat_rate'] / 100), 2)
        if abs(exp - out['total']) > 1:
            warn.append(f"subtotal*VAT {exp} != total {out['total']}")
    if not out['items']:
        warn.append("no line items parsed — template may have changed")
    out['_warnings'] = warn
    return out


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("usage: extract_po.py <path-to-po.pdf>", file=sys.stderr)
        sys.exit(2)
    print(json.dumps(parse(sys.argv[1]), ensure_ascii=False, indent=2))
