import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { useSupplierSapPayments } from "@/hooks/useSupplierSapPayments";

interface SupplierSapPaymentSectionProps {
  supplierId: string;
  supplierNumber: string | null;
}

const BAR_COLOR = "#2563eb";
const AVG_COLOR = "#16a34a";

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

function formatILS(v: number): string {
  return ILS.format(v);
}

function yAxisFormatter(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

function SapTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg min-w-[160px]" dir="rtl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">
        סכום: <span className="text-foreground font-medium">{formatILS(payload[0].value)}</span>
      </p>
    </div>
  );
}

export function SupplierSapPaymentSection({ supplierId, supplierNumber }: SupplierSapPaymentSectionProps) {
  const { rows, total2025, total2026, avgMonthly, peakMonth, loading } = useSupplierSapPayments(supplierId, supplierNumber);

  const tableRows = useMemo(() => {
    return rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1].amount : null;
      const pct = prev !== null && prev > 0 ? ((r.amount - prev) / prev) * 100 : null;
      return { ...r, pct };
    });
  }, [rows]);

  if (loading || rows.length === 0) return null;

  const has2025 = rows.some(r => r.month.startsWith("2025"));
  const has2026 = rows.some(r => r.month.startsWith("2026"));

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-5">
      {/* Header */}
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <span>📊</span> תשלומים חודשיים (SAP)
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {has2025 && (
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">סה״כ 2025</p>
            <p className="text-base font-bold text-foreground">{formatILS(total2025)}</p>
          </div>
        )}
        {has2026 && (
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">סה״כ 2026</p>
            <p className="text-base font-bold text-foreground">{formatILS(total2026)}</p>
          </div>
        )}
        <div className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">ממוצע חודשי</p>
          <p className="text-base font-bold text-foreground">{formatILS(Math.round(avgMonthly))}</p>
        </div>
        {peakMonth && (
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">חודש שיא</p>
            <p className="text-base font-bold text-foreground">{formatILS(peakMonth.amount)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{peakMonth.label}</p>
          </div>
        )}
      </div>

      {/* Bar Chart */}
      <div className="h-[240px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 4 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="shortLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} domain={[0, "auto"]} />
            <Tooltip content={<SapTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="amount" fill={BAR_COLOR} radius={[3, 3, 0, 0]} maxBarSize={48} />
            {avgMonthly > 0 && (
              <ReferenceLine
                y={avgMonthly}
                stroke={AVG_COLOR}
                strokeDasharray="5 4"
                strokeOpacity={0.7}
                label={{ value: yAxisFormatter(Math.round(avgMonthly)), position: "insideTopLeft", fontSize: 10, fill: AVG_COLOR }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-2.5 font-semibold text-foreground">חודש</th>
              <th className="text-left p-2.5 font-semibold text-foreground">סכום</th>
              <th className="text-left p-2.5 font-semibold text-foreground">% שינוי</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tableRows.map(r => (
              <tr key={r.month} className="hover:bg-muted/20">
                <td className="p-2.5 text-foreground">{r.label}</td>
                <td className="p-2.5 text-foreground font-mono text-xs text-left" dir="ltr">{formatILS(r.amount)}</td>
                <td className="p-2.5 text-left">
                  {r.pct === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={r.pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {r.pct >= 0 ? "+" : ""}{r.pct.toFixed(1)}%
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {/* Yearly totals */}
            {has2025 && (
              <tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td className="p-2.5 text-foreground">סה״כ 2025</td>
                <td className="p-2.5 text-foreground font-mono text-xs text-left" dir="ltr">{formatILS(total2025)}</td>
                <td className="p-2.5" />
              </tr>
            )}
            {has2026 && (
              <tr className="bg-muted/30 font-bold">
                <td className="p-2.5 text-foreground">סה״כ 2026</td>
                <td className="p-2.5 text-foreground font-mono text-xs text-left" dir="ltr">{formatILS(total2026)}</td>
                <td className="p-2.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
