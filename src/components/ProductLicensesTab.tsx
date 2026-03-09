import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ScrollText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface LinkedCompliance {
  id: string;
  compliance_item_id: string;
  compliance_item: {
    id: string;
    name: string;
    category: string;
    expiry_date: string | null;
    status: string;
  };
}

function getDaysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ daysLeft, status }: { daysLeft: number | null; status: string }) {
  if (status === "missing" || daysLeft === null) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">⬜ חסר</span>;
  if (daysLeft < 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/15 text-destructive">🔴 פג</span>;
  if (daysLeft <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/15 text-destructive">🔴 {daysLeft} ימים</span>;
  if (daysLeft <= 90) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">🟡 {daysLeft} ימים</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">🟢 {daysLeft} ימים</span>;
}

export default function ProductLicensesTab({ productId, isManager }: { productId: string; isManager: boolean }) {
  const navigate = useNavigate();
  const [links, setLinks] = useState<LinkedCompliance[]>([]);
  const [allItems, setAllItems] = useState<{ id: string; name: string; category: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string>("");

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("compliance_product_links")
      .select("id, compliance_item_id, compliance_items:compliance_item_id(id, name, category, expiry_date, status)")
      .eq("product_id", productId);
    if (data) {
      setLinks(data.map((d: any) => ({ id: d.id, compliance_item_id: d.compliance_item_id, compliance_item: d.compliance_items })));
    }
    setLoading(false);
  }, [productId]);

  const fetchAllItems = useCallback(async () => {
    const { data } = await supabase.from("compliance_items").select("id, name, category").order("name");
    if (data) setAllItems(data);
  }, []);

  useEffect(() => { fetchLinks(); fetchAllItems(); }, [fetchLinks, fetchAllItems]);

  const handleAdd = async () => {
    if (!addingId) return;
    const { error } = await supabase.from("compliance_product_links").insert({ compliance_item_id: addingId, product_id: productId });
    if (error) { toast.error("שגיאה בקישור"); return; }
    toast.success("רישיון קושר למוצר");
    setAddingId("");
    fetchLinks();
  };

  const handleRemove = async (linkId: string) => {
    await supabase.from("compliance_product_links").delete().eq("id", linkId);
    toast.success("קישור הוסר");
    fetchLinks();
  };

  const linkedIds = new Set(links.map(l => l.compliance_item_id));
  const availableItems = allItems.filter(i => !linkedIds.has(i.id));

  if (loading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">רישיונות ואישורים</h2>
        </div>
      </div>

      {links.length === 0 && !isManager && (
        <p className="text-sm text-muted-foreground text-center py-4">אין רישיונות מקושרים למוצר זה</p>
      )}

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map(link => {
            const item = link.compliance_item;
            const daysLeft = getDaysRemaining(item.expiry_date);
            return (
              <div key={link.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => navigate("/compliance")} className="text-sm font-medium text-primary hover:underline truncate">
                    {item.name}
                  </button>
                  <span className="text-xs text-muted-foreground">{item.category}</span>
                  <StatusBadge daysLeft={daysLeft} status={item.status} />
                </div>
                {isManager && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(link.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isManager && availableItems.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={addingId} onValueChange={setAddingId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="בחר רישיון לקישור..." /></SelectTrigger>
            <SelectContent>
              {availableItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.category})</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleAdd} disabled={!addingId}>
            <Plus className="h-3 w-3 ml-1" />קשר
          </Button>
        </div>
      )}
    </div>
  );
}
