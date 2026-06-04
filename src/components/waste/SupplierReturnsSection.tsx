import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SupplierReturnStatusBadge } from "./DispositionBadge";
import { SupplierReturnDetailPanel } from "./SupplierReturnDetailPanel";
import { PackageX, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SupplierReturn {
  id: string;
  supplier_id: string;
  status: string;
  tracking_number: string | null;
  return_reason: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  shipped_at: string | null;
  received_at: string | null;
  settled_at: string | null;
  created_by_name: string | null;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
  suppliers?: { name: string };
}

interface WasteItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  photo_url: string | null;
}

export function SupplierReturnsSection({ supplierId }: { supplierId: string }) {
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupplierReturn | null>(null);
  const [selectedItems, setSelectedItems] = useState<WasteItem[]>([]);
  const navigate = useNavigate();

  const fetchReturns = async () => {
    const { data } = await supabase
      .from("supplier_returns")
      .select("*, suppliers(name)")
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setReturns((data ?? []) as unknown as SupplierReturn[]);
    setLoading(false);
  };

  useEffect(() => { fetchReturns(); }, [supplierId]);

  const handleOpen = async (ret: SupplierReturn) => {
    const { data: items } = await supabase
      .from("waste_items")
      .select("id, product_name, sku, quantity, photo_url")
      .eq("supplier_return_id", ret.id);
    setSelectedItems(items ?? []);
    setSelected(ret);
  };

  if (loading) return null;
  if (returns.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageX className="h-4 w-4 text-muted-foreground" />
            החזרות לספק ({returns.length})
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs"
            onClick={() => navigate(`/waste-management?tab=returns`)}
          >
            <ExternalLink className="h-3 w-3" />
            כל ההחזרות
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {returns.slice(0, 5).map(ret => (
            <div
              key={ret.id}
              className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/40 cursor-pointer transition-colors"
              onClick={() => handleOpen(ret)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <SupplierReturnStatusBadge status={ret.status} />
                <span className="text-sm text-muted-foreground truncate">
                  {ret.return_reason ?? new Date(ret.created_at).toLocaleDateString("he-IL")}
                </span>
              </div>
              {ret.tracking_number && (
                <code className="text-xs font-mono text-muted-foreground shrink-0 ms-2">{ret.tracking_number}</code>
              )}
            </div>
          ))}
          {returns.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{returns.length - 5} נוספות
            </p>
          )}
        </div>
      </CardContent>

      {selected && (
        <SupplierReturnDetailPanel
          open={!!selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { fetchReturns(); setSelected(null); }}
          supplierReturn={selected}
          items={selectedItems}
        />
      )}
    </Card>
  );
}
