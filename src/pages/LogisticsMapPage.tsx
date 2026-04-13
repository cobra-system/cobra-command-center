import { useState, useCallback, useEffect } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useWarehouseInventory } from "@/hooks/useWarehouseInventory";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneProduct } from "@/hooks/useWarehouseInventory";
import WarehouseMap from "@/components/logistics-map/WarehouseMap";
import ZoneDetailPanel from "@/components/logistics-map/ZoneDetailPanel";
import ZoneEditDialog from "@/components/logistics-map/ZoneEditDialog";
import ZoneConfigDialog from "@/components/logistics-map/ZoneConfigDialog";
import ZoneTransferDialog from "@/components/logistics-map/ZoneTransferDialog";
import PickingListPanel from "@/components/logistics-map/PickingListPanel";
import MapLegend from "@/components/logistics-map/MapLegend";
import MapSearchBar from "@/components/logistics-map/MapSearchBar";
import { printFloorPlan } from "@/components/logistics-map/PrintMapUtils";
import { logZoneChange } from "@/components/logistics-map/ZoneConfigDialog";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { Button } from "@/components/ui/button";
import { Map, Plus, Thermometer, PenSquare, ListChecks, Printer } from "lucide-react";

export default function LogisticsMapPage() {
  const { hasEdit } = usePermissions("logistics-map");
  const { zones, zoneInventoryMap, allProducts, loading, refetch } = useWarehouseInventory();
  const { suppliers, products: appProducts, addOrder } = useData();

  // ── Zone detail / edit ──────────────────────────────────────────────────────
  const [selectedZone, setSelectedZone] = useState<WarehouseZone | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // ── Zone config (create/edit zone props) ────────────────────────────────────
  const [showZoneConfig, setShowZoneConfig] = useState(false);
  const [zoneToEdit, setZoneToEdit] = useState<WarehouseZone | null>(null);

  // ── Zone product transfer ────────────────────────────────────────────────────
  const [showTransfer, setShowTransfer] = useState(false);

  // ── Quick reorder ────────────────────────────────────────────────────────────
  const [showReorder, setShowReorder] = useState(false);
  const [reorderProduct, setReorderProduct] = useState<string | undefined>(undefined);

  // ── Map modes ───────────────────────────────────────────────────────────────
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pickingMode, setPickingMode] = useState(false);
  const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(new Set());
  const [showPickingList, setShowPickingList] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleZoneClick = useCallback(
    (zone: WarehouseZone) => {
      if (pickingMode) {
        setSelectedZoneIds((prev) => {
          const next = new Set(prev);
          if (next.has(zone.id)) next.delete(zone.id);
          else next.add(zone.id);
          return next;
        });
        return;
      }
      if (editMode) return; // drag mode — clicks handled as drags
      setSelectedZone(zone);
      setShowDetail(true);
    },
    [pickingMode, editMode],
  );

  const handleOpenZoneConfig = useCallback((zone: WarehouseZone | null) => {
    setZoneToEdit(zone);
    setShowZoneConfig(true);
  }, []);

  const handleCloseZoneConfig = useCallback(() => {
    setShowZoneConfig(false);
    setZoneToEdit(null);
  }, []);

  const handleZoneConfigSaved = useCallback(() => {
    handleCloseZoneConfig();
    refetch();
  }, [handleCloseZoneConfig, refetch]);

  // Drag & drop save — also writes to change log
  const handleZoneMoved = useCallback(
    async (zoneId: string, gridRow: string, gridCol: string) => {
      const zone = zones.find((z) => z.id === zoneId);
      const { error } = await supabase
        .from("warehouse_zones")
        .update({ grid_row: gridRow, grid_col: gridCol, updated_at: new Date().toISOString() })
        .eq("id", zoneId);
      if (error) {
        console.error("[handleZoneMoved]", error);
        toast.error(`שגיאה בשמירת מיקום: ${error.message}`);
      } else {
        logZoneChange(zoneId, "move", {
          old_row: zone?.gridRow,
          old_col: zone?.gridColumn,
          new_row: gridRow,
          new_col: gridCol,
        });
        refetch();
      }
    },
    [refetch, zones],
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const toggleHeatmap = useCallback(() => setHeatmapMode((v) => !v), []);
  const toggleEditMode = useCallback(() => { setEditMode((v) => !v); setPickingMode(false); }, []);
  const togglePickingMode = useCallback(() => {
    setPickingMode((v) => !v);
    setSelectedZoneIds(new Set());
    setEditMode(false);
  }, []);

  // ── Reorder handler ─────────────────────────────────────────────────────────
  const handleReorder = useCallback((lowStockProducts: ZoneProduct[]) => {
    setReorderProduct(lowStockProducts[0]?.id);
    setShowDetail(false);
    setShowReorder(true);
  }, []);

  // ── Transfer handler ─────────────────────────────────────────────────────────
  const handleTransfer = useCallback(() => {
    setShowDetail(false);
    setShowTransfer(true);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof Element && e.target.closest("[role='dialog']")) return;

      switch (e.key.toUpperCase()) {
        case "H":
          toggleHeatmap();
          break;
        case "E":
          if (hasEdit) toggleEditMode();
          break;
        case "P":
          togglePickingMode();
          break;
        case "ESCAPE":
          if (editMode) { setEditMode(false); setPickingMode(false); }
          else if (pickingMode) { setPickingMode(false); setSelectedZoneIds(new Set()); }
          break;
        case "/":
          e.preventDefault();
          document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editMode, pickingMode, hasEdit, toggleHeatmap, toggleEditMode, togglePickingMode]);

  // ── Search highlighting ─────────────────────────────────────────────────────

  const highlightedZoneIds = new Set<string>();
  const searchActive = searchQuery.length > 0;
  if (searchActive) {
    const q = searchQuery.toLowerCase();
    for (const zone of zones) {
      if (zone.name.toLowerCase().includes(q) || zone.id.toLowerCase().includes(q)) {
        highlightedZoneIds.add(zone.id);
        continue;
      }
      const inv = zoneInventoryMap.get(zone.id);
      if (inv?.products.some((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))) {
        highlightedZoneIds.add(zone.id);
      }
    }
  }

  // In picking mode, selected zones are always highlighted
  const effectiveHighlighted = pickingMode
    ? new Set([...highlightedZoneIds, ...selectedZoneIds])
    : highlightedZoneIds;
  const effectiveSearchActive = searchActive || (pickingMode && selectedZoneIds.size > 0);

  const selectedZonesList = zones.filter((z) => selectedZoneIds.has(z.id));

  return (
    <div className="p-3 sm:p-4 lg:p-8 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Map className="w-6 h-6 text-primary flex-shrink-0" />
          <h1 className="text-2xl font-bold">מפת מחסן לוגיסטי</h1>

          <div className="mr-auto flex flex-wrap items-center gap-2">
            <MapSearchBar onSearch={handleSearch} />

            {/* Heatmap toggle */}
            <Button
              size="sm"
              variant={heatmapMode ? "default" : "outline"}
              onClick={toggleHeatmap}
              title="תצוגת מלאי (H)"
            >
              <Thermometer className="w-4 h-4 ml-1" />
              מלאי
              <kbd className="hidden sm:inline-block text-[9px] opacity-40 mr-1 font-mono border border-current rounded px-0.5">H</kbd>
            </Button>

            {/* Picking mode */}
            <Button
              size="sm"
              variant={pickingMode ? "default" : "outline"}
              onClick={togglePickingMode}
              title="מצב ליקוט (P)"
            >
              <ListChecks className="w-4 h-4 ml-1" />
              ליקוט
              <kbd className="hidden sm:inline-block text-[9px] opacity-40 mr-1 font-mono border border-current rounded px-0.5">P</kbd>
            </Button>

            {/* Print floor plan */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => printFloorPlan(zones, zoneInventoryMap)}
              title="הדפס מפה"
            >
              <Printer className="w-4 h-4" />
            </Button>

            {hasEdit && (
              <>
                {/* Edit mode (drag & drop) */}
                <Button
                  size="sm"
                  variant={editMode ? "default" : "outline"}
                  onClick={toggleEditMode}
                  title="ערוך מפה (E)"
                >
                  <PenSquare className="w-4 h-4 ml-1" />
                  ערוך מפה
                  <kbd className="hidden sm:inline-block text-[9px] opacity-40 mr-1 font-mono border border-current rounded px-0.5">E</kbd>
                </Button>

                {/* New zone */}
                <Button size="sm" onClick={() => handleOpenZoneConfig(null)}>
                  <Plus className="w-4 h-4 ml-1" />
                  אזור חדש
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mode banners */}
        {editMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
            <PenSquare className="w-4 h-4" />
            מצב עריכה פעיל — גרור ריבועים לשינוי מיקום, משוך פינות לשינוי גודל
            <Button size="sm" variant="ghost" className="mr-auto h-6 px-2" onClick={toggleEditMode}>
              סיים עריכה
            </Button>
          </div>
        )}
        {pickingMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium border border-amber-200">
            <ListChecks className="w-4 h-4" />
            מצב ליקוט — לחץ על אזורים לבחירה ({selectedZoneIds.size} נבחרו)
            {selectedZoneIds.size > 0 && (
              <Button
                size="sm"
                className="mr-auto h-6 px-2 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => setShowPickingList(true)}
              >
                הצג רשימה
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-[400px]">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <WarehouseMap
            zones={zones}
            zoneInventoryMap={zoneInventoryMap}
            highlightedZoneIds={effectiveHighlighted}
            searchActive={effectiveSearchActive}
            heatmapMode={heatmapMode}
            editMode={editMode}
            onZoneClick={handleZoneClick}
            onZoneMoved={handleZoneMoved}
          />
          <MapLegend heatmapMode={heatmapMode} />
        </>
      )}

      {/* Zone detail sheet */}
      <ZoneDetailPanel
        zone={selectedZone}
        inventoryData={selectedZone ? zoneInventoryMap.get(selectedZone.id) : undefined}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        onEdit={() => { setShowDetail(false); setShowEdit(true); }}
        onZoneConfig={() => { setShowDetail(false); handleOpenZoneConfig(selectedZone); }}
        onReorder={handleReorder}
        onTransfer={handleTransfer}
        canEdit={hasEdit}
      />

      {/* Zone products edit dialog */}
      <ZoneEditDialog
        zone={selectedZone}
        inventoryData={selectedZone ? zoneInventoryMap.get(selectedZone.id) : undefined}
        allProducts={allProducts}
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={refetch}
      />

      {/* Zone config dialog */}
      <ZoneConfigDialog
        zone={zoneToEdit}
        open={showZoneConfig}
        onClose={handleCloseZoneConfig}
        onSaved={handleZoneConfigSaved}
      />

      {/* Zone transfer dialog */}
      <ZoneTransferDialog
        zone={selectedZone}
        inventoryData={selectedZone ? zoneInventoryMap.get(selectedZone.id) : undefined}
        allZones={zones}
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        onSaved={() => { setShowTransfer(false); refetch(); }}
      />

      {/* Quick reorder dialog */}
      <NewOrderDialog
        suppliers={suppliers}
        products={appProducts}
        addOrder={addOrder}
        open={showReorder}
        onOpenChange={(o) => setShowReorder(o)}
        defaultProductId={reorderProduct}
        hideTrigger
      />

      {/* Picking list panel */}
      <PickingListPanel
        selectedZones={selectedZonesList}
        zoneInventoryMap={zoneInventoryMap}
        open={showPickingList}
        onClose={() => setShowPickingList(false)}
        onDeselectZone={(id) => setSelectedZoneIds((prev) => { const n = new Set(prev); n.delete(id); return n; })}
      />
    </div>
  );
}
