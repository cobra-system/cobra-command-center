import { useState, useEffect, useCallback } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useData } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Recycle, Plus, Loader2 } from "lucide-react";
import { WasteItemsTab } from "@/components/waste/WasteItemsTab";
import { WasteDashboardTab } from "@/components/waste/WasteDashboardTab";
import { AddWasteItemDialog } from "@/components/waste/AddWasteItemDialog";
import { logger } from "@/lib/logger";

interface WasteItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  in_use: boolean;
  recommendations: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  photo_url: string | null;
  product_id: string | null;
  component_id: string | null;
  disposition_type: string | null;
  disposition_date: string | null;
  supplier_return_id: string | null;
  sale_buyer_name: string | null;
  sale_price: number | null;
  unit_cost: number | null;
  supplier_id: string | null;
}

interface SupplierReturn {
  id: string;
  status: string;
  shipped_at: string | null;
}

export default function WasteManagementPage() {
  const { products } = useData();
  const { currentUser } = useAuth();
  const { hasEdit, isManager } = usePermissions("waste");

  const [wasteItems, setWasteItems] = useState<WasteItem[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [{ data: items }, { data: returns }] = await Promise.all([
        isManager
          ? supabase.from("waste_items").select("*").order("created_at", { ascending: false })
          : supabase.from("waste_items").select("*").eq("created_by", currentUser?.id ?? "").order("created_at", { ascending: false }),
        supabase.from("supplier_returns").select("id, status, shipped_at").is("deleted_at", null),
      ]);
      setWasteItems((items as WasteItem[]) ?? []);
      setSupplierReturns((returns as SupplierReturn[]) ?? []);
    } catch (err) {
      logger.error("WasteManagementPage fetchData error", err);
    }
  }, [isManager, currentUser]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // Single realtime subscription for both tables
  useEffect(() => {
    const channel = supabase
      .channel("waste-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "waste_items" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "supplier_returns" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleAddSaved = () => {
    setAddDialogOpen(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Recycle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ניהול בלאי</h1>
            <p className="text-sm text-muted-foreground">
              {isManager ? "תצוגת ניהול — כל הפריטים מכל העובדים" : "תיעוד וניהול פריטי בלאי"}
            </p>
          </div>
        </div>
        {hasEdit && (
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            הוסף פריט בלאי
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList>
          <TabsTrigger value="dashboard">דשבורד</TabsTrigger>
          <TabsTrigger value="items">פריטי בלאי</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <WasteDashboardTab
            wasteItems={wasteItems}
            supplierReturns={supplierReturns}
            onAddItem={() => setAddDialogOpen(true)}
            hasEdit={hasEdit}
          />
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          <WasteItemsTab
            items={wasteItems}
            onRefresh={fetchData}
            products={products}
          />
        </TabsContent>
      </Tabs>

      <AddWasteItemDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSaved={handleAddSaved}
        products={products}
      />
    </div>
  );
}
