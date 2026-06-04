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
- `order-payments:hidden-columns` — OrderPaymentsSection
- `order-requests:hidden-columns` — DivisionDetailPage (bonded requests section)
- `manager-order-requests:hidden-columns` — OrderRequestsTab (manager view)
- `frisbee-consumption-v2:hidden-columns` — FrisbeeDashboard (consumption tab summary table)
- `frisbee-models:hidden-columns` — FrisbeeDashboard (sales dashboard model breakdown table)
- `division-product-items:hidden-columns` — DivisionProductsPage (items tab)
- `waste-items:hidden-columns` — WasteItemsTab
- `supplier-returns:hidden-columns` — SupplierReturnsTab
- `qp-models:hidden-columns` — QuarterlyPlanningPage (vehicle models tab)
- `qp-mappings:hidden-columns` — QuarterlyPlanningPage (product-model mappings tab)
- `qp-procurement:hidden-columns` — QuarterlyPlanningPage (procurement plan tab)
- `division-consumption:hidden-columns` — DivisionConsumptionPage (consumption & health table)

Use a new unique key for each new table (e.g. `"invoices:hidden-columns"`).

---

## MCP Tool Maintenance (Required for Schema Changes)

When modifying the database schema (new table, renamed column, new enum value, column removed), **also update the corresponding MCP tool module(s)** in `mcp-server/src/tools/`. The PostToolUse hook will warn automatically when `types.ts` or a tool file changes.

### When to update

| Change | Action required |
|--------|----------------|
| New DB table | Add tools to an existing module **or** create a new module + register in `index.ts` |
| Renamed/removed column | Update the Zod schema and query in the affected tool file |
| New enum value | Add it to the `z.enum([...])` in the affected tool's input schema |
| Removed table | Remove or redirect all `.from("table")` references in tools |
| New tool module | Register `registerXTools(server)` in `mcp-server/src/index.ts` |

### Quick find — which tools touch a table

```bash
grep -r "\"TABLE_NAME\"" mcp-server/src/tools/
```

### Build after changes

```bash
cd mcp-server && npm run build
```

### Module inventory (34 modules · 278 tools)

| Module | Domain | Key tables | Tools |
|--------|--------|------------|------:|
| `analytics` | Analytics & KPIs | orders, products, tasks, suppliers | 6 |
| `audit-logs` | Audit trail | inventory_change_log, task_advancement_log | 2 |
| `bulk-ops` | Bulk operations | orders, products, tasks | 5 |
| `compliance` | Compliance items | compliance_items, compliance_product_links | 7 |
| `daily-reports` | Daily reports | daily_reports, tasks | 5 |
| `divisions` | Division management | division_products, division_product_items, division_product_consumption, order_requests, profiles | 14 |
| `documents` | Documents | documents, purchase_documents | 10 |
| `equipment` | Equipment tracking | installers, equipment_pickups, equipment_returns | 36 |
| `finance` | Finance & payments | orders, supplier_payments | 4 |
| `goals` | Goals tracking | goals | 4 |
| `inventory` | Inventory & warehouses | center_inventory, distribution_centers, inventory_transfers | 11 |
| `issues` | Product issues | product_issues, issue_attachments, issue_updates | 16 |
| `learning-journal` | Learning journal | learning_journal | 5 |
| `meetings` | Meetings & decisions | meetings, meeting_action_items | 14 |
| `notifications` | Notifications | orders, tasks, compliance_items | 3 |
| `order-payments` | Order payments | order_payments, orders | 5 |
| `orders` | Orders | orders, order_items, purchase_documents | 13 |
| `payments` | Supplier payments | supplier_payments | 4 |
| `procurement-agenda` | Procurement agenda | orders | 2 |
| `procurement-inventory` | Procurement inventory | center_inventory, orders | 6 |
| `procurement-meeting` | Procurement meetings | meetings, procurement_meeting_orders | 7 |
| `products` | Products & components | products, product_components, product_categories | 17 |
| `reminders` | Reminders | compliance_items, orders, tasks | 3 |
| `search` | Global search | (multi-table) | 4 |
| `shipping` | Shipping & logistics | orders, shipment_groups | 9 |
| `suppliers` | Suppliers | suppliers, supplier_contacts, supplier_bank_details | 13 |
| `tasks` | Tasks | tasks | 7 |
| `team` | Team & permissions | profiles, user_roles, role_permissions | 9 |
| `user-preferences` | User preferences | user_preferences | 3 |
| `warehouse` | Warehouse zones | warehouse_zones, warehouse_zone_products | 6 |
| `warehouse-locks` | Lock control & scan log | warehouse_locks, warehouse_lock_scans | 5 |
| `waste` | Waste tracking | waste_items, supplier_returns | 11 |
| `frisbee` | Base44 QA sync & consumption | frisbee_inspections, frisbee_inspection_equipment, frisbee_product_mapping | 5 |
| `quarterly-planning` | Quarterly procurement planning | vehicle_models, quarterly_vehicle_forecasts, product_model_mappings, quarterly_procurement_plans, quarterly_plan_snapshots | 13 |

See `docs/MCP_TOOLS.md` for the full reference including table→module mapping.

---

## Documentation Maintenance (Required)

The only 3 files that belong at project root are `README.md`, `CLAUDE.md`, and `CHANGELOG.md`. Everything else lives under `docs/`.

### README.md — update when:
- **Adding a new page/route** → add a row to the Modules table
- **Adding a DB table** → add it to the relevant Database section
- **Adding an Edge Function** → add a row to the Edge Functions table
- **Adding a major dependency** → add to the Tech Stack table
- **Adding a new MCP tool module** → update the MCP Tools section tool/module count

### CHANGELOG.md — update when:
- **Completing a major feature** → add a new entry at the top under `## [Unreleased]`
- Format follows Keep a Changelog: `### Added / Changed / Fixed`

### docs/ — reference docs to keep current:
- `docs/INFRASTRUCTURE.md` — update when adding/removing Edge Functions, changing CI/CD, or modifying backup procedures
- `docs/MIGRATIONS.md` — update the total migration count when new migrations are added
- `docs/BACKLOG.md` — remove items when completed, add new backlog items here
- `docs/MCP_TOOLS.md` — update when adding/removing tool modules or when tables gain/lose coverage

### Root-level discipline:
- **Never** create new root-level `.md` files for one-time work (feature summaries, test reports, deployment guides, sprint plans)
- One-time docs → `docs/archive/<DESCRIPTIVE_NAME>_YYYY-MM.md`
- Only `README.md`, `CLAUDE.md`, and `CHANGELOG.md` live at root
