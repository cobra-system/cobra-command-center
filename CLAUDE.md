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

---

## Documentation Maintenance (Required)

The only 3 files that belong at project root are `README.md`, `CLAUDE.md`, and `CHANGELOG.md`. Everything else lives under `docs/`.

### README.md — update when:
- **Adding a new page/route** → add a row to the Modules table
- **Adding a DB table** → add it to the relevant Database section
- **Adding an Edge Function** → add a row to the Edge Functions table
- **Adding a major dependency** → add to the Tech Stack table

### CHANGELOG.md — update when:
- **Completing a major feature** → add a new entry at the top under `## [Unreleased]`
- Format follows Keep a Changelog: `### Added / Changed / Fixed`

### docs/ — reference docs to keep current:
- `docs/INFRASTRUCTURE.md` — update when adding/removing Edge Functions, changing CI/CD, or modifying backup procedures
- `docs/MIGRATIONS.md` — update the total migration count when new migrations are added
- `docs/BACKLOG.md` — remove items when completed, add new backlog items here

### Root-level discipline:
- **Never** create new root-level `.md` files for one-time work (feature summaries, test reports, deployment guides, sprint plans)
- One-time docs → `docs/archive/<DESCRIPTIVE_NAME>_YYYY-MM.md`
- Only `README.md`, `CLAUDE.md`, and `CHANGELOG.md` live at root
