import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Package, TrendingDown, ShoppingCart } from "lucide-react";
import { FrisbeeDashboard } from "@/components/frisbee/FrisbeeDashboard";
import { DIVISION_COLORS, BONDED_DIVISIONS } from "@/components/equipment/constants";

// Base44 branch IDs for divisions that have QA inspection data
const FRISBEE_BASE44_BRANCHES: Record<string, string> = {
  "פריזבי קרסו": "68fa0cbd274acbfa7b159523",
};

interface DivisionProduct {
  id: string;
  product_id: string;
  division_stock: number;
  quarterly_demand: number | null;
  products: { id: string; name: string; sku: string };
}

interface OrderRequest {
  id: string;
  status: string;
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export default function DivisionConsumptionPage() {
  const { divisionName } = useParams<{ divisionName: string }>();
  const navigate = useNavigate();
  const { products } = useData();

  const division = divisionName ? decodeURIComponent(divisionName) : "";

  useEffect(() => {
    if (division && !BONDED_DIVISIONS.has(division)) {
      navigate(`/equipment/division/${encodeURIComponent(division)}`, { replace: true });
    }
  }, [division, navigate]);

  const [divisionProducts, setDivisionProducts] = useState<DivisionProduct[]>([]);
  const [orderRequests, setOrderRequests] = useState<OrderRequest[]>([]);
  const [frisbeeLastSynced, setFrisbeeLastSynced] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!division) return;
    setLoading(true);

    const [dpRes, orRes] = await Promise.all([
      supabase
        .from("division_products")
        .select("id, product_id, division_stock, quarterly_demand, products(id, name, sku)")
        .eq("division", division),
      supabase
        .from("order_requests")
        .select("id, status")
        .eq("division", division),
    ]);

    setDivisionProducts((dpRes.data ?? []) as unknown as DivisionProduct[]);
    setOrderRequests((orRes.data ?? []) as OrderRequest[]);

    const frisbeeBranchId = FRISBEE_BASE44_BRANCHES[division] ?? null;
    if (frisbeeBranchId) {
      const { data: syncData } = await supabase
        .from("frisbee_equipment_consumption")
        .select("last_synced_at")
        .eq("base44_branch_id", frisbeeBranchId)
        .order("last_synced_at", { ascending: false })
        .limit(1)
        .single();
      setFrisbeeLastSynced(syncData?.last_synced_at ?? null);
    }

    setLoading(false);
  }, [division]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const totalDivisionStock = useMemo(
    () => divisionProducts.reduce((s, dp) => s + (dp.division_stock ?? 0), 0),
    [divisionProducts]
  );
  const totalQuarterlyDemand = useMemo(
    () => divisionProducts.reduce((s, dp) => s + (dp.quarterly_demand ?? 0), 0),
    [divisionProducts]
  );
  const pendingOrdersCount = useMemo(
    () => orderRequests.filter((r) => r.status === "pending").length,
    [orderRequests]
  );

  const colorClass = DIVISION_COLORS[division] ?? "border-gray-300 text-gray-700 bg-gray-50";
  const frisbeeBranchId = FRISBEE_BASE44_BRANCHES[division] ?? null;

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>{division}</Badge>
        <span className="text-muted-foreground text-sm flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          ניתוח צריכה
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "מוצרים פעילים",
            value: divisionProducts.length,
            icon: Package,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "מלאי בשטח (סה״כ יח׳)",
            value: fmtNum(totalDivisionStock),
            icon: TrendingDown,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            label: "דרישה רבעונית (סה״כ)",
            value: fmtNum(totalQuarterlyDemand),
            icon: BarChart3,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "בקשות ממתינות",
            value: pendingOrdersCount,
            icon: ShoppingCart,
            color: pendingOrdersCount > 0 ? "text-amber-600" : "text-green-600",
            bg: pendingOrdersCount > 0 ? "bg-amber-50" : "bg-green-50",
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className={`inline-flex p-1.5 rounded-lg ${kpi.bg} mb-2`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Frisbee analytics (only for branches with Base44 integration) */}
      {frisbeeBranchId && (
        <FrisbeeDashboard
          branchId={frisbeeBranchId}
          division={division}
          lastSynced={frisbeeLastSynced}
        />
      )}

      {/* Consumption summary for non-Frisbee bonded divisions */}
      {!frisbeeBranchId && divisionProducts.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
            סיכום צריכה לפי מוצר
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-right p-3 font-semibold">מוצר</th>
                      <th className="text-right p-3 font-semibold">מלאי בשטח</th>
                      <th className="text-right p-3 font-semibold">דרישה רבעונית</th>
                      <th className="text-right p-3 font-semibold">מלאי מרכז לוגיסטי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divisionProducts.map((dp) => {
                      const mainProduct = productMap.get(dp.product_id);
                      return (
                        <tr
                          key={dp.id}
                          className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          onClick={() => navigate(`/products/${dp.product_id}`)}
                        >
                          <td className="p-3 font-medium">
                            <div>{dp.products.name}</div>
                            <div className="text-xs text-muted-foreground">{dp.products.sku}</div>
                          </td>
                          <td className="p-3 tabular-nums">{fmtNum(dp.division_stock)}</td>
                          <td className="p-3 tabular-nums">{fmtNum(dp.quarterly_demand)}</td>
                          <td className="p-3 tabular-nums text-muted-foreground">
                            {fmtNum(mainProduct?.stock_qty)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
