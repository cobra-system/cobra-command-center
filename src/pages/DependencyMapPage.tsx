import { useMemo } from "react";
import { useData } from "@/contexts/AppContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Map } from "lucide-react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface SupplierNode {
  name: string;
  size: number;
  products: string[];
  riskLevel: string;
  fill: string;
}

const riskColors: Record<string, string> = {
  "גבוה": "hsl(0, 72%, 51%)",
  "בינוני": "hsl(24, 80%, 42%)",
  "נמוך": "hsl(142, 71%, 35%)",
  "": "hsl(214, 55%, 40%)",
};

const CustomContent = (props: any) => {
  const { x, y, width, height, name, size } = props;
  if (width < 40 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={props.fill} stroke="hsl(0,0%,100%)" strokeWidth={2} rx={6} />
      <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="white" fontSize={width > 100 ? 13 : 10} fontWeight="bold">
        {name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="white" fontSize={10} opacity={0.8}>
        {size} מוצרים
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as SupplierNode;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 max-w-xs text-sm" dir="rtl">
      <p className="font-bold text-foreground mb-1">{data.name}</p>
      <p className="text-muted-foreground text-xs mb-2">סיכון: {data.riskLevel || "לא מוגדר"}</p>
      <p className="text-xs text-muted-foreground font-medium mb-1">מוצרים תלויים ({data.products.length}):</p>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {data.products.slice(0, 8).map((p, i) => <li key={i}>• {p}</li>)}
        {data.products.length > 8 && <li>...ועוד {data.products.length - 8}</li>}
      </ul>
    </div>
  );
};

export default function DependencyMapPage() {
  const { products, suppliers, loading } = useData();

  const treeData = useMemo(() => {
    const supplierMap: Record<string, { company: string; products: string[]; risk: string }> = {};

    products.forEach(p => {
      if (!p.supplier) return;
      const supplierName = p.supplier;
      const existing = supplierMap.get(supplierName);
      if (existing) {
        existing.products.push(p.name);
      } else {
        // Try to find risk level from suppliers table
        const supplierRecord = suppliers.find(s => s.company === supplierName);
        supplierMap.set(supplierName, {
          company: supplierName,
          products: [p.name],
          risk: supplierRecord?.risk_level || "",
        });
      }

      // Also check components
      if (p.components) {
        p.components.forEach(c => {
          if (c.supplier && c.supplier !== supplierName) {
            const compSupplier = supplierMap.get(c.supplier);
            if (compSupplier) {
              if (!compSupplier.products.includes(p.name)) compSupplier.products.push(p.name);
            } else {
              const sr = suppliers.find(s => s.company === c.supplier);
              supplierMap.set(c.supplier, {
                company: c.supplier,
                products: [p.name],
                risk: sr?.risk_level || "",
              });
            }
          }
        });
      }
    });

    return Array.from(supplierMap.values())
      .filter(s => s.products.length > 0)
      .map(s => ({
        name: s.company,
        size: s.products.length,
        products: s.products,
        riskLevel: s.risk,
        fill: riskColors[s.risk] || riskColors[""],
      }))
      .sort((a, b) => b.size - a.size);
  }, [products, suppliers]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>;

  const highRisk = treeData.filter(s => s.riskLevel === "גבוה");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Map className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">מפת תלויות ספקים</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        כל בועה מייצגת ספק. גודל = כמות מוצרים תלויים. צבע = רמת סיכון (🔴 גבוה, 🟠 בינוני, 🟢 נמוך, 🔵 לא מוגדר).
      </p>

      {/* High Risk Alert */}
      {highRisk.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-2">
          <p className="font-semibold text-destructive text-sm">⚠️ ספקים בסיכון גבוה:</p>
          {highRisk.map(s => (
            <div key={s.name} className="text-sm text-foreground">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground"> — אם לא מספק: </span>
              <span className="text-destructive font-medium">{s.products.join(", ")}</span>
              <span className="text-muted-foreground"> נפגעים</span>
            </div>
          ))}
        </div>
      )}

      {/* Treemap */}
      {treeData.length > 0 ? (
        <div className="bg-card rounded-xl border shadow-sm p-4">
          <ResponsiveContainer width="100%" height={450}>
            <Treemap
              data={treeData}
              dataKey="size"
              aspectRatio={4 / 3}
              content={<CustomContent />}
            >
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-card rounded-xl border p-12 text-center text-muted-foreground">
          אין נתוני ספקים מקושרים למוצרים
        </div>
      )}

      {/* Summary Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">ספק</th>
              <th className="text-right p-3 font-semibold text-foreground">מוצרים תלויים</th>
              <th className="text-right p-3 font-semibold text-foreground">רמת סיכון</th>
              <th className="text-right p-3 font-semibold text-foreground">מוצרים</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {treeData.map(s => (
              <tr key={s.name} className="hover:bg-muted/30">
                <td className="p-3 font-medium text-foreground">{s.name}</td>
                <td className="p-3 text-foreground font-bold">{s.size}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.riskLevel === "גבוה" ? "bg-destructive/15 text-destructive" :
                    s.riskLevel === "בינוני" ? "bg-warning/15 text-warning" :
                    s.riskLevel === "נמוך" ? "bg-success/15 text-success" :
                    "bg-muted text-muted-foreground"
                  }`}>{s.riskLevel || "—"}</span>
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-[300px] truncate">{s.products.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
