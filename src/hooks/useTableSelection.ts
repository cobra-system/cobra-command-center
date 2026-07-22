import { useCallback, useMemo, useState } from "react";

export interface TableSelectionState {
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string, e?: { shiftKey?: boolean }) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  isAllSelected: (ids: string[]) => boolean;
  isPartiallySelected: (ids: string[]) => boolean;
}

export function useTableSelection(): TableSelectionState {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isAllSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every(id => selectedIds.has(id)),
    [selectedIds],
  );

  const isPartiallySelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return false;
      const matched = ids.filter(id => selectedIds.has(id)).length;
      return matched > 0 && matched < ids.length;
    },
    [selectedIds],
  );

  return useMemo(() => ({
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    selectAll,
    clear,
    isAllSelected,
    isPartiallySelected,
  }), [selectedIds, isSelected, toggle, selectAll, clear, isAllSelected, isPartiallySelected]);
}
