import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Trash2,
  Truck,
  DollarSign,
  Clock,
  HelpCircle,
  AlertTriangle,
  Plus,
  TrendingUp,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

interface WasteItem {
  id: string;
  disposition_type: string | null;
  quantity: number;
  created_at: string;
  in_use: boolean;
}

interface SupplierReturn {
  id: string;
  status: string;
  shipped_at: string | null;
}

interface Props {
  wasteItems: WasteItem[];
  supplierReturns: SupplierReturn[];
  onAddItem: () => void;
  hasEdit: boolean;
}

const DISPOSITION_COLORS: Record<string, string> = {
  "ממתין": "#94a3b8",
  "השמדה": "#ef4444",
  "החזרה לספק": "#3b82f6",
  "מכירה בערוץ שלישי": "#f59e0b",
  "מכירה": "#f59e0b",
  "אחר": "#a855f7",
};

const STATUS_COLORS: Record<string, string> = {
  "טיוטה": "#94a3b8",
  "נשלח": "#3b82f6",
  "התקבל אצל ספק": "#f97316",
  "הוסדר": "#22c55e",
};

function StatCard({
  label,
  value,
  icon,
  color,
  subLabel,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subLabel?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`transition-shadow hover:shadow-md ${highlight ? "border-amber-400 dark:border-amber-500" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-sm font-medium text-foreground">{label}</p>
            {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WasteDashboardTab({ wasteItems, supplierReturns, onAddItem, hasEdit }: Props) {
  const stats = useMemo(() => {
    const total = wasteItems.length;
    const pending = wasteItems.filter((i) => !i.disposition_type).length;
    const destroyed = wasteItems.filter((i) => i.disposition_type === "השמדה").length;
    const returned = wasteItems.filter((i) => i.disposition_type === "החזרה לספק").length;
    const sold = wasteItems.filter(
      (i) => i.disposition_type === "מכירה" || i.disposition_type === "מכירה בערוץ שלישי"
    ).length;
    const other = wasteItems.filter((i) => i.disposition_type === "אחר").length;
    const totalQty = wasteItems.reduce((s, i) => s + i.quantity, 0);
    const inUse = wasteItems.filter((i) => i.in_use).length;

    const handled = total - pending;
    const handledPct = total > 0 ? Math.round((handled / total) * 100) : 0;

    return { total, pending, destroyed, returned, sold, other, totalQty, inUse, handled, handledPct };
  }, [wasteItems]);

  const stuckReturns = useMemo(() => {
    return supplierReturns.filter((r) => {
      if (r.status !== "נשלח" || !r.shipped_at) return false;
      const days = (Date.now() - new Date(r.shipped_at).getTime()) / (1000 * 60 * 60 * 24);
      return days > 14;
    }).length;
  }, [supplierReturns]);

  const dispositionChartData = useMemo(() => {
    const counts: Record<string, number> = { "ממתין": 0 };
    wasteItems.forEach((i) => {
      const key = i.disposition_type === "מכירה" ? "מכירה בערוץ שלישי" : (i.disposition_type ?? "ממתין");
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [wasteItems]);

  const returnStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    supplierReturns.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [supplierReturns]);

  const recentItems = useMemo(() => {
    return [...wasteItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [wasteItems]);

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">סקירת מצב בלאי</h2>
          <p className="text-sm text-muted-foreground">
            {stats.total} פריטים · {stats.handledPct}% טופלו
          </p>
        </div>
        {hasEdit && (
          <Button onClick={onAddItem} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            הוסף פריט בלאי
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">התקדמות טיפול בבלאי</span>
              <Badge variant="secondary" className="font-mono">{stats.handledPct}%</Badge>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${stats.handledPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{stats.handled} פריטים טופלו</span>
              <span>{stats.pending} ממתינים לטיפול</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard
          label='סה"כ פריטים'
          value={stats.total}
          icon={<Package className="h-5 w-5 text-blue-600" />}
          color="bg-blue-100/70 dark:bg-blue-900/30"
          subLabel={`${stats.totalQty} יחידות`}
        />
        <StatCard
          label="ממתינים לטיפול"
          value={stats.pending}
          icon={<Clock className="h-5 w-5 text-slate-500" />}
          color="bg-muted"
        />
        <StatCard
          label="הושמדו"
          value={stats.destroyed}
          icon={<Trash2 className="h-5 w-5 text-red-600" />}
          color="bg-red-100/70 dark:bg-red-900/30"
        />
        <StatCard
          label="הוחזרו לספק"
          value={stats.returned}
          icon={<Truck className="h-5 w-5 text-blue-600" />}
          color="bg-blue-100/70 dark:bg-blue-900/30"
          subLabel={`${supplierReturns.length} החזרות פתוחות`}
        />
        <StatCard
          label="נמכרו"
          value={stats.sold}
          icon={<DollarSign className="h-5 w-5 text-amber-600" />}
          color="bg-amber-100/70 dark:bg-amber-900/30"
        />
        <StatCard
          label="אחר"
          value={stats.other}
          icon={<HelpCircle className="h-5 w-5 text-purple-600" />}
          color="bg-purple-100/70 dark:bg-purple-900/30"
          highlight={stuckReturns > 0}
          subLabel={stuckReturns > 0 ? `${stuckReturns} החזרות תקועות!` : undefined}
        />
      </div>

      {/* Alerts */}
      {(stuckReturns > 0 || stats.pending > 0) && (
        <div className="space-y-2">
          {stuckReturns > 0 && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {stuckReturns} החזרות תקועות
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  החזרות שנשלחו לפני 14+ יום ועדיין ללא אישור קבלה
                </p>
              </div>
            </div>
          )}
          {stats.pending > 3 && (
            <div className="flex items-center gap-3 p-4 bg-muted/50 border rounded-lg">
              <Layers className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{stats.pending} פריטים ממתינים לסיווג</p>
                <p className="text-xs text-muted-foreground">פריטים שטרם הוגדרה להם פעולה</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {dispositionChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                פריטים לפי סוג פעולה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dispositionChartData} layout="vertical" margin={{ right: 20 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v, "פריטים"]} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={30}>
                    {dispositionChartData.map((entry) => (
                      <Cell key={entry.name} fill={DISPOSITION_COLORS[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {returnStatusData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                החזרות לספקים לפי סטטוס
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={returnStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {returnStatusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, "החזרות"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent items */}
      {recentItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">פריטים שנוספו לאחרונה</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentItems.map((item: WasteItem & { product_name?: string; created_by_name?: string }) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-muted rounded-md">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{(item as Record<string, unknown>).product_name as string ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("he-IL")}
                        {(item as Record<string, unknown>).created_by_name ? ` · ${(item as Record<string, unknown>).created_by_name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{item.quantity} יח׳</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      !item.disposition_type ? "bg-muted text-muted-foreground" :
                      item.disposition_type === "השמדה" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                      item.disposition_type === "החזרה לספק" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {item.disposition_type ?? "ממתין"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.total === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 bg-muted/30 rounded-full mb-4">
            <Package className="h-14 w-14 text-muted-foreground/30" />
          </div>
          <p className="text-lg font-medium text-muted-foreground mb-2">אין פריטי בלאי עדיין</p>
          <p className="text-sm text-muted-foreground/70 mb-5">התחל לתעד פריטי בלאי כדי לראות נתונים כאן</p>
          {hasEdit && (
            <Button onClick={onAddItem} className="gap-2">
              <Plus className="h-4 w-4" />
              הוסף פריט בלאי ראשון
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
