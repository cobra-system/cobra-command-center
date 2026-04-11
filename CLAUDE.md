# Cobra Command Center — Claude Instructions

## Column Visibility (Required for All Tables)

Every sortable table in this project **must** include the column visibility system. This applies when creating new table components or modifying existing ones.

### Pattern to follow

```tsx
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";

const COLUMN_DEFS = [
  { id: "col1", label: "...", sortField: "col1" }, // sortable
  { id: "col2", label: "..." },                    // not sortable (no sortField)
] as const;

// Inside component:
const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
  "table-name:hidden-columns", // unique key per table
  COLUMN_DEFS,
  ["col_hidden_by_default"]    // optional: ids hidden on first visit
);
const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();
```

### Header row
```tsx
<tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
  {COLUMN_DEFS.map(col => isVisible(col.id) ? (
    <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
      {col.sortField ? (
        <button onClick={() => toggleSort(col.sortField!)} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
          {col.label} <SortIcon field={col.sortField} />
        </button>
      ) : col.label}
    </th>
  ) : null)}
  {/* fixed columns like actions go here, no visibility wrap */}
</tr>
```

### Data rows
```tsx
{isVisible("col1") && <td className="p-3">...</td>}
{isVisible("col2") && <td className="p-3">...</td>}
{/* fixed cells (e.g. actions/buttons) — no visibility wrap */}
```

### ColContextMenu render (at end of component return, outside the table container)
```tsx
{colMenu && (
  <ColContextMenu
    menu={colMenu}
    sortField={currentSortField}
    sortDir={currentSortDir}
    hiddenCols={hiddenCols}
    onClose={closeMenu}
    onHide={hide}
    onShow={show}
    onSortAsc={field => saveSort(field, "asc")}
    onSortDesc={field => saveSort(field, "desc")}
  />
)}
```

### colSpan for empty-state row
```tsx
<td colSpan={visibleCount + numberOfFixedColumns}>
```

### Storage keys already in use
- `orders:hidden-columns` — OrderTable
- `suppliers:hidden-columns` — SuppliersPage
- `products:hidden-columns` — ProductsPage
- `issues:hidden-columns` — IssuesPage
- `reorder:hidden-columns` — ReorderPage
- `documents:hidden-columns` — DocumentsTable
- `payments:hidden-columns` — PaymentsTable

Use a new unique key for each new table (e.g. `"invoices:hidden-columns"`).
