/**
 * TablePagination — compact pagination bar for tables.
 * Renders at the bottom of a table container: range label, prev/next, optional page-size selector.
 */
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaginationState } from "@/hooks/usePagination";

interface Props {
  pagination: PaginationState;
  /** Show the "rows per page" selector. Default true. */
  showPageSize?: boolean;
  pageSizeOptions?: number[];
}

const DEFAULT_SIZES = [25, 50, 100];

export function TablePagination({ pagination, showPageSize = true, pageSizeOptions = DEFAULT_SIZES }: Props) {
  const { rangeLabel, canPrev, canNext, prevPage, nextPage, pageSize, setPageSize, totalItems } = pagination;

  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 text-xs text-muted-foreground border-t bg-card/50">
      <span className="font-medium">{rangeLabel}</span>

      <div className="flex items-center gap-2">
        {showPageSize && (
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">שורות:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-7 w-[60px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canPrev}
            onClick={prevPage}
            aria-label="עמוד קודם"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canNext}
            onClick={nextPage}
            aria-label="עמוד הבא"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
