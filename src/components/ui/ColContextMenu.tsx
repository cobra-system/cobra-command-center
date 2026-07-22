import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, EyeOff, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColDef } from "@/hooks/useColumnVisibility";

// ─── Types ───────────────────────────────────────────────────────────────────
export type ColMenuState =
  | { type: "column"; colId: string; colLabel: string; sortField?: string; x: number; y: number }
  | { type: "add"; x: number; y: number };

// ─── Hook ────────────────────────────────────────────────────────────────────
/**
 * Manages column header context-menu state.
 * Closes the menu automatically when the user clicks outside.
 */
export function useColMenu() {
  const [menu, setMenu] = useState<ColMenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const closeMenu = () => setMenu(null);
  return { menu, setMenu, closeMenu };
}

// ─── Helper – attach to a named <th> ─────────────────────────────────────────
/**
 * Returns an onContextMenu handler for a named column <th>.
 * Stops propagation so the parent <tr> "add column" handler doesn't also fire.
 */
export function colThContextMenu(
  col: ColDef,
  setMenu: (s: ColMenuState) => void
) {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMenu({ type: "column", colId: col.id, colLabel: col.label, sortField: col.sortField, x: e.clientX, y: e.clientY });
  };
}

/**
 * Returns an onContextMenu handler for the header <tr>.
 * Shows the "add column" menu when right-clicking empty header space.
 */
export function trContextMenu(
  hiddenCols: ColDef[],
  setMenu: (s: ColMenuState) => void
) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    if (hiddenCols.length > 0) {
      setMenu({ type: "add", x: e.clientX, y: e.clientY });
    }
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
interface ColContextMenuProps {
  menu: ColMenuState;
  /** Current active sort field (from prefs or state) */
  sortField: string | null;
  /** Current active sort direction */
  sortDir: "asc" | "desc" | null;
  hiddenCols: ColDef[];
  onClose: () => void;
  onHide: (id: string) => void;
  onShow: (id: string) => void;
  /** Called when user picks "sort ascending" from context menu */
  onSortAsc?: (field: string) => void;
  /** Called when user picks "sort descending" from context menu */
  onSortDesc?: (field: string) => void;
}

export function ColContextMenu({
  menu,
  sortField,
  sortDir,
  hiddenCols,
  onClose,
  onHide,
  onShow,
  onSortAsc,
  onSortDesc,
}: ColContextMenuProps) {
  // Keep menu inside viewport
  const x = Math.min(menu.x, window.innerWidth - 200);
  const y = Math.min(menu.y, window.innerHeight - 180);

  if (menu.type === "column") {
    const isAsc = sortField === menu.sortField && sortDir === "asc";
    const isDesc = sortField === menu.sortField && sortDir === "desc";
    const canSort = !!menu.sortField && (onSortAsc || onSortDesc);

    return (
      <div
        style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
        className="bg-popover border rounded-lg shadow-lg py-1 min-w-[160px] text-sm"
        onMouseDown={e => e.stopPropagation()}
      >
        {canSort && (
          <>
            <button
              className={cn("w-full text-right px-3 py-2 hover:bg-muted flex items-center gap-2", isAsc && "text-primary font-medium")}
              onClick={() => { onSortAsc?.(menu.sortField!); onClose(); }}
            >
              <ArrowUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              מיין עולה
            </button>
            <button
              className={cn("w-full text-right px-3 py-2 hover:bg-muted flex items-center gap-2", isDesc && "text-primary font-medium")}
              onClick={() => { onSortDesc?.(menu.sortField!); onClose(); }}
            >
              <ArrowDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              מיין יורד
            </button>
            <div className="border-t my-1" />
          </>
        )}
        <button
          className="w-full text-right px-3 py-2 hover:bg-muted flex items-center gap-2 text-muted-foreground"
          onClick={() => { onHide(menu.colId); onClose(); }}
        >
          <EyeOff className="h-3.5 w-3.5 flex-shrink-0" />
          הסתר עמודה
        </button>
      </div>
    );
  }

  // "add" mode — list hidden columns to restore
  if (hiddenCols.length === 0) return null;
  return (
    <div
      style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="bg-popover border rounded-lg shadow-lg py-1 min-w-[180px] text-sm"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-xs text-muted-foreground font-semibold">הוסף עמודה</div>
      <div className="border-t mb-1" />
      {hiddenCols.map(col => (
        <button
          key={col.id}
          className="w-full text-right px-3 py-2 hover:bg-muted flex items-center gap-2"
          onClick={() => { onShow(col.id); onClose(); }}
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {col.label}
        </button>
      ))}
    </div>
  );
}
