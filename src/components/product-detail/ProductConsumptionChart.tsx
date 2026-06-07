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

interface ProductConsumptionChartProps {
  monthlyData: { month: string; quantity: number }[];
  avgAnnual: number;
  avgHalfYear: number;
  avgQuarter: number;
  availableDivisions?: string[];
  selectedDivision?: string | null;
  onDivisionChange?: (div: string | null) => void;
}

const MONTHS_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTHS_HE[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export function ProductConsumptionChart({
  monthlyData,
  avgAnnual,
  avgHalfYear,
  avgQuarter,
  availableDivisions,
  selectedDivision,
  onDivisionChange,
}: ProductConsumptionChartProps) {
  const showDivisionFilter = availableDivisions && availableDivisions.length >= 2 && onDivisionChange;

  const averageLines = [
    { label: "ממוצע שנתי", color: "#16a34a", value: avgAnnual },
    { label: "חצי שנתי", color: "#eab308", value: avgHalfYear },
    { label: "רבעוני", color: "#f97316", value: avgQuarter },
  ];

  if (monthlyData.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-muted-foreground">אין נתוני צריכה</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = monthlyData.map((d) => ({
    month: d.month,
    label: formatMonth(d.month),
    quantity: d.quantity,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">מגמת צריכה חודשית</CardTitle>
            <div className="flex items-center gap-3 text-xs">
              {averageLines.map((l) => (
                <span key={l.label} className="flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5" style={{ background: l.color, borderTop: `2px dashed ${l.color}` }} />
                  <span style={{ color: l.color }} className="font-medium">
                    {l.label}{l.value > 0 ? `: ${Math.ceil(l.value)}` : ""}
                  </span>
                </span>
              ))}
            </div>
          </div>
          {showDivisionFilter && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => onDivisionChange(null)}
                className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                  !selectedDivision
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                הכל
              </button>
              {availableDivisions.map((div) => (
                <button
                  key={div}
                  onClick={() => onDivisionChange(div)}
                  className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                    selectedDivision === div
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {div}
                </button>
              ))}
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
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, "auto"]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
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
                <ReferenceLine
                  y={avgAnnual}
                  stroke="#16a34a"
                  strokeDasharray="5 5"
                  label={{ value: `ממוצע שנתי  ${Math.ceil(avgAnnual)}`, position: "insideTopLeft", fontSize: 11, fill: "#16a34a" }}
                />
              )}
              {avgHalfYear > 0 && (
                <ReferenceLine
                  y={avgHalfYear}
                  stroke="#eab308"
                  strokeDasharray="5 5"
                  label={{ value: `חצי שנתי  ${Math.ceil(avgHalfYear)}`, position: "insideTopLeft", fontSize: 11, fill: "#eab308" }}
                />
              )}
              {avgQuarter > 0 && (
                <ReferenceLine
                  y={avgQuarter}
                  stroke="#f97316"
                  strokeDasharray="5 5"
                  label={{ value: `רבעוני  ${Math.ceil(avgQuarter)}`, position: "insideTopLeft", fontSize: 11, fill: "#f97316" }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
