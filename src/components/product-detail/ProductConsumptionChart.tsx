import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ConsumptionRow, aggregateByMonth, calcAvgs } from "@/hooks/useProductConsumption";
import type { Order } from "@/contexts/AppContext";

interface ProductConsumptionChartProps {
  rawRows: ConsumptionRow[];
  divisions: string[];
  fixedDivision?: string;
  relatedOrders?: Order[];
  productId?: string;
}

type DateRange = "3m" | "6m" | "1y" | "all";
type ViewMode = "aggregate" | "compare" | "stacked";

const MONTHS_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

// dateStr is always "YYYY-MM" after normalization in useProductConsumption
function formatMonth(dateStr: string): string {
  const [year, mon] = dateStr.split("-");
  const m = parseInt(mon, 10) - 1;
  return `${MONTHS_HE[m] ?? "?"} ${year.slice(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  DELIVERED: "נמסר", ARRIVED: "הגיע", SHIPPED: "נשלח",
  ARRIVED_PORT: "בנמל", CUSTOMS_CLEARANCE: "מכס",
  CANCELLED: "בוטל", ORDERED: "הוזמן", PENDING: "ממתין",
};

function getOrderColor(status: string): string {
  if (status === "DELIVERED" || status === "ARRIVED") return "#16a34a";
  if (status === "CANCELLED") return "#9ca3af";
  if (status === "SHIPPED" || status === "ARRIVED_PORT" || status === "CUSTOMS_CLEARANCE") return "#f97316";
  return "#2563eb";
}

function orderColorPriority(c: string) {
  return c === "#f97316" ? 3 : c === "#2563eb" ? 2 : c === "#16a34a" ? 1 : 0;
}

const DIV_COLORS = [
  "#2563eb", "#7c3aed", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#db2777", "#0284c7",
];

const DATE_RANGE_LABELS: Record<DateRange, string> = { "3m": "3m", "6m": "6m", "1y": "שנה", "all": "הכל" };

// Order badge rendered in SVG
function OrderLabel({ viewBox, qty, color, tooltip }: {
  viewBox?: { x: number; y: number; height: number };
  qty: number;
  color: string;
  tooltip: string;
}) {
  if (!viewBox) return null;
  const { x, y } = viewBox;
  return (
    <g>
      <title>{tooltip}</title>
      <rect x={x - 15} y={y + 4} width={30} height={16} rx={3} fill={color} fillOpacity={0.9} />
      <text x={x} y={y + 15} textAnchor="middle" fill="white" fontSize={9} fontWeight="700">
        {qty > 0 ? `📦 ${qty}` : "📦"}
      </text>
    </g>
  );
}

function ChartTooltip({
  active, payload, label, viewMode, activeDivisions,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; payload: Record<string, unknown> }>;
  label?: string;
  viewMode: ViewMode;
  activeDivisions: string[];
}) {
  if (!active || !payload?.length) return null;
  const first = payload[0]?.payload ?? {};
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg min-w-[120px]" dir="rtl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {viewMode === "aggregate" && (
        <p className="text-muted-foreground">
          כמות: <span className="text-foreground font-medium">{payload[0]?.value ?? 0}</span>
        </p>
      )}
      {(viewMode === "compare" || viewMode === "stacked") && activeDivisions.map(div => {
        const val = (first[div] as number) ?? 0;
        return val > 0 ? (
          <p key={div} className="text-muted-foreground">
            {div}: <span className="text-foreground font-medium">{val}</span>
          </p>
        ) : null;
      })}
    </div>
  );
}

export function ProductConsumptionChart({
  rawRows,
  divisions,
  fixedDivision,
  relatedOrders,
  productId,
}: ProductConsumptionChartProps) {
  const showFilter = !fixedDivision && divisions.length >= 2;
  const showModeToggle = !fixedDivision && divisions.length >= 2;

  const [selectedDivisions, setSelectedDivisions] = useState<Set<string> | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const monthCount = new Set(rawRows.map(r => r.month)).size;
    return monthCount < 6 ? "all" : "1y";
  });
  const [viewMode, setViewMode] = useState<ViewMode>("aggregate");
  const [showOrders, setShowOrders] = useState(true);

  const activeDivisionsList = useMemo<string[]>(() => {
    if (fixedDivision) return [fixedDivision];
    if (!selectedDivisions) return divisions;
    return [...selectedDivisions];
  }, [fixedDivision, selectedDivisions, divisions]);

  const activeDivisions = useMemo<string[] | null>(() => {
    if (fixedDivision) return [fixedDivision];
    return selectedDivisions ? [...selectedDivisions] : null;
  }, [fixedDivision, selectedDivisions]);

  const filteredRows = useMemo(() => {
    if (dateRange === "all") return rawRows;
    const months = dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
    return rawRows.filter(r => r.month >= cutoffStr);
  }, [rawRows, dateRange]);

  const monthlyData = useMemo(
    () => aggregateByMonth(filteredRows, activeDivisions),
    [filteredRows, activeDivisions],
  );

  const { avgAnnual, avgHalfYear, avgQuarter } = useMemo(
    () => calcAvgs(monthlyData),
    [monthlyData],
  );

  // Only show avg lines that are meaningfully different (>12% gap) to avoid clutter
  const visibleAvgLines = useMemo(() => {
    const lines: { label: string; value: number; color: string }[] = [];
    if (avgAnnual > 0) lines.push({ label: "ממוצע שנתי", value: avgAnnual, color: "#16a34a" });
    if (avgHalfYear > 0 && Math.abs(avgHalfYear - avgAnnual) / Math.max(avgAnnual, 1) > 0.12)
      lines.push({ label: "חצי שנתי", value: avgHalfYear, color: "#eab308" });
    if (avgQuarter > 0 && Math.abs(avgQuarter - avgHalfYear) / Math.max(avgHalfYear, avgAnnual, 1) > 0.12)
      lines.push({ label: "רבעוני", value: avgQuarter, color: "#f97316" });
    return lines;
  }, [avgAnnual, avgHalfYear, avgQuarter]);

  const divisionMonthlyMaps = useMemo(() => {
    const result = new Map<string, Map<string, number>>();
    for (const div of activeDivisionsList) {
      const agg = aggregateByMonth(filteredRows, [div]);
      result.set(div, new Map(agg.map(d => [d.month, d.quantity])));
    }
    return result;
  }, [filteredRows, activeDivisionsList]);

  const allHistoricalMonths = useMemo(() => {
    const set = new Set<string>();
    for (const r of filteredRows) {
      if (!activeDivisions || activeDivisions.includes(r.division)) set.add(r.month);
    }
    return [...set].sort();
  }, [filteredRows, activeDivisions]);

  const chartData = useMemo(() => {
    const points: Record<string, unknown>[] = [];
    for (const month of allHistoricalMonths) {
      const point: Record<string, unknown> = { month, label: formatMonth(month) };
      if (viewMode === "aggregate") {
        point.quantity = monthlyData.find(d => d.month === month)?.quantity ?? 0;
      } else {
        for (const div of activeDivisionsList) {
          point[div] = divisionMonthlyMaps.get(div)?.get(month) ?? 0;
        }
      }
      points.push(point);
    }
    return points;
  }, [allHistoricalMonths, monthlyData, viewMode, activeDivisionsList, divisionMonthlyMaps]);

  const orderMarkers = useMemo(() => {
    if (!relatedOrders || !showOrders || !productId) return [];
    const chartLabelSet = new Set(chartData.map(d => d.label as string));
    const byLabel = new Map<string, { qty: number; color: string; tooltipLines: string[] }>();
    for (const o of relatedOrders) {
      if (!o.order_date) continue;
      const label = formatMonth(o.order_date.slice(0, 7));
      if (!chartLabelSet.has(label)) continue;
      const qty = o.items.find(i => i.product_id === productId)?.qty ?? 0;
      const color = getOrderColor(o.status);
      const statusHe = STATUS_LABELS[o.status] ?? o.status;
      const tooltipLine = [
        o.pi_number ? `PI: ${o.pi_number}` : null,
        o.supplier_name ?? null,
        qty > 0 ? `כמות: ${qty}` : null,
        `סטטוס: ${statusHe}`,
        o.eta ? `ETA: ${o.eta.slice(0, 10)}` : null,
      ].filter(Boolean).join(" · ");
      const existing = byLabel.get(label);
      if (existing) {
        existing.qty += qty;
        if (orderColorPriority(color) > orderColorPriority(existing.color)) existing.color = color;
        existing.tooltipLines.push(tooltipLine);
      } else {
        byLabel.set(label, { qty, color, tooltipLines: [tooltipLine] });
      }
    }
    return [...byLabel.entries()].map(([label, v]) => ({
      label, qty: v.qty, color: v.color, tooltip: v.tooltipLines.join("\n"),
    }));
  }, [relatedOrders, showOrders, productId, chartData]);

  const isAllSelected = selectedDivisions === null;
  const hasMultiDivisions = divisions.length >= 2;

  function toggleDivision(div: string) {
    setSelectedDivisions(prev => {
      if (prev === null) return new Set([div]);
      const next = new Set(prev);
      if (next.has(div)) {
        if (next.size === 1) return null;
        next.delete(div);
      } else {
        next.add(div);
        if (next.size === divisions.length) return null;
      }
      return next;
    });
  }

  if (rawRows.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-muted-foreground">אין נתוני צריכה</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">

          {/* ── Row 1: title + avg summary ──────────────────────────── */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">מגמת צריכה חודשית</CardTitle>
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              {visibleAvgLines.map(l => (
                <span key={l.label} className="flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5" style={{ borderTop: `2px dashed ${l.color}` }} />
                  <span style={{ color: l.color }} className="font-medium">{l.label}: {Math.ceil(l.value)}</span>
                </span>
              ))}
            </div>
          </div>

          {/* ── Row 2: controls ─────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["3m", "6m", "1y", "all"] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                  dateRange === r
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {DATE_RANGE_LABELS[r]}
              </button>
            ))}

            {showModeToggle && (
              <div className="flex items-center border border-border rounded overflow-hidden text-[11px]">
                {(["aggregate", "compare", "stacked"] as ViewMode[]).map(mode => {
                  const labels: Record<ViewMode, string> = { aggregate: "מאוחד", compare: "השוואה", stacked: "מוערם" };
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-2 py-0.5 transition-colors ${
                        viewMode === mode
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>
            )}

            {relatedOrders && relatedOrders.length > 0 && (
              <button
                onClick={() => setShowOrders(v => !v)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors ${
                  showOrders
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                הזמנות {showOrders ? "✓" : ""}
              </button>
            )}
          </div>

          {/* ── Row 3: division pills ────────────────────────────────── */}
          {showFilter && (
            <div className="flex items-center gap-1 flex-wrap" dir="rtl">
              <button
                onClick={() => setSelectedDivisions(null)}
                className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-all ${
                  isAllSelected
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                הכל
              </button>
              {divisions.map((div, i) => {
                const color = DIV_COLORS[i % DIV_COLORS.length];
                const active = !isAllSelected && (selectedDivisions?.has(div) ?? false);
                return (
                  <button
                    key={div}
                    onClick={() => toggleDivision(div)}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-all ${
                      active ? "text-white border-transparent" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                    }`}
                    style={active ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-0.5 align-middle"
                      style={{ backgroundColor: color, opacity: active ? 1 : 0.4 }} />
                    {div}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="h-[260px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData as never[]} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="grad-history" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, "auto"]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={32} />

              <Tooltip content={<ChartTooltip viewMode={viewMode} activeDivisions={activeDivisionsList} />} />

              {/* ── Aggregate: history area ──────────────────────────── */}
              {viewMode === "aggregate" && (
                <Area type="monotone" dataKey="quantity"
                  stroke="#3b82f6" strokeWidth={2}
                  fill="url(#grad-history)" dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={false} />
              )}

              {/* ── Compare / Stacked ───────────────────────────────── */}
              {(viewMode === "compare" || viewMode === "stacked") &&
                activeDivisionsList.map((div, i) => {
                  const color = DIV_COLORS[i % DIV_COLORS.length];
                  return (
                    <Area key={div} type="monotone" dataKey={div}
                      stackId={viewMode === "stacked" ? "stack" : undefined}
                      stroke={color} strokeWidth={2}
                      fill={color} fillOpacity={viewMode === "stacked" ? 0.5 : 0.1}
                      dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  );
                })
              }

              {/* ── Avg reference lines (deduplicated) ──────────────── */}
              {visibleAvgLines.map(l => (
                <ReferenceLine key={l.label} y={l.value}
                  stroke={l.color} strokeDasharray="5 4" strokeOpacity={0.7}
                  label={{ value: `${Math.ceil(l.value)}`, position: "insideTopLeft", fontSize: 10, fill: l.color }} />
              ))}

              {/* ── Order event markers ──────────────────────────────── */}
              {orderMarkers.map(({ label, qty, color, tooltip }) => (
                <ReferenceLine key={`order-${label}`} x={label}
                  stroke={color} strokeDasharray="3 3" strokeWidth={1.5}
                  label={<OrderLabel qty={qty} color={color} tooltip={tooltip} />} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Division color legend ─────────────────────────────────── */}
        {(viewMode === "compare" || viewMode === "stacked") && hasMultiDivisions && (
          <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-muted-foreground">
            {activeDivisionsList.map((div, i) => (
              <span key={div} className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: DIV_COLORS[i % DIV_COLORS.length] }} />
                {div}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
