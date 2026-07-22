import { useState } from "react";

export interface ColDef {
  id: string;
  label: string;
  sortField?: string; // undefined = column is not sortable
}

/**
 * Generic hook for per-table column visibility, persisted to localStorage.
 * @param storageKey  unique key per table, e.g. "suppliers:hidden-columns"
 * @param columns     full ordered list of columns for this table
 * @param defaultHidden  ids hidden on first visit (empty = all visible by default)
 */
export function useColumnVisibility(
  storageKey: string,
  columns: readonly ColDef[],
  defaultHidden: string[] = []
) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem(storageKey);
      if (s) {
        const parsed = JSON.parse(s) as string[];
        // Filter out ids that no longer exist in the column list
        return new Set(parsed.filter(id => columns.some(c => c.id === id)));
      }
    } catch (_) { /* ignore parse errors */ }
    return new Set(defaultHidden);
  });

  const hide = (id: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });

  const show = (id: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });

  const isVisible = (id: string) => !hidden.has(id);
  const hiddenCols = columns.filter(c => hidden.has(c.id));
  const visibleCount = columns.filter(c => !hidden.has(c.id)).length;

  return { isVisible, hide, show, hiddenCols, visibleCount };
}
