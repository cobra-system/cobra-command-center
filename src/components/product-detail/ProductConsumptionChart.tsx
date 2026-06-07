import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ConsumptionRow, aggregateByMonth, calcAvgs } from "@/hooks/useProductConsumption";

interface ProductConsumptionChartProps {
  rawRows: ConsumptionRow[];
  divisions: string[];
  /** When set, initialise to this division only and hide the filter bar */
  fixedDivision?: string;
}

const MONTHS_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTHS_HE[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

const AVG_LINES = [
  { key: "avgAnnual",   label: "ממוצע שנתי", color: "#16a34a" },
  { key: "avgHalfYear", label: "חצי שנתי",   color: "#eab308" },
  { key: "avgQuarter",  label: "רבעוני",      color: "#f97316" },
] as const;

// Stable palette for division pills (cycles if >8 divisions)
const DIV_COLORS = [
  "#2563eb", "#7c3aed", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#db2777", "#0284c7",
];

export function ProductConsumptionChart({ rawRows, divisions, fixedDivision }: ProductConsumptionChartProps) {
  const showFilter = !fixedDivision && divisions.length >= 2;

  // selectedDivisions: null means "all"
  const [selectedDivisions, setSelectedDivisions] = useState<Set<string> | null>(null);

  // Resolve which divisions are effectively active
  const activeDivisions = useMemo<string[] | null>(() => {
    if (fixedDivision) return [fixedDivision];
    if (!selectedDivisions) return null; // all
    return [...selectedDivisions];
  }, [fixedDivision, selectedDivisions]);

  const monthlyData = useMemo(
    () => aggregateByMonth(rawRows, activeDivisions),
    [rawRows, activeDivisions],
  );

  const { avgAnnual, avgHalfYear, avgQuarter } = useMemo(
    () => calcAvgs(monthlyData),
    [monthlyData],
  );

  const chartData = useMemo(
    () => monthlyData.map((d) => ({ ...d, label: formatMonth(d.month) })),
    [monthlyData],
  );

  function toggleDivision(div: string) {
    setSelectedDivisions((prev) => {
      const allSelected = prev === null;
      if (allSelected) {
        // isolate clicked division
        return new Set([div]);
      }
      const next = new Set(prev);
      if (next.has(div)) {
        if (next.size === 1) return null; // last one → reset to all
        next.delete(div);
      } else {
        next.add(div);
        if (next.size === divisions.length) return null; // all selected → reset
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedDivisions(null);
  }

  const isAllSelected = selectedDivisions === null;

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
          {/* Title + legend */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">מגמת צריכה חודשית</CardTitle>
            <div className="flex items-center gap-3 text-xs">
              {AVG_LINES.map((l) => {
                const val = l.key === "avgAnnual" ? avgAnnual : l.key === "avgHalfYear" ? avgHalfYear : avgQuarter;
                return (
                  <span key={l.key} className="flex items-center gap-1">
                    <span className="inline-block w-4 h-0.5" style={{ borderTop: `2px dashed ${l.color}` }} />
                    <span style={{ color: l.color }} className="font-medium">
                      {l.label}{val > 0 ? `: ${Math.ceil(val)}` : ""}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Division filter — only when multiple divisions exist */}
          {showFilter && (
            <div className="flex items-center gap-1.5 flex-wrap" dir="rtl">
              <button
                onClick={selectAll}
                className={`
                  px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150
                  ${isAllSelected
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }
                `}
              >
                הכל
              </button>
              {divisions.map((div, i) => {
                const color = DIV_COLORS[i % DIV_COLORS.length];
                const active = isAllSelected ? false : (selectedDivisions?.has(div) ?? false);
                return (
                  <button
                    key={div}
                    onClick={() => toggleDivision(div)}
                    className={`
                      px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150
                      ${active
                        ? "text-white border-transparent"
                        : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                      }
                    `}
                    style={active ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    {div}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, "auto"]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                formatter={(value: number) => [value, "כמות"]}
                labelFormatter={(label: string) => label}
                contentStyle={{ direction: "rtl", fontSize: 13 }}
              />
              <Area
                type="monotone"
                dataKey="quantity"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#consumptionGradient)"
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
              {avgAnnual > 0 && (
                <ReferenceLine y={avgAnnual} stroke="#16a34a" strokeDasharray="5 5"
                  label={{ value: `ממוצע שנתי  ${Math.ceil(avgAnnual)}`, position: "insideTopLeft", fontSize: 11, fill: "#16a34a" }} />
              )}
              {avgHalfYear > 0 && (
                <ReferenceLine y={avgHalfYear} stroke="#eab308" strokeDasharray="5 5"
                  label={{ value: `חצי שנתי  ${Math.ceil(avgHalfYear)}`, position: "insideTopLeft", fontSize: 11, fill: "#eab308" }} />
              )}
              {avgQuarter > 0 && (
                <ReferenceLine y={avgQuarter} stroke="#f97316" strokeDasharray="5 5"
                  label={{ value: `רבעוני  ${Math.ceil(avgQuarter)}`, position: "insideTopLeft", fontSize: 11, fill: "#f97316" }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
