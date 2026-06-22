import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupplierPayments, type MonthlyPaymentData } from "@/hooks/useSupplierPayments";

interface SupplierPaymentChartProps {
  supplierId: string;
}

type DateRange = "3m" | "6m" | "1y" | "all";

const DATE_RANGE_LABELS: Record<DateRange, string> = { "3m": "3m", "6m": "6m", "1y": "שנה", "all": "הכל" };

const BAR_PAID    = "#2563eb";
const BAR_PENDING = "#f97316";
const AVG_COLOR   = "#16a34a";

function formatAmount(v: number, currency: string): string {
  if (v >= 1_000_000) return `${currency} ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${currency} ${(v / 1_000).toFixed(0)}K`;
  return `${currency} ${v.toFixed(0)}`;
}

function yAxisFormatter(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

function PaymentTooltip({
  active, payload, label, currency,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const paid = payload.find(p => p.dataKey === "paid")?.value ?? 0;
  const pending = payload.find(p => p.dataKey === "pending")?.value ?? 0;
  const total = paid + pending;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg min-w-[140px]" dir="rtl">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {paid > 0 && (
        <p className="text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: BAR_PAID }} />
          שולם: <span className="text-foreground font-medium">{formatAmount(paid, currency)}</span>
        </p>
      )}
      {pending > 0 && (
        <p className="text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: BAR_PENDING }} />
          ממתין: <span className="text-foreground font-medium">{formatAmount(pending, currency)}</span>
        </p>
      )}
      {paid > 0 && pending > 0 && (
        <p className="text-foreground font-semibold mt-1 pt-1 border-t border-border">
          סה״כ: {formatAmount(total, currency)}
        </p>
      )}
    </div>
  );
}

export function SupplierPaymentChart({ supplierId }: SupplierPaymentChartProps) {
  const { monthlyData, totalPaid, totalPending, primaryCurrency, loading } = useSupplierPayments(supplierId);

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const count = monthlyData.length;
    return count < 6 ? "all" : "1y";
  });

  const filteredData = useMemo<MonthlyPaymentData[]>(() => {
    if (dateRange === "all") return monthlyData;
    const months = dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
    return monthlyData.filter(d => d.month >= cutoffStr);
  }, [monthlyData, dateRange]);

  const avgPaid = useMemo(() => {
    const paidMonths = filteredData.filter(d => d.paid > 0);
    if (paidMonths.length === 0) return 0;
    return paidMonths.reduce((s, d) => s + d.paid, 0) / paidMonths.length;
  }, [filteredData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-muted-foreground text-sm">טוען נתוני תשלומים...</p>
        </CardContent>
      </Card>
    );
  }

  if (monthlyData.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-muted-foreground text-sm">אין נתוני תשלומים</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">

          {/* Row 1: title + totals summary */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">היסטוריית תשלומים חודשית</CardTitle>
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              {totalPaid > 0 && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: BAR_PAID }} />
                  <span style={{ color: BAR_PAID }} className="font-medium">
                    שולם: {formatAmount(totalPaid, primaryCurrency)}
                  </span>
                </span>
              )}
              {totalPending > 0 && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: BAR_PENDING }} />
                  <span style={{ color: BAR_PENDING }} className="font-medium">
                    ממתין: {formatAmount(totalPending, primaryCurrency)}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Row 2: date range controls */}
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
            {avgPaid > 0 && (
              <span className="flex items-center gap-1 mr-1 text-[11px]">
                <span className="inline-block w-4 h-0.5" style={{ borderTop: `2px dashed ${AVG_COLOR}` }} />
                <span style={{ color: AVG_COLOR }} className="font-medium">
                  ממוצע: {formatAmount(avgPaid, primaryCurrency)}
                </span>
              </span>
            )}
          </div>

        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="h-[260px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={yAxisFormatter}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={40}
                domain={[0, "auto"]}
              />
              <Tooltip
                content={<PaymentTooltip currency={primaryCurrency} />}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />

              <Bar dataKey="paid" stackId="stack" fill={BAR_PAID} radius={[0, 0, 2, 2]} maxBarSize={48} />
              <Bar dataKey="pending" stackId="stack" fill={BAR_PENDING} radius={[2, 2, 0, 0]} maxBarSize={48} />

              {avgPaid > 0 && (
                <ReferenceLine
                  y={avgPaid}
                  stroke={AVG_COLOR}
                  strokeDasharray="5 4"
                  strokeOpacity={0.7}
                  label={{ value: yAxisFormatter(Math.round(avgPaid)), position: "insideTopLeft", fontSize: 10, fill: AVG_COLOR }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: BAR_PAID }} />
            שולם
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: BAR_PENDING }} />
            ממתין
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
