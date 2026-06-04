import { useMemo, useState, useCallback } from "react";

export interface PaginationState {
  /** Current 0-based page index */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items before slicing */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Slice the source array to the current page */
  paginated: <T>(items: T[]) => T[];
  /** Navigate */
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
  /** Whether navigation is possible */
  canNext: boolean;
  canPrev: boolean;
  /** Display range: "1–25 מתוך 142" */
  rangeLabel: string;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * Lightweight client-side pagination hook.
 * Keeps page in component state (not persisted — resets on navigation).
 */
export function usePagination(totalItems: number, initialPageSize = DEFAULT_PAGE_SIZE): PaginationState {
  const [page, setPageRaw] = useState(0);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page when totalPages shrinks (e.g. filter reduces result set)
  const safePage = Math.min(page, totalPages - 1);
  if (safePage !== page) setPageRaw(safePage);

  const setPage = useCallback((p: number) => setPageRaw(Math.max(0, Math.min(p, totalPages - 1))), [totalPages]);
  const nextPage = useCallback(() => setPageRaw(p => Math.min(p + 1, totalPages - 1)), [totalPages]);
  const prevPage = useCallback(() => setPageRaw(p => Math.max(p - 1, 0)), []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(0); // reset to first page on size change
  }, []);

  const paginated = useCallback(<T,>(items: T[]): T[] => {
    const start = safePage * pageSize;
    return items.slice(start, start + pageSize);
  }, [safePage, pageSize]);

  const rangeStart = totalItems === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min((safePage + 1) * pageSize, totalItems);

  return {
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    paginated,
    setPage,
    nextPage,
    prevPage,
    setPageSize,
    canNext: safePage < totalPages - 1,
    canPrev: safePage > 0,
    rangeLabel: `${rangeStart}–${rangeEnd} מתוך ${totalItems}`,
  };
}
