import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { FileSpreadsheet, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useItemLedger, useWarehouseNames } from "@/hooks/useItemLedger";
import {
  analyzeLedger, buildNotes, computePlan, KIND_META, SERVICE_LEVELS,
  type LedgerAnalysis, type MovementKind,
} from "@/lib/itemLedger/analyze";

interface Props {
  sku: string | null | undefined;
  systemStock?: number | null;
  leadTimeDays?: number | null;
  canEdit?: boolean;
  onSavePlan?: (updates: { reorder_point: number; lead_time_days: number }) => Promise<void>;
}

const MONTHS_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
const fmtNum = (n: number, digits = 0) => n.toLocaleString("he-IL", { maximumFractionDigits: digits });
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDaysIso = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + Math.round(n));
  return t.toISOString().slice(0, 10);
};

const ROLE_TAG: Record<string, { label: string; className: string }> = {
  out: { label: "צריכה", className: "bg-destructive/15 text-destructive" },
  offset: { label: "מקזז צריכה", className: "bg-destructive/10 text-destructive" },
  none: { label: "לא נספר", className: "bg-muted text-muted-foreground" },
  in: { label: "כניסה", className: "bg-primary/15 text-primary" },
  check: { label: "לבדוק", className: "bg-warning/15 text-warning" },
};

export function ItemLedgerAnalysis({ sku, systemStock, leadTimeDays, canEdit, onSavePlan }: Props) {
  const { data, isLoading } = useItemLedger(sku);
  const warehouseName = useWarehouseNames();

  const analysis = useMemo(() => {
    if (!data) return null;
    return analyzeLedger({
      movements: data.movements,
      opening_balance: Number(data.item.opening_balance),
      closing_balance: Number(data.item.closing_balance),
      period_start: data.item.period_start,
      period_end: data.item.period_end,
    });
  }, [data]);

  if (isLoading || !data || !analysis) return null;
  if (!data.movements.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            ניתוח כרטסת פריט · צריכה והזמנה
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {dmy(data.item.period_start)} – {dmy(data.item.period_end)} · {fmtNum(data.movements.length)} תנועות
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          הצריכה כוללת רק יציאות ללקוחות ולשירות פחות החזרות. העברות בין מחסנים, קבלות מהספק והחזרות אליו רק מזיזות מלאי ולא נספרות.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Kpis a={analysis} />
        <WeeklyChart a={analysis} />
        <BalanceChart a={analysis} />
        <div className="grid gap-4 lg:grid-cols-2">
          <DocTypesTable a={analysis} />
          <MonthlyTable a={analysis} />
        </div>
        <WarehousesTable a={analysis} warehouseName={warehouseName} />
        <OrderCalculator
          a={analysis}
          periodEnd={data.item.period_end}
          leadTimeDays={leadTimeDays}
          canEdit={canEdit}
          onSavePlan={onSavePlan}
        />
        <Notes notes={buildNotes(analysis, { periodEnd: data.item.period_end, today: todayIso(), systemStock, warehouseName })} />
        <p className="text-[11px] text-muted-foreground">
          מקור: כרטסת פריט {data.item.sku}. יתרת פתיחה {fmtNum(Number(data.item.opening_balance))}, יתרת סגירה {fmtNum(analysis.closingBalance)}.
          צריכה = תמ + ימ פחות הח/חז. שבועות מתחילים ביום ראשון; שבוע חלקי בתחילת התקופה ובסופה לא נכלל בסטטיסטיקה.
          עודכן לאחרונה {dmy(data.item.updated_at.slice(0, 10))}.
        </p>
      </CardContent>
    </Card>
  );
}

function Kpis({ a }: { a: LedgerAnalysis }) {
  const items = [
    { l: "צריכה נטו בתקופה", v: fmtNum(a.netConsumption), s: a.returned ? `${fmtNum(a.shipped)} משלוחים פחות ${fmtNum(a.returned)} החזרות` : `${a.weeks.length} שבועות` },
    { l: "קצב שבועי ממוצע", v: fmtNum(a.weeklyMean, 1), s: `חציון ${fmtNum(a.weeklyMedian, 1)} · סטיית תקן ${fmtNum(a.weeklySd, 1)}` },
    { l: "קצב חודשי", v: `≈${fmtNum(a.monthlyRate)}`, s: `≈${fmtNum(Math.round(a.annualRate / 10) * 10)} יחידות בשנה` },
    ...(a.topCustomer ? [{ l: a.topCustomer.name, v: `${fmtNum(a.topCustomer.share * 100, 1)}%`, s: `${fmtNum(a.topCustomer.units)} מתוך ${fmtNum(a.netConsumption)} יחידות` }] : []),
    { l: "מלאי נוכחי (כל המחסנים)", v: fmtNum(a.closingBalance), s: a.coverWeeks != null ? `≈${fmtNum(a.coverWeeks)} שבועות בקצב הממוצע` : "אין צריכה בתקופה" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border border rounded-lg overflow-hidden">
      {items.map(k => (
        <div key={k.l} className="bg-card px-4 py-3 flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-muted-foreground truncate" title={k.l}>{k.l}</span>
          <span className="text-2xl font-semibold tabular-nums">{k.v}</span>
          <span className="text-[11px] text-muted-foreground">{k.s}</span>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground mb-2">{children}</h3>;
}

function WeeklyChart({ a }: { a: LedgerAnalysis }) {
  const data = a.weeks.map(w => ({ ...w, label: dm(w.week) }));
  return (
    <section>
      <SectionTitle>צריכה שבועית</SectionTitle>
      <div className="h-56" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="bg-popover border rounded-md px-3 py-2 text-xs shadow" dir="rtl">
                    <p className="font-semibold">שבוע {dmy(p.week)}{!p.full && " (חלקי)"}</p>
                    <p>יציאות נטו: {p.demand}</p>
                    {p.ma4 != null && <p>ממוצע נע 4 שב׳: {fmtNum(p.ma4, 1)}</p>}
                  </div>
                );
              }}
            />
            <Bar dataKey="demand" fill="hsl(var(--primary) / 0.45)" radius={[2, 2, 0, 0]} />
            <Line dataKey="ma4" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} connectNulls />
            <ReferenceLine y={a.weeklyMean} stroke="hsl(var(--warning))" strokeDasharray="5 4" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[
        ["hsl(var(--primary) / 0.45)", "יציאות נטו בשבוע"],
        ["hsl(var(--primary))", "ממוצע נע 4 שבועות"],
        ["hsl(var(--warning))", `ממוצע התקופה (${fmtNum(a.weeklyMean, 1)})`],
      ]} />
    </section>
  );
}

function BalanceChart({ a }: { a: LedgerAnalysis }) {
  const data = a.weeks.map(w => ({ ...w, label: dm(w.week) }));
  const receiptWeeks = data.filter(w => w.receipts > 0);
  return (
    <section>
      <SectionTitle>יתרת מלאי כוללת וקבלות מהספק</SectionTitle>
      <div className="h-52" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="bg-popover border rounded-md px-3 py-2 text-xs shadow" dir="rtl">
                    <p className="font-semibold">סוף שבוע {dmy(p.week)}</p>
                    <p>יתרה: {p.balance}</p>
                    {p.receipts > 0 && <p className="text-warning">קבלה מהספק: +{p.receipts}</p>}
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
            {receiptWeeks.map(w => (
              <ReferenceLine
                key={w.week}
                x={w.label}
                stroke="hsl(var(--warning))"
                strokeDasharray="3 3"
                label={{ value: `+${w.receipts}`, position: "top", fontSize: 10, fill: "hsl(var(--warning))", fontWeight: 600 }}
              />
            ))}
            <Area dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="hsl(var(--primary) / 0.12)" type="linear" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[["hsl(var(--primary))", "יתרה בסוף שבוע"], ["hsl(var(--warning))", "קבלה מהספק"]]} />
      {a.minBalance && a.minBalance.value < 0 && (
        <p className="text-xs text-destructive mt-1">
          ב־{dmy(a.minBalance.date)} היתרה הכוללת ירדה ל־{a.minBalance.value} — יציאות נרשמו לפני שהסחורה נקלטה.
        </p>
      )}
    </section>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground mt-1">
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <i className="inline-block w-3 h-3 rounded-sm" style={{ background: c }} />{l}
        </span>
      ))}
    </div>
  );
}

function Tag({ kind }: { kind: MovementKind }) {
  const t = ROLE_TAG[KIND_META[kind].role];
  return <span className={`inline-block text-[11px] font-semibold px-2 rounded-full ${t.className}`}>{t.label}</span>;
}

function DocTypesTable({ a }: { a: LedgerAnalysis }) {
  return (
    <section className="min-w-0">
      <SectionTitle>סוגי מסמכים ומה נחשב צריכה</SectionTitle>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="text-right p-2 font-semibold">מסמך</th>
              <th className="text-right p-2 font-semibold">משמעות</th>
              <th className="text-left p-2 font-semibold">שורות</th>
              <th className="text-left p-2 font-semibold">נטו</th>
              <th className="text-right p-2 font-semibold">בחישוב</th>
            </tr>
          </thead>
          <tbody>
            {a.docTypes.map(d => (
              <tr key={d.doc_type} className="border-b last:border-0">
                <td className="p-2 font-medium">{d.doc_type}</td>
                <td className="p-2 text-muted-foreground">{KIND_META[d.kind].label}</td>
                <td className="p-2 text-left tabular-nums" dir="ltr">{fmtNum(d.rows)}</td>
                <td className="p-2 text-left tabular-nums" dir="ltr">{d.net > 0 ? "+" : ""}{fmtNum(d.net)}</td>
                <td className="p-2"><Tag kind={d.kind} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MonthlyTable({ a }: { a: LedgerAnalysis }) {
  const top = a.topCustomer;
  const showSplit = !!top && a.customers.length > 1;
  const totals = a.months.reduce((s, m) => ({ top: s.top + m.topCustomer, others: s.others + m.others, shipped: s.shipped + m.shipped, returned: s.returned + m.returned, net: s.net + m.net }), { top: 0, others: 0, shipped: 0, returned: 0, net: 0 });
  return (
    <section className="min-w-0">
      <SectionTitle>צריכה חודשית</SectionTitle>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="text-right p-2 font-semibold">חודש</th>
              {showSplit ? (
                <>
                  <th className="text-left p-2 font-semibold truncate max-w-[120px]" title={top!.name}>{top!.name}</th>
                  <th className="text-left p-2 font-semibold">אחרים</th>
                </>
              ) : (
                <>
                  <th className="text-left p-2 font-semibold">משלוחים</th>
                  <th className="text-left p-2 font-semibold">החזרות</th>
                </>
              )}
              <th className="text-left p-2 font-semibold">סה״כ נטו</th>
            </tr>
          </thead>
          <tbody>
            {a.months.map(m => (
              <tr key={m.month} className="border-b">
                <td className="p-2">{MONTHS_HE[+m.month.slice(5, 7) - 1]} {m.month.slice(2, 4)}{m.partial && <span className="text-muted-foreground">*</span>}</td>
                <td className="p-2 text-left tabular-nums" dir="ltr">{showSplit ? m.topCustomer : m.shipped}</td>
                <td className="p-2 text-left tabular-nums" dir="ltr">{showSplit ? m.others : m.returned ? -m.returned : 0}</td>
                <td className="p-2 text-left tabular-nums font-semibold" dir="ltr">{m.net}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-muted/30">
              <td className="p-2">סה״כ</td>
              <td className="p-2 text-left tabular-nums" dir="ltr">{showSplit ? totals.top : totals.shipped}</td>
              <td className="p-2 text-left tabular-nums" dir="ltr">{showSplit ? totals.others : totals.returned ? -totals.returned : 0}</td>
              <td className="p-2 text-left tabular-nums" dir="ltr">{totals.net}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {a.months.some(m => m.partial) && <p className="text-[11px] text-muted-foreground mt-1">* חודש חלקי</p>}
      {showSplit && a.customers.length > 1 && (
        <p className="text-[11px] text-muted-foreground mt-1">
          לקוחות נוספים: {a.customers.slice(1, 8).map(c => `${c.name} (${c.units})`).join(", ")}{a.customers.length > 8 ? " ועוד" : ""}
        </p>
      )}
    </section>
  );
}

function WarehousesTable({ a, warehouseName }: { a: LedgerAnalysis; warehouseName: (c: string) => string }) {
  const rows = a.warehouses.filter(w => w.net !== 0 || w.consumption !== 0 || w.min < 0);
  if (rows.length < 2) return null;
  return (
    <section>
      <SectionTitle>תנועה לפי מחסן בתקופה</SectionTitle>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="text-right p-2 font-semibold">מחסן</th>
              <th className="text-left p-2 font-semibold">צריכה</th>
              <th className="text-left p-2 font-semibold">תנועה נטו</th>
              <th className="text-left p-2 font-semibold">שפל</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(w => (
              <tr key={w.code} className="border-b last:border-0">
                <td className="p-2">{warehouseName(w.code)}</td>
                <td className="p-2 text-left tabular-nums" dir="ltr">{w.consumption}</td>
                <td className={`p-2 text-left tabular-nums ${w.net < 0 ? "text-destructive" : ""}`} dir="ltr">{w.net > 0 ? "+" : ""}{w.net}</td>
                <td className={`p-2 text-left tabular-nums ${w.min < 0 ? "text-destructive" : "text-muted-foreground"}`} dir="ltr">
                  {w.min < 0 ? `${w.min} · ${dm(w.minDate!)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">הכרטסת נותנת יתרת פתיחה כוללת בלבד, לכן זו התנועה נטו של כל מחסן מתחילת התקופה ולא היתרה שלו.</p>
    </section>
  );
}

function OrderCalculator({ a, periodEnd, leadTimeDays, canEdit, onSavePlan }: {
  a: LedgerAnalysis; periodEnd: string; leadTimeDays?: number | null; canEdit?: boolean;
  onSavePlan?: Props["onSavePlan"];
}) {
  const [rateKey, setRateKey] = useState(a.defaultRateKey);
  const [lead, setLead] = useState(() => Math.min(12, Math.max(1, leadTimeDays ? Math.round(leadTimeDays / 7) : 4)));
  const [review, setReview] = useState(4);
  const [sl, setSl] = useState(2);
  const [stock, setStock] = useState(a.closingBalance);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setStock(a.closingBalance); setRateKey(a.defaultRateKey); }, [a.closingBalance, a.defaultRateKey]);

  const rate = a.rates.find(r => r.key === rateKey)?.rate ?? a.weeklyMean;
  const { z, label: slLabel } = SERVICE_LEVELS[sl];
  const plan = computePlan({ rate, sd: a.weeklySd, leadWeeks: lead, reviewWeeks: review, z, stock });
  const ropDate = plan.weeksToReorder != null ? addDaysIso(periodEnd, Math.max(0, plan.weeksToReorder) * 7) : null;

  let verdict: { cls: string; title: string; sub: string };
  if (rate <= 0 || plan.weeksToReorder == null) {
    verdict = { cls: "bg-muted text-muted-foreground", title: "אין צריכה בקצב שנבחר", sub: "אי אפשר לחשב נקודת הזמנה." };
  } else if (plan.weeksToReorder <= 0) {
    verdict = { cls: "bg-destructive/10 text-destructive", title: `להזמין עכשיו כ־${fmtNum(plan.orderNow)} יחידות`, sub: `המלאי כבר מתחת לנקודת ההזמנה (${plan.reorderPoint}).` };
  } else if (plan.weeksToReorder <= 3) {
    verdict = { cls: "bg-warning/15 text-warning", title: `להזמין בעוד ${Math.round(plan.weeksToReorder * 7)} ימים בערך, סביב ${dmy(ropDate!)}`, sub: `כמות מומלצת אז: כ־${fmtNum(plan.orderAtReorder)} יחידות, כך שהמלאי יחזור ל־${plan.orderUpTo}.` };
  } else {
    verdict = { cls: "bg-primary/10 text-primary", title: `אין צורך להזמין עכשיו. נקודת ההזמנה צפויה בסביבות ${dmy(ropDate!)}`, sub: `בעוד כ־${Math.round(plan.weeksToReorder)} שבועות. אז להזמין כ־${fmtNum(plan.orderAtReorder)} יחידות.` };
  }

  const save = async () => {
    if (!onSavePlan) return;
    setSaving(true);
    try { await onSavePlan({ reorder_point: plan.reorderPoint, lead_time_days: lead * 7 }); } finally { setSaving(false); }
  };

  return (
    <section>
      <SectionTitle>כמה להזמין</SectionTitle>
      <div className="border rounded-lg p-4 grid gap-6 md:grid-cols-[minmax(240px,1fr)_1.3fr]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">קצב צריכה לתכנון (לשבוע)</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="קצב צריכה">
              {a.rates.map(r => (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={r.key === rateKey}
                  onClick={() => setRateKey(r.key)}
                  className={`text-xs border rounded-md px-2.5 py-1 transition-colors ${r.key === rateKey ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                >
                  {r.label} · {fmtNum(r.rate, 1)}
                </button>
              ))}
            </div>
          </div>
          <SliderRow label="זמן אספקה מהספק" value={`${lead} שב׳`} hint={leadTimeDays ? "לפי זמן האספקה שמוגדר במוצר" : "לא מוגדר במוצר — ברירת מחדל 4 שבועות"}>
            <Slider min={1} max={16} step={1} value={[lead]} onValueChange={([v]) => setLead(v)} />
          </SliderRow>
          <SliderRow label="כל כמה זמן מזמינים" value={`${review} שב׳`}>
            <Slider min={1} max={12} step={1} value={[review]} onValueChange={([v]) => setReview(v)} />
          </SliderRow>
          <SliderRow label="רמת שירות" value={slLabel}>
            <Slider min={0} max={SERVICE_LEVELS.length - 1} step={1} value={[sl]} onValueChange={([v]) => setSl(v)} />
          </SliderRow>
          <div className="space-y-1">
            <label className="text-sm font-semibold flex justify-between" htmlFor="ledger-stock">
              מלאי זמין בפועל
              <span className="text-xs text-muted-foreground font-normal">{a.closingBalance} לפי הכרטסת</span>
            </label>
            <Input id="ledger-stock" type="number" value={stock} onChange={e => setStock(Number(e.target.value) || 0)} className="h-8 tabular-nums" dir="ltr" />
          </div>
        </div>
        <div className="space-y-3">
          <div className={`rounded-lg px-4 py-3 ${verdict.cls}`}>
            <p className="font-semibold">{verdict.title}</p>
            <p className="text-sm opacity-90 mt-0.5">{verdict.sub}</p>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt>ביקוש צפוי בזמן האספקה ({lead} שב׳ × {fmtNum(rate, 1)})</dt><dd className="tabular-nums text-left" dir="ltr">{plan.leadDemand}</dd>
            <dt>מלאי ביטחון ({slLabel})</dt><dd className="tabular-nums text-left" dir="ltr">{plan.safetyStock}</dd>
            <dt>נקודת הזמנה: כשהמלאי יורד ל־</dt><dd className="tabular-nums text-left" dir="ltr">{plan.reorderPoint}</dd>
            <dt>יעד מלאי אחרי כל הזמנה</dt><dd className="tabular-nums text-left" dir="ltr">{plan.orderUpTo}</dd>
            <dt className="font-semibold border-t pt-1.5">כיסוי המלאי הנוכחי</dt>
            <dd className="font-semibold border-t pt-1.5 tabular-nums text-left" dir="ltr">{plan.coverWeeks != null ? `${plan.coverWeeks.toFixed(1)} שב׳` : "—"}</dd>
          </dl>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            נקודת הזמנה = קצב × זמן אספקה + z × {fmtNum(a.weeklySd, 1)} × √זמן אספקה. יעד מלאי = קצב × (זמן אספקה + מחזור הזמנה) + מלאי ביטחון.
            סטיית התקן השבועית ({fmtNum(a.weeklySd, 1)}) מחושבת על {a.fullWeekCount} שבועות מלאים.
          </p>
          {canEdit && onSavePlan && rate > 0 && (
            <Button size="sm" variant="outline" onClick={save} disabled={saving}>
              <Save className="h-4 w-4 ml-1" />
              שמור נקודת הזמנה ({plan.reorderPoint}) וזמן אספקה במוצר
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function SliderRow({ label, value, hint, children }: { label: string; value: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-semibold"><span>{label}</span><span className="tabular-nums">{value}</span></div>
      <div dir="ltr">{children}</div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Notes({ notes }: { notes: ReturnType<typeof buildNotes> }) {
  if (!notes.length) return null;
  return (
    <section>
      <SectionTitle>מה כדאי לבדוק לפני שמזמינים</SectionTitle>
      <ul className="space-y-2.5">
        {notes.map(n => (
          <li key={n.title} className={`border-r-[3px] pr-3 py-0.5 text-sm ${n.severity === "warn" ? "border-warning" : "border-primary/50"}`}>
            <b className="block">{n.title}</b>
            <span className="text-muted-foreground">{n.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
