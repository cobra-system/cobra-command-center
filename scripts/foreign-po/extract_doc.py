#!/usr/bin/env python3
"""Extract a foreign supplier's purchase document into structured JSON.

Usage:
    python3 scripts/foreign-po/extract_doc.py <path> [--outdir DIR] [--max-chars N]

Unlike the SAP exporter, foreign suppliers have no shared template: every
supplier sends its own proforma invoice / order confirmation / quotation, as a
text PDF, a scan, a photo, or an Excel sheet. So this script does NOT try to be
the source of truth. It does three things:

  1. Gets the document into something readable — text for text PDFs / Excel /
     CSV, page images for scans and photos (so the caller can read them with
     vision).
  2. Runs format-agnostic heuristics for the fields a purchase order always has
     (document number, dates, currency, incoterms, payment terms, totals, bank
     details, line items) and reports them as *candidates* with the source line
     they came from.
  3. Flags what did not reconcile in `_warnings`, and asks for a visual read via
     `_needs_vision` when the text layer is missing or too thin to trust.

The caller (the `foreign-order-import` Skill) reads `raw_text` / `page_images`
itself and treats `candidates` as hints to confirm — never as parsed truth.

Optional dependencies, each degrading gracefully: pdfminer.six (text PDFs),
PyMuPDF or poppler's pdftoppm (rendering scans), openpyxl (xlsx).
"""
import sys, os, json, re, argparse, subprocess, csv, io

# ─── Number / date helpers ───────────────────────────────────────────────────

NUM_RE = re.compile(r'(?<![\w.,])[-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?(?![\w])|(?<![\w.,])[-+]?\d+(?:[.,]\d+)?(?![\w])')


def to_number(tok):
    """Parse a money/quantity token written in any of the usual conventions.

    Handles 1,234.56 (US), 1.234,56 (EU), 1 234,56, and plain 1234. The
    separator that appears last is the decimal one; a lone separator followed by
    exactly three digits is a thousands separator.
    """
    t = tok.strip().replace(' ', '').replace(' ', '')
    if not t:
        return None
    neg = t.startswith('-')
    t = t.lstrip('+-')
    last_dot, last_comma = t.rfind('.'), t.rfind(',')
    if last_dot >= 0 and last_comma >= 0:
        dec = '.' if last_dot > last_comma else ','
        thou = ',' if dec == '.' else '.'
        t = t.replace(thou, '').replace(dec, '.')
    elif last_comma >= 0:
        frac = t[last_comma + 1:]
        t = t.replace(',', '') if len(frac) == 3 else t.replace(',', '.')
    elif last_dot >= 0:
        frac = t[last_dot + 1:]
        if len(frac) == 3 and t.count('.') >= 1 and len(t.split('.')[0]) <= 3 and t.count('.') > 1:
            t = t.replace('.', '')
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v


def to_number_variants(tok):
    """Every plausible reading of a numeric token.

    "2.400" is 2400 in Milan and 2.4 in London, and nothing in the token itself
    settles it. Both readings are returned; the line-item reconciliation picks
    the one that makes qty x price = amount come out right.
    """
    primary = to_number(tok)
    if primary is None:
        return []
    out = [primary]
    m = re.fullmatch(r'[-+]?(\d{1,3})([.,])(\d{3})', tok.strip())
    if m:
        alt = float(m.group(1) + m.group(3))
        if tok.strip().startswith('-'):
            alt = -alt
        if alt != primary:
            out.append(alt)
    return out


MONTHS = {m: i + 1 for i, m in enumerate(
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}

DATE_PATTERNS = [
    (re.compile(r'\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b'), 'ymd'),
    (re.compile(r'\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b'), 'dmy_or_mdy'),
    (re.compile(r'\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]+(\d{2,4})\b'), 'dMy'),
    (re.compile(r'\b([A-Za-z]{3,9})[-\s]+(\d{1,2})[-\s,]+(\d{2,4})\b'), 'Mdy'),
]


def _year(y):
    y = int(y)
    return y + 2000 if y < 100 else y


def parse_date(text):
    """Return (iso_date, ambiguous). ambiguous=True when dd/mm vs mm/dd can't be told apart."""
    for rx, kind in DATE_PATTERNS:
        m = rx.search(text)
        if not m:
            continue
        try:
            if kind == 'ymd':
                y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                amb = False
            elif kind == 'dmy_or_mdy':
                a, b, y = int(m.group(1)), int(m.group(2)), _year(m.group(3))
                # >12 in either slot settles it; otherwise assume day-first
                # (the convention everywhere Cobra buys except the US) and say so.
                if a > 12:
                    d, mo, amb = a, b, False
                elif b > 12:
                    d, mo, amb = b, a, False
                else:
                    d, mo, amb = a, b, True
            elif kind == 'dMy':
                d = int(m.group(1)); mo = MONTHS.get(m.group(2)[:3].lower()); y = _year(m.group(3)); amb = False
            else:
                mo = MONTHS.get(m.group(1)[:3].lower()); d = int(m.group(2)); y = _year(m.group(3)); amb = False
            if not mo or not (1 <= mo <= 12) or not (1 <= d <= 31):
                continue
            return f'{y:04d}-{mo:02d}-{d:02d}', amb
        except (ValueError, TypeError):
            continue
    return None, False


# ─── Readers ─────────────────────────────────────────────────────────────────

def read_pdf_text(path):
    try:
        from pdfminer.high_level import extract_text
    except ImportError:
        return None, ['pdfminer.six not installed — run: pip install -r scripts/foreign-po/requirements.txt']
    except BaseException as e:                               # noqa: BLE001
        # A broken cffi/cryptography install makes this import panic rather than
        # raise ImportError; say how to repair it instead of dumping a traceback.
        return None, [f'pdfminer.six failed to load ({type(e).__name__}: {e}). '
                      'Repair the environment with: pip install --force-reinstall cffi cryptography']
    try:
        return extract_text(path), []
    except Exception as e:                                   # noqa: BLE001 - report, don't crash
        return None, [f'pdfminer failed to read the PDF: {e}']


def render_pdf_images(path, outdir, max_pages=8):
    """Render PDF pages to PNG so a scan can be read visually. Best effort."""
    os.makedirs(outdir, exist_ok=True)
    base = os.path.join(outdir, os.path.splitext(os.path.basename(path))[0])
    try:
        try:
            import pymupdf                                   # PyMuPDF >= 1.24
        except ImportError:
            import fitz as pymupdf                           # older releases
        out = []
        with pymupdf.open(path) as doc:
            for i, page in enumerate(doc):
                if i >= max_pages:
                    break
                p = os.path.abspath(f'{base}-p{i + 1}.png')
                page.get_pixmap(dpi=200).save(p)
                out.append(p)
        return out, []
    except ImportError:
        pass
    except Exception as e:                                   # noqa: BLE001
        return [], [f'PyMuPDF failed to render pages: {e}']
    try:
        subprocess.run(['pdftoppm', '-png', '-r', '200', '-l', str(max_pages), path, base],
                       check=True, capture_output=True)
        d = os.path.dirname(base) or '.'
        stem = os.path.basename(base)
        return sorted(os.path.abspath(os.path.join(d, f)) for f in os.listdir(d)
                      if f.startswith(stem) and f.endswith('.png')), []
    except (OSError, subprocess.CalledProcessError) as e:
        return [], [f'could not render pages for a visual read ({e}). '
                    'Install PyMuPDF (pip install pymupdf) or poppler-utils, '
                    'or open the original file directly.']


def read_spreadsheet(path):
    """Flatten a workbook to text plus a per-sheet grid of the non-empty rows."""
    try:
        import openpyxl
    except ImportError:
        return None, None, ['openpyxl not installed — run: pip install -r scripts/foreign-po/requirements.txt']
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
    except Exception as e:                                   # noqa: BLE001
        return None, None, [f'openpyxl failed to read the workbook: {e}']
    sheets, lines = {}, []
    for ws in wb.worksheets:
        rows = []
        for row in ws.iter_rows(values_only=True):
            cells = ['' if c is None else str(c).strip() for c in row]
            if any(cells):
                rows.append(cells)
                lines.append('\t'.join(c for c in cells if c))
        if rows:
            sheets[ws.title] = rows
        lines.append('')
    return '\n'.join(lines), sheets, []


def read_delimited(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as fh:
        raw = fh.read()
    try:
        dialect = csv.Sniffer().sniff(raw[:4096])
        rows = [[c.strip() for c in r] for r in csv.reader(io.StringIO(raw), dialect)]
        rows = [r for r in rows if any(r)]
        return '\n'.join('\t'.join(r) for r in rows), {'csv': rows}
    except csv.Error:
        return raw, None


# ─── Field heuristics ────────────────────────────────────────────────────────

DOC_TYPES = [
    ('proforma_invoice', r'\bpro\s*[-\s]?forma\b|\bproforma\b|\bP/?I\b'),
    ('commercial_invoice', r'\bcommercial\s+invoice\b'),
    ('order_confirmation', r'\border\s+confirmation\b|\bsales\s+confirmation\b|\bsales\s+contract\b'),
    ('quotation', r'\bquotation\b|\bquote\b|\boffer\b'),
    ('packing_list', r'\bpacking\s+list\b'),
    ('invoice', r'\binvoice\b'),
]

# Suppliers label the same field in their own language — keep the alternations
# wide rather than adding a per-supplier template.
DOC_NUMBER_LABELS = (
    r'(?:proforma\s*(?:invoice)?|p\s*/?\s*i|pi|invoice|inv|order|purchase\s*order|p\s*/?\s*o|po|'
    r'contract|quotation|quote|offer|reference|ref|document|doc|'
    r'ordine|orden|pedido|commande|bestellung|auftrag|rechnung|factura|facture|fattura|'
    r'proforma\s*fattura|订单|发票|订单号)'
)
NUMBER_WORD = r'(?:number|no\.?|n[o°º]\.?|#|nr\.?|num\.?|№|numero|numéro|nummer)'

# label then number-word ("Invoice No: X") and number-word then label ("Nr. ordine: X")
DOC_NUMBER_RE = re.compile(
    DOC_NUMBER_LABELS + r'[\s.]*' + NUMBER_WORD + r'?\s*[:#]?\s*'
    r'([A-Za-z0-9][A-Za-z0-9\-/_.]{3,29})', re.I)
DOC_NUMBER_RE_B = re.compile(
    NUMBER_WORD + r'\s*' + DOC_NUMBER_LABELS + r'?\s*[:#]\s*'
    r'([A-Za-z0-9][A-Za-z0-9\-/_.]{3,29})', re.I)

DATE_LABEL_RE = re.compile(
    r'\b(invoice\s+date|order\s+date|issue\s+date|date\s+of\s+issue|dated|date|etd|etc|eta|'
    r'delivery\s+date|shipment\s+date|ship\s+date|validity|valid\s+until|'
    r'data|fecha|datum|dato|consegna|entrega|livraison|lieferung|日期)\b\s*[:.]?\s*(.{0,28})', re.I)

CURRENCY_RE = re.compile(r'\b(USD|EUR|GBP|CNY|RMB|JPY|ILS|NIS|CHF|TRY|INR|KRW|PLN|CZK|SEK|AUD|CAD|HKD|SGD)\b|([$€£¥₪])')
CURRENCY_BY_SYMBOL = {'$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'CNY', '₪': 'ILS'}
CURRENCY_ALIAS = {'RMB': 'CNY', 'NIS': 'ILS'}

INCOTERM_RE = re.compile(
    r'\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP|DAT)\b[\s,:-]*([A-Z][A-Za-z\-\' ]{2,28})?')

PAYMENT_RE = re.compile(
    r'\b(T\s*/\s*T|TT|L\s*/\s*C|LC|D\s*/\s*P|D\s*/\s*A|wire\s+transfer|bank\s+transfer|'
    r'advance|deposit|balance|prepay\w*|net\s*\d{1,3}\s*days?|\d{1,3}\s*%\s*(?:deposit|advance|balance|before|against|upon))',
    re.I)

TOTAL_RE = re.compile(
    r'\b(grand\s+total|total\s+amount|total\s+value|amount\s+due|total\s+due|net\s+total|'
    r'sub\s*-?\s*total|subtotal|total|totale|importo\s+totale|gesamtbetrag|gesamt|'
    r'montant\s+total|importe\s+total|total\s+général|合计|总计|总额)\b', re.I)

SWIFT_RE = re.compile(r'\b(?:SWIFT|BIC)\s*(?:CODE)?\s*[:.]?\s*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b', re.I)
IBAN_RE = re.compile(r'\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b')
ACCOUNT_RE = re.compile(r'\b(?:account|a/?c)\s*(?:number|no\.?|#)?\s*[:.]?\s*([A-Z0-9\-]{6,34})\b', re.I)
BANK_NAME_RE = re.compile(r'\b(?:bank\s*name|beneficiary\s*bank|bank)\s*[:.]?\s*([A-Za-z0-9&.,\'\- ]{4,60})', re.I)

PARTY_LABELS = {
    'seller': r'^\s*(seller|shipper|exporter|from|vendor|supplier|sold\s+by|beneficiary(?!\s+bank))\b\s*[:.]?',
    'buyer': r'^\s*(buyer|consignee|bill\s+to|sold\s+to|to|messrs\.?|importer|customer)\b\s*[:.]?',
}

# A party block ends where the next labelled field begins.
FIELD_LABEL_RE = re.compile(
    r'^\s*(terms?\b|price\s+term|payment|port\s+of|incoterm|delivery|shipment|ship\s+date|'
    r'date\b|invoice|proforma|order\s+no|contract|currency|bank|total|no\.|item|description|'
    r'validity|remark|notes?)\b', re.I)

BANK_NAME_STOPWORDS = {'details', 'detail', 'information', 'info', 'account', 'transfer', 'name'}

UNIT_RE = re.compile(r'\b(pcs?|pieces?|units?|sets?|ctns?|cartons?|kgs?|pairs?|rolls?|boxes|box|mtrs?|meters?)\b', re.I)
QTY_TOTAL_RE = re.compile(r'\b(quantity|qty|pcs?|pieces?|ctns?|cartons?|units?|sets?|packages?|gross\s+weight|net\s+weight|volume|cbm|kgs?)\b', re.I)

NOISE = re.compile(r'^[\s\-_=*.·•]+$')


def clean_lines(text):
    out = []
    for ln in (text or '').splitlines():
        ln = ln.replace(' ', ' ').rstrip()
        if ln.strip() and not NOISE.match(ln):
            out.append(ln.strip())
    return out


def first(rx, lines, group=1):
    for i, ln in enumerate(lines):
        m = rx.search(ln)
        if m:
            return {'value': (m.group(group) or '').strip(), 'line': ln, 'line_no': i}
    return None


def guess_doc_type(lines):
    head = ' | '.join(lines[:25])
    for name, pat in DOC_TYPES:
        if re.search(pat, head, re.I):
            return name
    body = ' | '.join(lines)
    for name, pat in DOC_TYPES:
        if re.search(pat, body, re.I):
            return name
    return None


def guess_doc_number(lines):
    """The supplier's own document number — the anchor for duplicate detection."""
    hits = []
    for i, ln in enumerate(lines[:60]):
        for m in list(DOC_NUMBER_RE.finditer(ln)) + list(DOC_NUMBER_RE_B.finditer(ln)):
            val = m.group(1).strip(' .:#-')
            if not re.search(r'\d', val) or len(val) < 4:
                continue                      # a number needs digits
            if re.fullmatch(r'(?:19|20)\d{2}', val):
                continue                      # a bare year is a date, not a number
            iso, _ = parse_date(val)
            if iso and re.fullmatch(r'[\d./-]+', val):
                continue                      # "03.02.2026" is the date field, not the number
            label = ln[max(0, m.start() - 0):m.start(1)].strip().lower()
            score = 10 - i * 0.1
            if re.search(r'proforma|\bp/?i\b|invoice', label):
                score += 5
            if re.search(r'\border\b|contract|\bp/?o\b', label):
                score += 3
            hits.append({'value': val, 'label': label, 'line': ln, 'line_no': i, 'score': round(score, 2)})
    hits.sort(key=lambda h: -h['score'])
    deduped, seen = [], set()
    for h in hits:
        key = h['value'].upper()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(h)
    return deduped[:6]


def guess_dates(lines):
    """Labelled dates first; then every other date in the document, unlabelled."""
    out, seen = [], set()
    for i, ln in enumerate(lines[:80]):
        for m in DATE_LABEL_RE.finditer(ln):
            iso, amb = parse_date(m.group(2))
            if iso:
                out.append({'label': m.group(1).lower(), 'value': iso, 'ambiguous_day_month': amb,
                            'line': ln, 'line_no': i})
                seen.add((i, iso))
    for i, ln in enumerate(lines[:80]):
        iso, amb = parse_date(ln)
        if iso and (i, iso) not in seen:
            out.append({'label': None, 'value': iso, 'ambiguous_day_month': amb,
                        'line': ln, 'line_no': i})
            seen.add((i, iso))
    return out


def guess_currency(lines):
    counts = {}
    for ln in lines:
        for m in CURRENCY_RE.finditer(ln):
            code = (m.group(1) or '').upper() or CURRENCY_BY_SYMBOL.get(m.group(2), '')
            code = CURRENCY_ALIAS.get(code, code)
            if code:
                counts[code] = counts.get(code, 0) + 1
    if not counts:
        return None, {}
    return max(counts, key=counts.get), counts


def guess_incoterm(lines):
    for i, ln in enumerate(lines):
        m = INCOTERM_RE.search(ln)
        if m:
            place = (m.group(2) or '').strip(' ,.-')
            return {'term': m.group(1).upper(), 'place': place or None, 'line': ln, 'line_no': i}
    return None


def guess_payment_terms(lines):
    out = []
    for i, ln in enumerate(lines):
        if PAYMENT_RE.search(ln):
            out.append({'line': ln, 'line_no': i})
    return out[:8]


def guess_parties(lines):
    parties = {}
    for role, pat in PARTY_LABELS.items():
        rx = re.compile(pat, re.I)
        for i, ln in enumerate(lines[:50]):
            m = rx.match(ln)
            if not m:
                continue
            tail = re.sub(r'^[\s:.\-]*\([^)]*\)[\s:.\-]*', '', ln[m.end():]).strip(' :.-')
            block = [tail] if tail else []
            for nxt in lines[i + 1:i + 5]:
                if FIELD_LABEL_RE.match(nxt):
                    break                       # the address block ended
                block.append(nxt)
            parties[role] = {'line_no': i, 'block': block[:5]}
            break
    # Foreign documents rarely label the seller — it is the letterhead. Hand the
    # top of the document over so the caller can read the supplier off it.
    parties['letterhead'] = [l for l in lines[:5]]
    return parties


def guess_bank(lines):
    text = '\n'.join(lines)
    out = {}
    for key, rx in (('swift', SWIFT_RE), ('iban', IBAN_RE), ('account', ACCOUNT_RE)):
        m = rx.search(text)
        if m:
            out[key] = m.group(1).strip()
    for m in BANK_NAME_RE.finditer(text):
        name = m.group(1).strip(' .:-')
        if name.lower() in BANK_NAME_STOPWORDS or len(name) < 4:
            continue                            # "Bank details:" is a heading, not a bank
        out['bank_name'] = name
        break
    return out


def guess_totals(lines):
    """Collect every labelled total, marking the ones that count pieces rather than money."""
    out = []
    for i, ln in enumerate(lines):
        m = TOTAL_RE.search(ln)
        if not m:
            continue
        nums = [n for t in NUM_RE.findall(ln) for n in to_number_variants(t)]
        if not nums:
            continue
        is_qty = bool(QTY_TOTAL_RE.search(ln))
        out.append({'label': m.group(1).lower(), 'value': max(nums), 'is_quantity': is_qty,
                    'line': ln, 'line_no': i})
    return out


# Most specific label first — "Total: 2000 PCS" must never outrank "Total Amount".
TOTAL_LABEL_PRIORITY = ['grand total', 'total amount', 'amount due', 'total due', 'total value',
                        'net total', 'total', 'sub-total', 'subtotal', 'sub total']


def pick_grand_total(totals):
    money = [t for t in totals if not t['is_quantity']]
    for label in TOTAL_LABEL_PRIORITY:
        hits = [t for t in money if t['label'].replace('  ', ' ') == label]
        if hits:
            return max(hits, key=lambda t: t['value'])
    return max(money, key=lambda t: t['value']) if money else None


def _row_numbers(line):
    """Numbers on a line that could be quantities or money.

    Skips digits that belong to a part code or a fraction — the 4410 of SR-4410,
    the 8 of 3/8" — by looking at what sits immediately before the match.
    """
    out = []
    for m in NUM_RE.finditer(line):
        start = m.start()
        prev = line[start - 1] if start > 0 else ''
        prev2 = line[start - 2] if start > 1 else ''
        if prev in '-/' and prev2.isalnum():
            continue
        vals = [v for v in to_number_variants(m.group(0)) if v > 0]
        if vals:
            out.append({'values': vals, 'value': vals[0], 'start': start, 'end': m.end()})
    return out


def _guess_code(line):
    """The item code — the first token that looks like a part number, past any row index."""
    for tok in re.findall(r'[A-Za-z0-9][A-Za-z0-9\-_/.]{2,24}', line[:60]):
        if re.fullmatch(r'\d{1,3}', tok):
            continue                                    # row index
        if re.search(r'\d', tok) and re.search(r'[A-Za-z\-_/.]', tok):
            return tok
    return None


def guess_items(lines):
    """Find line-item rows without knowing the layout.

    The layout-free signal: a purchase-order row carries three numbers that
    multiply out — qty x unit price ~ line amount. Every numeric triple on the
    line is tried and the reconciling ones are ranked by the size of the amount,
    so a stray "1/2" cannot beat the real 1200 x 3.20 = 3840. Works whether the
    columns run qty/price/total or price/qty/total, and whatever padding sits
    between them.
    """
    items = []
    for i, ln in enumerate(lines):
        nums = _row_numbers(ln)
        if len(nums) < 3:
            continue
        if TOTAL_RE.search(ln) and not UNIT_RE.search(ln):
            continue                                    # a totals row, not an item row
        best = None
        for a in range(len(nums)):
            for b in range(len(nums)):
                if a == b:
                    continue
                for c in range(len(nums)):
                    if c in (a, b):
                        continue
                    for qty in nums[a]['values']:
                        for price in nums[b]['values']:
                            for amount in nums[c]['values']:
                                if amount < price or amount < qty:
                                    continue            # the amount is the largest of the three
                                err = abs(qty * price - amount) / amount
                                if err > 0.015:
                                    continue
                                cand = {'qty': qty, 'unit_price': price, 'line_total': amount,
                                        'error': round(err, 5), 'spans': (nums[a], nums[b], nums[c]),
                                        'rightmost': nums[c]['start'] > max(nums[a]['start'], nums[b]['start'])}
                                if best is None or (amount, cand['rightmost'], -err) > (best['line_total'], best['rightmost'], -best['error']):
                                    best = cand
        if not best:
            continue
        # Description = the line minus the three numbers we consumed, minus the row index.
        desc = ln
        for span in sorted(best['spans'], key=lambda sp: -sp['start']):
            desc = desc[:span['start']] + ' ' + desc[span['end']:]
        desc = re.sub(r'^\s*\d{1,3}[).\s]\s*', '', desc)
        desc = re.sub(r'\s{2,}', ' ', desc).strip(' |\t-·')
        items.append({'line_no': i, 'code': _guess_code(ln), 'description': desc or None,
                      'qty': best['qty'], 'unit_price': best['unit_price'],
                      'line_total': best['line_total'], 'reconcile_error': best['error'],
                      'line': ln})
    return items


# ─── Main ────────────────────────────────────────────────────────────────────

def analyse(text, sheets=None, thin_text=False):
    lines = clean_lines(text)
    currency, currency_counts = guess_currency(lines)
    items = guess_items(lines)
    totals = guess_totals(lines)
    warnings = []

    if not items and not thin_text:
        warnings.append('no line items could be reconciled from the text — read the document yourself '
                        'and build the item list by hand.')
    items_sum = round(sum(i['line_total'] for i in items), 2) if items else None
    grand_row = pick_grand_total(totals)
    grand = grand_row['value'] if grand_row else None
    if items_sum is not None and grand is not None and grand > 0:
        if abs(items_sum - grand) / grand > 0.02:
            warnings.append(f'line items sum to {items_sum} but the document total reads {grand} — '
                            'the item list is probably incomplete or a discount/freight line was missed.')
    if not currency and not thin_text:
        warnings.append('no currency found — confirm it with the user before creating the order.')

    dates = guess_dates(lines)
    if any(d.get('ambiguous_day_month') for d in dates):
        warnings.append('at least one date is ambiguous (dd/mm vs mm/dd) — it was read day-first; confirm it.')

    return {
        'document_type': guess_doc_type(lines),
        'candidates': {
            'document_number': guess_doc_number(lines),
            'dates': dates,
            'currency': currency,
            'currency_mentions': currency_counts,
            'incoterm': guess_incoterm(lines),
            'payment_terms': guess_payment_terms(lines),
            'parties': guess_parties(lines),
            'bank_details': guess_bank(lines),
            'totals': totals,
            'grand_total': grand_row,
            'items_sum': items_sum,
        },
        'items': items,
        'sheets': sheets,
        'lines': lines,
        '_warnings': warnings,
    }


def main():
    ap = argparse.ArgumentParser(description='Extract a foreign supplier purchase document into JSON.')
    ap.add_argument('path')
    ap.add_argument('--outdir', default=None, help='where to write rendered page images (default: alongside the file)')
    ap.add_argument('--max-chars', type=int, default=60000, help='cap on raw_text in the JSON output')
    args = ap.parse_args()

    path = args.path
    if not os.path.exists(path):
        print(json.dumps({'_error': f'file not found: {path}'}, ensure_ascii=False))
        return 1

    ext = os.path.splitext(path)[1].lower()
    outdir = args.outdir or os.path.join(os.path.dirname(os.path.abspath(path)), 'pages')
    result = {'source_file': os.path.abspath(path), 'source_kind': None,
              'page_images': [], '_needs_vision': False, '_warnings': []}
    text, sheets = None, None

    if ext == '.pdf':
        result['source_kind'] = 'pdf'
        text, warns = read_pdf_text(path)
        result['_warnings'] += warns
        readable = len(re.sub(r'\s', '', text or ''))
        if readable < 120:
            result['_needs_vision'] = True
            result['_warnings'].append(
                f'the PDF has little or no text layer ({readable} characters) — treat it as a scan '
                'and read the rendered page images visually.')
            imgs, warns = render_pdf_images(path, outdir)
            result['page_images'] = imgs
            result['_warnings'] += warns
    elif ext in ('.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.heic', '.bmp'):
        result['source_kind'] = 'image'
        result['page_images'] = [os.path.abspath(path)]
        result['_needs_vision'] = True
        result['_warnings'].append('image document — read it visually; there is no text to parse.')
    elif ext in ('.xlsx', '.xlsm', '.xltx'):
        result['source_kind'] = 'spreadsheet'
        text, sheets, warns = read_spreadsheet(path)
        result['_warnings'] += warns
    elif ext in ('.csv', '.tsv'):
        result['source_kind'] = 'delimited'
        text, sheets = read_delimited(path)
    elif ext in ('.txt', '.eml', '.md', '.htm', '.html'):
        result['source_kind'] = 'text'
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            text = fh.read()
        if ext in ('.htm', '.html'):
            text = re.sub(r'<[^>]+>', ' ', text)
    elif ext == '.xls':
        result['source_kind'] = 'spreadsheet'
        result['_warnings'].append('legacy .xls is not supported — re-save it as .xlsx and run again.')
    else:
        result['source_kind'] = 'unknown'
        result['_warnings'].append(f'unrecognised extension "{ext}" — trying to read it as plain text.')
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as fh:
                text = fh.read()
        except OSError as e:
            result['_warnings'].append(f'could not read the file: {e}')

    if text:
        # A scan's stray text layer is noise — don't warn about what it fails to yield.
        analysis = analyse(text, sheets, thin_text=result['_needs_vision'])
        result['_warnings'] += analysis.pop('_warnings')
        result.update(analysis)
        result['raw_text'] = text[:args.max_chars]
        result['raw_text_truncated'] = len(text) > args.max_chars
    else:
        result['document_type'] = None
        result['candidates'] = {}
        result['items'] = []
        result['lines'] = []
        result['raw_text'] = ''
        if not result['_needs_vision'] and result['source_kind'] != 'image':
            result['_warnings'].append('no text could be extracted from this file.')

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
