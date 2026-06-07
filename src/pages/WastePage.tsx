import { useSearchParams } from "react-router-dom";
import { WasteItemsTab } from "@/components/waste/WasteItemsTab";
import { WasteSupplierReturnsTab } from "@/components/waste/WasteSupplierReturnsTab";
import { cn } from "@/lib/utils";

type Tab = "items" | "returns";

export default function WastePage() {
  const [params, setParams] = useSearchParams();
  const activeTab = (params.get("tab") as Tab) ?? "items";

  function setTab(tab: Tab) {
    setParams(prev => { prev.set("tab", tab); return prev; });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b bg-background px-4 md:px-6 pt-4 pb-0">
        <h1 className="text-2xl font-bold text-foreground mb-4">ניהול בלאי</h1>
        <div className="flex gap-1">
          {(["items", "returns"] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "items" ? "פריטי בלאי" : "החזרות לספק"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "items" && <WasteItemsTab />}
        {activeTab === "returns" && <WasteSupplierReturnsTab />}
      </div>
    </div>
  );
}
