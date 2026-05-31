import { useSearchParams } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useData } from "@/contexts/AppContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Recycle } from "lucide-react";
import { WasteItemsTab } from "@/components/waste/WasteItemsTab";
import { SupplierReturnsTab } from "@/components/waste/SupplierReturnsTab";
import { WasteStatsTab } from "@/components/waste/WasteStatsTab";

export default function WasteManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { products } = useData();
  const { hasEdit, isManager } = usePermissions("waste");

  const activeTab = searchParams.get("tab") ?? "items";
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  return (
    <div className="space-y-5">
      {/* Header */}
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

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList>
          <TabsTrigger value="items">פריטים</TabsTrigger>
          <TabsTrigger value="returns">החזרות לספקים</TabsTrigger>
          <TabsTrigger value="stats">סטטיסטיקות</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <WasteItemsTab products={products} />
        </TabsContent>

        <TabsContent value="returns" className="mt-4">
          <SupplierReturnsTab canCreate={hasEdit} />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <WasteStatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
