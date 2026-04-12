import { useState, useCallback } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useWarehouseInventory } from "@/hooks/useWarehouseInventory";
import { WAREHOUSE_ZONES, type WarehouseZone } from "@/data/warehouseZones";
import WarehouseMap from "@/components/logistics-map/WarehouseMap";
import ZoneDetailPanel from "@/components/logistics-map/ZoneDetailPanel";
import ZoneEditDialog from "@/components/logistics-map/ZoneEditDialog";
import MapLegend from "@/components/logistics-map/MapLegend";
import MapSearchBar from "@/components/logistics-map/MapSearchBar";
import { Map } from "lucide-react";

export default function LogisticsMapPage() {
  const { hasEdit } = usePermissions("logistics-map");
  const { zoneInventoryMap, allProducts, loading, refetch } = useWarehouseInventory();

  const [selectedZone, setSelectedZone] = useState<WarehouseZone | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleZoneClick = useCallback((zone: WarehouseZone) => {
    setSelectedZone(zone);
    setShowDetail(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
  }, []);

  const handleOpenEdit = useCallback(() => {
    setShowDetail(false);
    setShowEdit(true);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setShowEdit(false);
  }, []);

  const handleSaved = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
    },
    [],
  );

  // Compute highlighted zone IDs based on search query
  const highlightedZoneIds = new Set<string>();
  const searchActive = searchQuery.length > 0;
  if (searchActive) {
    const q = searchQuery.toLowerCase();
    for (const zone of WAREHOUSE_ZONES) {
      // Match zone name
      if (zone.name.toLowerCase().includes(q)) {
        highlightedZoneIds.add(zone.id);
        continue;
      }
      // Match zone id
      if (zone.id.toLowerCase().includes(q)) {
        highlightedZoneIds.add(zone.id);
        continue;
      }
      // Match products in zone
      const inv = zoneInventoryMap.get(zone.id);
      if (inv?.products.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      )) {
        highlightedZoneIds.add(zone.id);
      }
    }
  }

  return (
    <div className="p-3 sm:p-4 lg:p-8 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Map className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">מפת מחסן לוגיסטי</h1>
        </div>
        <div className="sm:mr-auto">
          <MapSearchBar onSearch={handleSearch} />
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-[400px]">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Map */}
          <WarehouseMap
            zoneInventoryMap={zoneInventoryMap}
            highlightedZoneIds={highlightedZoneIds}
            searchActive={searchActive}
            onZoneClick={handleZoneClick}
          />

          {/* Legend */}
          <MapLegend />
        </>
      )}

      {/* Zone detail sheet */}
      <ZoneDetailPanel
        zone={selectedZone}
        inventoryData={
          selectedZone ? zoneInventoryMap.get(selectedZone.id) : undefined
        }
        open={showDetail}
        onClose={handleCloseDetail}
        onEdit={handleOpenEdit}
        canEdit={hasEdit}
      />

      {/* Zone edit dialog */}
      <ZoneEditDialog
        zone={selectedZone}
        inventoryData={
          selectedZone ? zoneInventoryMap.get(selectedZone.id) : undefined
        }
        allProducts={allProducts}
        open={showEdit}
        onClose={handleCloseEdit}
        onSaved={handleSaved}
      />
    </div>
  );
}
