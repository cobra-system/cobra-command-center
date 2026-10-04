/**
 * Consumption & reorder analysis of an item ledger (כרטסת פריט).
 *
 * Consumption = shipments to customers (תמ) + stock issues (ימ) − customer
 * returns (הח / חז). Transfers between warehouses (מח), supplier receipts and
 * supplier returns move stock but are not consumption. Weeks start on Sunday.
 */

export type MovementKind =
  | "sale" | "issue" | "customer_return" | "transfer"
  | "receipt" | "supplier_return" | "adjustment" | "other";

export interface AnalysisMovement {
  movement_date: string; // YYYY-MM-DD
  line_no: number;
  doc_type: string;
  warehouse_code: string | null;
  account_code: string | null;
  account_name: string | null;
  quantity: number;
}

export interface LedgerInput {
  movements: AnalysisMovement[];
  opening_balance: number;
  closing_balance: number;
  period_start: string;
  period_end: string;
}

export const KIND_META: Record<MovementKind, { label: string; role: "out" | "offset" | "none" | "in" | "check" }> = {
  sale: { label: "תעודת משלוח ללקוח", role: "out" },
  issue: { label: "יציאה מהמלאי", role: "out" },
  customer_return: { label: "החזרה מלקוח", role: "offset" },
  transfer: { label: "העברה בין מחסנים", role: "none" },
  receipt: { label: "קבלה מהספק", role: "in" },
  supplier_return: { label: "החזרה / זיכוי מול ספק", role: "check" },
  adjustment: { label: "עדכון כמות ידני", role: "check" },
  other: { label: "מסמך אחר", role: "check" },
};

export function classifyDoc(docType: string): MovementKind {
  switch (docType) {
    case "תמ": return "sale";
    case "ימ": return "issue";
    case "הח":
    case "חז": return "customer_return";
    case "מח": return "transfer";
    case "קנ":
    case "מר": return "receipt";
    case "הר":
    case "זר": return "supplier_return";
    case "כמ": return "adjustment";
    default: return "other";
  }
}

const isConsumption = (k: MovementKind) => k === "sale" || k === "issue" || k === "customer_return";

// ── date helpers (UTC, day precision) ─────────────────────────
const DAY = 86_400_000;
const toMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const weekStart = (d: string) => { const ms = toMs(d); return fromMs(ms - new Date(ms).getUTCDay() * DAY); };
const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY);
const dayOfWeek = (d: string) => new Date(toMs(d)).getUTCDay();
const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);

// ── stats ─────────────────────────────────────────────────────
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stdev(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

export interface WeekPoint {
  week: string; // Sunday YYYY-MM-DD
  demand: number;
  balance: number; // total balance at end of week
  receipts: number;
  full: boolean; // counts toward the statistics
  ma4: number | null;
}

export interface MonthRow {
  month: string; // YYYY-MM
  topCustomer: number;
  others: number;
  shipped: number;
  returned: number;
  net: number;
  partial: boolean;
}

export interface DocTypeRow { doc_type: string; kind: MovementKind; rows: number; net: number }
export interface CustomerRow { name: string; units: number; share: number }
export interface ReceiptRow { date: string; quantity: number; doc_type: string; account_name: string | null }
export interface WarehouseRow { code: string; net: number; min: number; minDate: string | null; consumption: number }
export interface RateOption { key: string; label: string; rate: number }
export interface LedgerNote { title: string; body: string; severity: "warn" | "info" }

export interface LedgerAnalysis {
  netConsumption: number;
  shipped: number;
  returned: number;
  returnRate: number;
  weeks: WeekPoint[];
  fullWeekCount: number;
  weeklyMean: number;
  weeklyMedian: number;
  weeklySd: number;
  monthlyRate: number;
  annualRate: number;
  months: MonthRow[];
  docTypes: DocTypeRow[];
  customers: CustomerRow[];
  topCustomer: CustomerRow | null;
  receipts: ReceiptRow[];
  warehouses: WarehouseRow[];
  minBalance: { value: number; date: string } | null;
  rates: RateOption[];
  defaultRateKey: string;
  analysisStart: string;
  isLaunch: boolean;
  closingBalance: number;
  coverWeeks: number | null;
}

export function analyzeLedger(input: LedgerInput): LedgerAnalysis {
  const movements = [...input.movements].sort((a, b) =>
    a.movement_date === b.movement_date ? a.line_no - b.line_no : a.movement_date.localeCompare(b.movement_date));
  const { period_start, period_end, opening_balance, closing_balance } = input;

  // ── per-movement aggregates ─────────────────────────────────
  let shipped = 0, returned = 0;
  const docMap = new Map<string, DocTypeRow>();
  const custMap = new Map<string, number>();
  const whMap = new Map<string, { net: number; min: number; minDate: string | null; consumption: number }>();
  const receipts: ReceiptRow[] = [];
  let running = opening_balance;
  let minBalance: { value: number; date: string } | null = null;
  let firstConsumption: string | null = null;

  for (const m of movements) {
    const kind = classifyDoc(m.doc_type);
    const d = docMap.get(m.doc_type) ?? { doc_type: m.doc_type, kind, rows: 0, net: 0 };
    d.rows++; d.net += m.quantity; docMap.set(m.doc_type, d);

    if (isConsumption(kind)) {
      const units = -m.quantity;
      if (kind === "customer_return") returned += m.quantity; else shipped += -m.quantity;
      const name = m.account_name || m.account_code || "ללא לקוח";
      custMap.set(name, (custMap.get(name) ?? 0) + units);
      if (!firstConsumption && units > 0) firstConsumption = m.movement_date;
    }
    if (kind === "receipt" && m.quantity > 0) {
      receipts.push({ date: m.movement_date, quantity: m.quantity, doc_type: m.doc_type, account_name: m.account_name });
    }

    const code = m.warehouse_code || "—";
    const w = whMap.get(code) ?? { net: 0, min: 0, minDate: null, consumption: 0 };
    w.net += m.quantity;
    if (isConsumption(kind)) w.consumption += -m.quantity;
    if (w.net < w.min) { w.min = w.net; w.minDate = m.movement_date; }
    whMap.set(code, w);

    // Transfers net to zero but their out-line is booked before the in-line,
    // so leave them out of the running total used for the low point.
    if (kind !== "transfer") {
      running += m.quantity;
      if (!minBalance || running < minBalance.value) minBalance = { value: running, date: m.movement_date };
    }
  }
  const netConsumption = shipped - returned;

  // ── customers ───────────────────────────────────────────────
  const customers = [...custMap.entries()]
    .map(([name, units]) => ({ name, units, share: netConsumption > 0 ? units / netConsumption : 0 }))
    .filter(c => c.units !== 0)
    .sort((a, b) => b.units - a.units);
  const topCustomer = customers[0] ?? null;

  // ── weekly series ───────────────────────────────────────────
  // A product launched mid-period starts its statistics at the first sale;
  // an established one (first sale within two weeks of the period start)
  // keeps the whole period so slow early weeks count as zeros.
  const isLaunch = !!firstConsumption && daysBetween(period_start, firstConsumption) > 14;
  const analysisStart = isLaunch ? firstConsumption! : period_start;

  const weeks: WeekPoint[] = [];
  const firstWeek = weekStart(analysisStart);
  const lastWeek = weekStart(period_end);
  let bal = opening_balance;
  let mi = 0;
  // roll the balance forward over movements before the analysis window
  while (mi < movements.length && movements[mi].movement_date < firstWeek) bal += movements[mi++].quantity;
  for (let w = firstWeek; w <= lastWeek; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    let demand = 0, rec = 0;
    while (mi < movements.length && movements[mi].movement_date <= end) {
      const m = movements[mi++];
      const kind = classifyDoc(m.doc_type);
      if (isConsumption(kind)) demand += -m.quantity;
      if (kind === "receipt" && m.quantity > 0) rec += m.quantity;
      bal += m.quantity;
    }
    const full = !(w === firstWeek && dayOfWeek(analysisStart) !== 0) && !(w === lastWeek && dayOfWeek(period_end) !== 6);
    weeks.push({ week: w, demand, balance: bal, receipts: rec, full, ma4: null });
  }
  weeks.forEach((wk, i) => {
    if (i >= 3) wk.ma4 = mean(weeks.slice(i - 3, i + 1).map(x => x.demand));
  });

  const fullDemand = weeks.filter(w => w.full).map(w => w.demand);
  const weeklyMean = mean(fullDemand);
  const weeklySd = stdev(fullDemand);

  // ── planning rates ──────────────────────────────────────────
  const rates: RateOption[] = [{ key: "all", label: "כל התקופה", rate: round1(weeklyMean) }];
  for (const n of [26, 13, 4]) {
    if (fullDemand.length > n) rates.push({ key: `w${n}`, label: `${n} שבועות`, rate: round1(mean(fullDemand.slice(-n))) });
  }
  const defaultRateKey = rates.some(r => r.key === "w26") ? "w26" : "all";

  // ── months ──────────────────────────────────────────────────
  const monthMap = new Map<string, MonthRow>();
  for (const m of movements) {
    const kind = classifyDoc(m.doc_type);
    if (!isConsumption(kind) || m.movement_date < analysisStart) continue;
    const key = m.movement_date.slice(0, 7);
    const row = monthMap.get(key) ?? { month: key, topCustomer: 0, others: 0, shipped: 0, returned: 0, net: 0, partial: false };
    const units = -m.quantity;
    if (kind === "customer_return") row.returned += m.quantity; else row.shipped += units;
    row.net += units;
    if (topCustomer && (m.account_name || m.account_code || "ללא לקוח") === topCustomer.name) row.topCustomer += units;
    else row.others += units;
    monthMap.set(key, row);
  }
  const months = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  const lastDayOfMonth = (ym: string) => fromMs(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0));
  for (const row of months) {
    row.partial = analysisStart > `${row.month}-01` || period_end < lastDayOfMonth(row.month);
  }

  const warehouses = [...whMap.entries()]
    .map(([code, w]) => ({ code, ...w }))
    .sort((a, b) => b.consumption - a.consumption || a.code.localeCompare(b.code));

  const docOrder: MovementKind[] = ["sale", "customer_return", "issue", "transfer", "receipt", "supplier_return", "adjustment", "other"];
  const docTypes = [...docMap.values()].sort((a, b) => docOrder.indexOf(a.kind) - docOrder.indexOf(b.kind) || b.rows - a.rows);

  return {
    netConsumption,
    shipped,
    returned,
    returnRate: shipped > 0 ? returned / shipped : 0,
    weeks,
    fullWeekCount: fullDemand.length,
    weeklyMean,
    weeklyMedian: median(fullDemand),
    weeklySd,
    monthlyRate: (weeklyMean * 52) / 12,
    annualRate: weeklyMean * 52,
    months,
    docTypes,
    customers,
    topCustomer,
    receipts,
    warehouses,
    minBalance,
    rates,
    defaultRateKey,
    analysisStart,
    isLaunch,
    closingBalance: closing_balance,
    coverWeeks: weeklyMean > 0 ? closing_balance / weeklyMean : null,
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }

// ── order calculator ──────────────────────────────────────────
export const SERVICE_LEVELS: { z: number; label: string }[] = [
  { z: 1.28, label: "90%" },
  { z: 1.44, label: "92.5%" },
  { z: 1.65, label: "95%" },
  { z: 1.88, label: "97%" },
  { z: 2.33, label: "99%" },
];

export interface PlanInput { rate: number; sd: number; leadWeeks: number; reviewWeeks: number; z: number; stock: number }
export interface PlanResult {
  leadDemand: number;
  safetyStock: number;
  reorderPoint: number;
  orderUpTo: number;
  coverWeeks: number | null;
  weeksToReorder: number | null;
  orderNow: number;
  orderAtReorder: number;
}

/**
 * Periodic-review (R, S) policy:
 *   reorder point = rate × L + z × σ × √L
 *   order-up-to   = rate × (L + R) + z × σ × √(L + R)
 */
export function computePlan({ rate, sd, leadWeeks: L, reviewWeeks: R, z, stock }: PlanInput): PlanResult {
  const safetyStock = Math.round(z * sd * Math.sqrt(L + R));
  const reorderPoint = Math.round(rate * L + z * sd * Math.sqrt(L));
  const orderUpTo = Math.round(rate * (L + R) + safetyStock);
  return {
    leadDemand: Math.round(rate * L),
    safetyStock,
    reorderPoint,
    orderUpTo,
    coverWeeks: rate > 0 ? stock / rate : null,
    weeksToReorder: rate > 0 ? (stock - reorderPoint) / rate : null,
    orderNow: Math.max(0, orderUpTo - stock),
    orderAtReorder: Math.max(0, orderUpTo - reorderPoint),
  };
}

// ── things to check before ordering ───────────────────────────
export function buildNotes(
  a: LedgerAnalysis,
  opts: { periodEnd: string; today: string; systemStock?: number | null; warehouseName: (code: string) => string },
): LedgerNote[] {
  const notes: LedgerNote[] = [];
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

  const staleDays = daysBetween(opts.periodEnd, opts.today);
  if (staleDays > 35) {
    notes.push({ severity: "warn", title: "הכרטסת לא מעודכנת", body: `התנועה האחרונה שנטענה היא מ־${fmt(opts.periodEnd)}, לפני ${staleDays} ימים. כדאי לטעון כרטסת חדשה לפני שמחליטים על הזמנה.` });
  }
  if (a.minBalance && a.minBalance.value < 0) {
    notes.push({ severity: "warn", title: "יתרה שלילית בתקופה", body: `ב־${fmt(a.minBalance.date)} היתרה הכוללת ירדה ל־${a.minBalance.value}. המערכת רשמה יציאות בלי כיסוי — כלומר קבלה נרשמה באיחור או שחסר מלאי בפועל.` });
  }
  const negWh = a.warehouses.filter(w => w.net < 0 || w.min < -5);
  if (negWh.length) {
    notes.push({
      severity: "warn",
      title: "ספירה במחסנים",
      body: negWh.map(w => `${opts.warehouseName(w.code)}: תנועה נטו ${w.net}${w.min < w.net ? ` (שפל ${w.min} ב־${fmt(w.minDate!)})` : ""}`).join(" · ") +
        ". היתרה הכוללת נכונה חשבונית, אבל החלוקה בין המחסנים כנראה לא משקפת את המלאי הפיזי.",
    });
  }
  const checks = a.docTypes.filter(d => d.kind === "adjustment" || d.kind === "supplier_return" || d.kind === "other");
  if (checks.length) {
    notes.push({
      severity: "warn",
      title: "תנועות שכדאי לאמת",
      body: checks.map(d => `${d.doc_type} (${KIND_META[d.kind].label}): ${d.rows} שורות, נטו ${d.net > 0 ? "+" : ""}${d.net}`).join(" · ") +
        ". עדכוני כמות והחזרות לספק משנים את היתרה בלי קשר לצריכה — כדאי לוודא שהסחורה באמת קיימת.",
    });
  }
  if (opts.systemStock != null && opts.systemStock !== a.closingBalance) {
    notes.push({ severity: "info", title: "פער מול המלאי בקוברה", body: `לפי הכרטסת היתרה היא ${a.closingBalance}, ובכרטיס המוצר רשום ${opts.systemStock}. ההבדל יכול לנבוע ממחסנים שלא מנוהלים בקוברה.` });
  }
  if (a.topCustomer && a.topCustomer.share >= 0.8) {
    notes.push({ severity: "info", title: `מה התחזית של ${a.topCustomer.name}?`, body: `${Math.round(a.topCustomer.share * 100)}% מהצריכה הם ללקוח אחד. תחזית מסירות לרבעון הקרוב תהיה מדויקת יותר מכל ממוצע היסטורי.` });
  }
  if (a.returnRate >= 0.03) {
    notes.push({ severity: "info", title: "החזרות", body: `${a.returned} החזרות מתוך ${a.shipped} משלוחים (${(a.returnRate * 100).toFixed(1)}%). כדאי לבדוק אם אלה ביטולי התקנה, תקלות או תיקוני רישום.` });
  }
  if (a.isLaunch || a.fullWeekCount < 20) {
    notes.push({ severity: "info", title: "היסטוריה קצרה", body: `יש רק ${a.fullWeekCount} שבועות מלאים של נתונים${a.isLaunch ? `, מאז תחילת המכירות ב־${fmt(a.analysisStart)}` : ""}. הממוצע עדיין לא יציב.` });
  }
  return notes;
}
