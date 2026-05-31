import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, Trash2, PackageX, DollarSign, Box, BarChart2, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface WasteItem {
  id: string;
  disposition_type: string | null;
  quantity: number;
}

interface SupplierReturn {
  id: string;
  status: string;
  shipped_at: string | null;
}

const DISPOSITION_COLORS: Record<string, string> = {
  ממתין: "#94a3b8",
  השמדה: "#ef4444",
  "החזרה לספק": "#3b82f6",
  מכירה: "#f59e0b",
};

const STATUS_COLORS: Record<string, string> = {
  טיוטה: "#94a3b8",
  נשלח: "#3b82f6",
  "התקבל אצל ספק": "#f97316",
  הוסדר: "#22c55e",
};

export function WasteStatsTab() {
  const [wasteItems, setWasteItems] = useState<WasteItem[]>([]);
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("waste_items").select("id, disposition_type, quantity"),
      supabase.from("supplier_returns").select("id, status, shipped_at").is("deleted_at", null),
    ]).then(([{ data: items }, { data: rets }]) => {
      setWasteItems(items ?? []);
      setReturns(rets ?? []);
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const total = wasteItems.length;
    const pending = wasteItems.filter((i) => !i.disposition_type).length;
    const destroyed = wasteItems.filter((i) => i.disposition_type === "השמדה").length;
    const returned = wasteItems.filter((i) => i.disposition_type === "החזרה לספק").length;
    const sold = wasteItems.filter((i) => i.disposition_type === "מכירה").length;
    const totalQty = wasteItems.reduce((s, i) => s + i.quantity, 0);
    return { total, pending, destroyed, returned, sold, totalQty };
  }, [wasteItems]);

  const dispositionChartData = useMemo(() => [
    { name: "ממתין", value: stats.pending },
    { name: "השמדה", value: stats.destroyed },
    { name: "החזרה לספק", value: stats.returned },
    { name: "מכירה", value: stats.sold },
  ].filter((d) => d.value > 0), [stats]);

  const stuckReturns = useMemo(() => {
    return returns.filter((r) => {
      if (r.status !== "נשלח" || !r.shipped_at) return false;
      const daysDiff = (Date.now() - new Date(r.shipped_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 14;
    }).length;
  }, [returns]);

  const returnStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    returns.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [returns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Package className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">סה"כ פריטים</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg"><Box className="h-5 w-5 text-muted-foreground" /></div>
            <div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">ממתינים לפינוי</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg"><Trash2 className="h-5 w-5 text-red-500" /></div>
            <div><p className="text-2xl font-bold">{stats.destroyed}</p><p className="text-xs text-muted-foreground">הושמדו</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><PackageX className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-2xl font-bold">{stats.returned}</p><p className="text-xs text-muted-foreground">הוחזרו לספק</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg"><DollarSign className="h-5 w-5 text-amber-500" /></div>
            <div><p className="text-2xl font-bold">{stats.sold}</p><p className="text-xs text-muted-foreground">נמכרו</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg"><BarChart2 className="h-5 w-5 text-purple-500" /></div>
            <div><p className="text-2xl font-bold">{stats.totalQty}</p><p className="text-xs text-muted-foreground">סה"כ כמות</p></div>
          </CardContent>
        </Card>
        <Card className={stuckReturns > 0 ? "border-amber-400" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
            <div>
              <p className="text-2xl font-bold">{stuckReturns}</p>
              <p className="text-xs text-muted-foreground">החזרות תקועות</p>
              {stuckReturns > 0 && <p className="text-xs text-amber-600 font-medium">ממתין מעל 14 יום</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {dispositionChartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">פריטים לפי סוג פינוי</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dispositionChartData} layout="vertical">
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [v, "פריטים"]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
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
            <CardHeader><CardTitle className="text-sm">החזרות לספקים לפי סטטוס</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={returnStatusData} layout="vertical">
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [v, "החזרות"]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {returnStatusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
