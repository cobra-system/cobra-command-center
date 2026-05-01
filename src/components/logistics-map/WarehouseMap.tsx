import { useState, useRef, useCallback, useEffect } from "react";
import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";
import ZoneBlock, { type ResizeHandle } from "./ZoneBlock";

// ── Grid constants ────────────────────────────────────────────────────────────

const GRID_COLS = 24;
const GRID_ROWS = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DragState {
  zoneId: string;
  // Size of the dragged zone (in cells)
  colSpan: number;
  rowSpan: number;
  // Cell the pointer grabbed relative to zone top-left (0-based)
  grabColOffset: number;
  grabRowOffset: number;
}

interface ResizeState {
  zoneId: string;
  handle: ResizeHandle;
  original: { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
}

interface GhostPos {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseGrid(s: string): [number, number] {
  const [a, b] = s.split(" / ").map(Number);
  return [a, b];
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Convert pixel position in the RTL grid to 1-based (col, row) grid coords */
function pixelToCell(
  x: number,
  y: number,
  rect: DOMRect,
): { col: number; row: number } {
  const cellW = rect.width / GRID_COLS;
  const cellH = rect.height / GRID_ROWS;
  // RTL: x=0 is LEFT side = grid column GRID_COLS; x=rect.width is column 1
  const colFromLeft = Math.floor((x - rect.left) / cellW); // 0-based from left
  const col = GRID_COLS - colFromLeft; // RTL: flip
  const row = Math.floor((y - rect.top) / cellH) + 1; // 1-based
  return {
    col: clamp(col, 1, GRID_COLS),
    row: clamp(row, 1, GRID_ROWS),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WarehouseMapProps {
  zones: WarehouseZone[];
  zoneInventoryMap: Map<string, ZoneInventoryData>;
  highlightedZoneIds: Set<string>;
  searchActive: boolean;
  heatmapMode: boolean;
  editMode: boolean;
  onZoneClick: (zone: WarehouseZone) => void;
  onZoneMoved: (zoneId: string, gridRow: string, gridCol: string) => void;
}

export default function WarehouseMap({
  zones,
  zoneInventoryMap,
  highlightedZoneIds,
  searchActive,
  heatmapMode,
  editMode,
  onZoneClick,
  onZoneMoved,
}: WarehouseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const lastDistance = useRef<number | null>(null);

  // Drag state
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const [ghost, setGhost] = useState<GhostPos | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // ── Pinch-to-zoom ───────────────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDistance.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      const delta = distance / lastDistance.current;
      setScale((prev) => Math.min(3, Math.max(0.5, prev * delta)));
      lastDistance.current = distance;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastDistance.current = null;
  }, []);

  // ── Drag start (zone body) ──────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (zone: WarehouseZone, e: React.PointerEvent) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const [rowStart, rowEnd] = parseGrid(zone.gridRow);
      const [colStart, colEnd] = parseGrid(zone.gridColumn);
      const rowSpan = rowEnd - rowStart;
      const colSpan = colEnd - colStart;

      // Which cell inside the zone did the user grab?
      const grabbed = pixelToCell(e.clientX, e.clientY, rect);
      // In RTL: col increases to the right visually → colStart is the rightmost
      const grabColOffset = colStart - grabbed.col; // how many cols from zone's right edge
      const grabRowOffset = grabbed.row - rowStart;

      dragRef.current = { zoneId: zone.id, colSpan, rowSpan, grabColOffset, grabRowOffset };
      setDraggingId(zone.id);
      setGhost({ rowStart, rowEnd, colStart, colEnd });

      // Capture pointer so we receive events outside the element
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  // ── Resize start ───────────────────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (zone: WarehouseZone, handle: ResizeHandle, e: React.PointerEvent) => {
      if (!gridRef.current) return;
      const [rowStart, rowEnd] = parseGrid(zone.gridRow);
      const [colStart, colEnd] = parseGrid(zone.gridColumn);
      resizeRef.current = {
        zoneId: zone.id,
        handle,
        original: { rowStart, rowEnd, colStart, colEnd },
      };
      setDraggingId(zone.id);
      setGhost({ rowStart, rowEnd, colStart, colEnd });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  // ── Pointer move ───────────────────────────────────────────────────────────

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const { col, row } = pixelToCell(e.clientX, e.clientY, rect);

      if (dragRef.current) {
        const { colSpan, rowSpan, grabColOffset, grabRowOffset } = dragRef.current;
        // New top-left position
        let newColStart = col + grabColOffset;
        let newRowStart = row - grabRowOffset;
        // Clamp so zone stays within grid
        newColStart = clamp(newColStart, 1, GRID_COLS - colSpan + 1);
        newRowStart = clamp(newRowStart, 1, GRID_ROWS - rowSpan + 1);
        setGhost({
          colStart: newColStart,
          colEnd: newColStart + colSpan,
          rowStart: newRowStart,
          rowEnd: newRowStart + rowSpan,
        });
      } else if (resizeRef.current) {
        const { handle, original } = resizeRef.current;
        let { rowStart, rowEnd, colStart, colEnd } = original;

        // In RTL: "east" handle (right side visually) = lower col number
        // "west" handle (left side visually) = higher col number
        if (handle.includes("n")) rowStart = clamp(row, 1, rowEnd - 1);
        if (handle.includes("s")) rowEnd = clamp(row + 1, rowStart + 1, GRID_ROWS + 1);
        if (handle.includes("e")) colEnd = clamp(col + 1, colStart + 1, GRID_COLS + 1); // RTL east = lower col
        if (handle.includes("w")) colStart = clamp(col, 1, colEnd - 1); // RTL west = higher col

        setGhost({ rowStart, rowEnd, colStart, colEnd });
      }
    },
    [],
  );

  // ── Pointer up ─────────────────────────────────────────────────────────────

  const handlePointerUp = useCallback(() => {
    if (!ghost) {
      dragRef.current = null;
      resizeRef.current = null;
      setDraggingId(null);
      return;
    }
    const zoneId = dragRef.current?.zoneId ?? resizeRef.current?.zoneId;
    if (zoneId) {
      onZoneMoved(
        zoneId,
        `${ghost.rowStart} / ${ghost.rowEnd}`,
        `${ghost.colStart} / ${ghost.colEnd}`,
      );
    }
    dragRef.current = null;
    resizeRef.current = null;
    setDraggingId(null);
    setGhost(null);
  }, [ghost, onZoneMoved]);

  // ── Attach pointer listeners on document ──────────────────────────────────

  useEffect(() => {
    if (!editMode) return;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [editMode, handlePointerMove, handlePointerUp]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative overflow-auto rounded-xl border border-border bg-white shadow-sm"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Mobile hint: pinch-to-zoom + horizontal scroll */}
      <div className="md:hidden absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-card/90 backdrop-blur-sm border text-[10px] text-muted-foreground shadow-sm pointer-events-none">
        ↔ צבוט להגדלה / החלק לניווט
      </div>
      <div
        ref={containerRef}
        className="min-w-[800px] p-3 sm:p-4 origin-top-right"
        style={{ transform: `scale(${scale})`, transformOrigin: "top right" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Floor label */}
        <div className="text-center text-xs text-muted-foreground mb-2 font-medium">
          מחסן לוגיסטר קוברה — תל אביב
        </div>

        {/* CSS Grid floor plan */}
        <div
          ref={gridRef}
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(28px, 1fr))`,
            direction: "rtl",
            aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
          }}
        >
          {/* Grid lines overlay (edit mode) */}
          {editMode && <GridLines />}

          {/* Zones */}
          {zones.map((zone) => (
            <ZoneBlock
              key={zone.id}
              zone={
                // While dragging/resizing this zone, hide it (ghost shows instead)
                draggingId === zone.id && ghost
                  ? { ...zone, gridRow: "0 / 0", gridColumn: "0 / 0" } // move off-grid
                  : zone
              }
              inventoryData={zoneInventoryMap.get(zone.id)}
              isHighlighted={searchActive && highlightedZoneIds.has(zone.id)}
              isDimmed={searchActive && !highlightedZoneIds.has(zone.id)}
              heatmapMode={heatmapMode}
              editMode={editMode}
              onDragStart={editMode ? handleDragStart : undefined}
              onResizeStart={editMode ? handleResizeStart : undefined}
              onClick={onZoneClick}
            />
          ))}

          {/* Ghost zone (drag/resize preview) */}
          {ghost && draggingId && (
            <GhostZone
              zone={zones.find((z) => z.id === draggingId)!}
              ghost={ghost}
            />
          )}

          {/* Open floor space — light fill */}
          <div
            className="rounded bg-gray-50 border border-dashed border-gray-200"
            style={{ gridRow: "3 / 5", gridColumn: "5 / 12" }}
          />
          <div
            className="rounded bg-gray-50 border border-dashed border-gray-200"
            style={{ gridRow: "11 / 17", gridColumn: "5 / 25" }}
          />
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-2 left-2 flex gap-1 sm:hidden">
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          className="w-7 h-7 rounded bg-background border text-xs font-bold shadow"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          className="w-7 h-7 rounded bg-background border text-xs font-bold shadow"
        >
          -
        </button>
        {scale !== 1 && (
          <button
            onClick={() => setScale(1)}
            className="h-7 px-2 rounded bg-background border text-[10px] shadow"
          >
            איפוס
          </button>
        )}
      </div>
    </div>
  );
}

// ── Grid lines overlay ────────────────────────────────────────────────────────

function GridLines() {
  const cells: React.ReactNode[] = [];
  for (let row = 1; row <= GRID_ROWS; row++) {
    for (let col = 1; col <= GRID_COLS; col++) {
      cells.push(
        <div
          key={`${row}-${col}`}
          className="border border-dashed border-primary/10 rounded-sm pointer-events-none"
          style={{
            gridRow: `${row} / ${row + 1}`,
            gridColumn: `${col} / ${col + 1}`,
          }}
        />,
      );
    }
  }
  return <>{cells}</>;
}

// ── Ghost zone ────────────────────────────────────────────────────────────────

function GhostZone({
  zone,
  ghost,
}: {
  zone: WarehouseZone;
  ghost: GhostPos;
}) {
  return (
    <div
      className="rounded-md border-2 border-dashed border-primary pointer-events-none z-50 flex items-center justify-center"
      style={{
        gridRow: `${ghost.rowStart} / ${ghost.rowEnd}`,
        gridColumn: `${ghost.colStart} / ${ghost.colEnd}`,
        backgroundColor: zone.color,
        opacity: 0.5,
        color: zone.textColor,
      }}
    >
      <span className="text-[10px] font-bold whitespace-pre-line text-center">
        {zone.name}
      </span>
    </div>
  );
}
