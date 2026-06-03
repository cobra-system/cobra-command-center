# MCP Tools Reference

ה-MCP Server של Cobra Command Center מספק **274 כלים** ב-**34 מודולים** לשימוש Claude Code — גישה ישירה לכל ה-DB ללא דרישת ממשק גרפי.

- **Server entry point:** `mcp-server/src/index.ts`
- **Tool modules:** `mcp-server/src/tools/`
- **Config:** `.mcp.json` → `node mcp-server/dist/index.js`
- **Validation script:** `node scripts/check-mcp-tools.mjs`

---

## Module Inventory

| Module | Domain | Tools | Key tables |
|--------|--------|------:|------------|
| `analytics` | Analytics & KPIs | 6 | orders, products, tasks, suppliers, center_inventory, compliance_items, supplier_payments |
| `audit-logs` | Audit trail | 2 | inventory_change_log, task_advancement_log |
| `bulk-ops` | Bulk operations | 5 | orders, products, tasks |
| `compliance` | Compliance & licensing | 7 | compliance_items, compliance_product_links |
| `daily-reports` | Daily reports | 5 | daily_reports, tasks |
| `divisions` | Division management | 7 | division_products, order_requests, profiles |
| `documents` | Documents (PI/PO) | 10 | documents, document_products, purchase_documents |
| `equipment` | Equipment & installers | 36 | installers, equipment_pickups, equipment_pickup_items, equipment_returns, equipment_return_items, division_contacts, center_inventory, waste_items |
| `finance` | Finance summary | 4 | orders, supplier_payments, suppliers |
| `goals` | Goals tracking | 4 | goals |
| `inventory` | Inventory & warehouses | 11 | center_inventory, center_contacts, distribution_centers, inventory_transfers |
| `issues` | Product issues | 16 | product_issues, issue_attachments, issue_updates, products |
| `learning-journal` | Learning journal | 5 | learning_journal |
| `meetings` | Meetings & decisions | 14 | meetings, meeting_action_items, meeting_documents, meeting_participants |
| `notifications` | Notifications | 3 | orders, tasks, compliance_items, product_issues, supplier_payments |
| `order-payments` | Order payments | 5 | order_payments, orders |
| `orders` | Orders lifecycle | 13 | orders, order_items, order_payments, order_notes_history, purchase_documents |
| `payments` | Supplier payments | 4 | supplier_payments, orders |
| `procurement-agenda` | Procurement agenda | 2 | orders, order_payments |
| `procurement-inventory` | Procurement inventory | 6 | center_inventory, orders, order_items, purchase_documents, supplier_bank_details, procurement_meeting_orders |
| `procurement-meeting` | Procurement meetings | 7 | meetings, orders, order_payments, procurement_meeting_orders, supplier_bank_details |
| `products` | Products & components | 17 | products, product_components, product_issues, order_items, product_categories |
| `reminders` | Reminders | 3 | compliance_items, orders, tasks, daily_reports, product_issues, supplier_payments |
| `search` | Global search | 4 | products, orders, suppliers, tasks, compliance_items, center_inventory, purchase_documents, product_components, product_issues, order_items, supplier_contacts, supplier_payments |
| `shipping` | Shipping & logistics | 9 | orders, order_payments, order_notes_history, shipment_groups |
| `suppliers` | Suppliers | 13 | suppliers, supplier_contacts, supplier_bank_details, supplier_price_quotes |
| `tasks` | Tasks | 7 | tasks, profiles |
| `team` | Team & permissions | 9 | profiles, user_roles, role_definitions, role_permissions |
| `user-preferences` | User preferences | 3 | user_preferences |
| `warehouse` | Warehouse zones | 6 | warehouse_zones, warehouse_zone_products, warehouse_zone_log |
| `warehouse-locks` | Lock control & scan log | 5 | warehouse_locks, warehouse_lock_scans |
| `waste` | Waste tracking | 11 | waste_items, supplier_returns |
| `quarterly-planning` | Quarterly procurement planning | 13 | vehicle_models, quarterly_vehicle_forecasts, product_model_mappings, quarterly_procurement_plans, quarterly_plan_snapshots |

---

## Table → Module Mapping

Use this to find which module(s) to update when a table's schema changes.

| Table | Module(s) |
|-------|-----------|
| `center_contacts` | inventory |
| `center_inventory` | inventory, equipment, analytics, procurement-inventory |
| `compliance_items` | compliance, analytics, notifications, reminders, search |
| `compliance_product_links` | compliance, search |
| `daily_reports` | daily-reports, reminders |
| `distribution_centers` | inventory, equipment, procurement-inventory |
| `division_products` | divisions |
| `documents` | documents |
| `document_products` | documents |
| `equipment_pickup_items` | equipment, procurement-inventory |
| `equipment_pickups` | equipment |
| `equipment_return_items` | equipment |
| `equipment_returns` | equipment |
| `goals` | goals |
| `installers` | equipment |
| `inventory_change_log` | audit-logs |
| `inventory_transfers` | inventory |
| `issue_attachments` | issues |
| `issue_updates` | issues |
| `learning_journal` | learning-journal |
| `meeting_action_items` | meetings |
| `meeting_documents` | meetings |
| `meeting_participants` | meetings |
| `meetings` | meetings, procurement-meeting |
| `order_items` | orders, products, search, procurement-inventory |
| `order_notes_history` | orders, shipping |
| `order_payments` | order-payments, orders, procurement-agenda, procurement-inventory, procurement-meeting, shipping |
| `orders` | orders, analytics, bulk-ops, finance, notifications, order-payments, payments, procurement-agenda, procurement-inventory, procurement-meeting, reminders, search, shipping |
| `product_categories` | products |
| `product_components` | products, search |
| `product_issues` | issues, analytics, notifications, products, reminders, search |
| `products` | products, analytics, bulk-ops, equipment, issues, notifications, reminders, search |
| `procurement_meeting_orders` | procurement-meeting, procurement-inventory |
| `profiles` | divisions, tasks, team |
| `purchase_documents` | documents, orders, procurement-inventory, search |
| `role_definitions` | team |
| `role_permissions` | team |
| `shipment_groups` | shipping |
| `supplier_bank_details` | suppliers, procurement-inventory, procurement-meeting |
| `supplier_contacts` | suppliers, search |
| `supplier_payments` | payments, analytics, finance, notifications, reminders, suppliers |
| `supplier_price_quotes` | suppliers |
| `suppliers` | suppliers, analytics, finance, procurement-inventory, search |
| `task_advancement_log` | audit-logs |
| `tasks` | tasks, analytics, bulk-ops, daily-reports, notifications, reminders, search |
| `user_preferences` | user-preferences |
| `user_roles` | team |
| `warehouse_lock_scans` | warehouse-locks |
| `warehouse_locks` | warehouse-locks |
| `warehouse_zone_log` | warehouse |
| `warehouse_zone_products` | warehouse |
| `warehouse_zones` | warehouse |
| `waste_items` | waste, equipment |
| `supplier_returns` | waste |
| `vehicle_models` | quarterly-planning |
| `quarterly_vehicle_forecasts` | quarterly-planning |
| `product_model_mappings` | quarterly-planning |
| `quarterly_procurement_plans` | quarterly-planning |
| `quarterly_plan_snapshots` | quarterly-planning |

### Tables without MCP coverage (intentional)

| Table | Reason |
|-------|--------|
| `login_attempts` | Managed by Edge Functions only — no direct tool access needed |
| `sap_sync_log` | External sync log — read via direct DB or Edge Functions |

---

## Update Process

### Adding a new DB table

1. Identify the closest existing module (or create a new one)
2. Add `server.tool(...)` calls with Zod input validation and `.from("new_table")` queries
3. If new module: add the file to `mcp-server/src/tools/`, then register in `mcp-server/src/index.ts`
4. Update this file: add row to Module Inventory + Table→Module Mapping
5. Update `README.md` MCP Tools section (tool count)
6. Run `node scripts/check-mcp-tools.mjs` — should pass cleanly
7. Run `cd mcp-server && npm run build`

### Changing a column / enum

1. `grep -r "\"TABLE_NAME\"" mcp-server/src/tools/` to find all affected tools
2. Update Zod schemas (`z.enum([...])`, field names) and query projections in each tool
3. Rebuild: `cd mcp-server && npm run build`

### Removing a table

1. `grep -r "\"TABLE_NAME\"" mcp-server/src/tools/` to find all `.from()` references
2. Remove or redirect those tool implementations
3. Remove from Module Inventory and Table→Module Mapping in this file
4. Rebuild and run `node scripts/check-mcp-tools.mjs`

### Adding a new module from scratch

```typescript
// mcp-server/src/tools/my-domain.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerMyDomainTools(server: McpServer) {
  server.tool(
    "list_my_things",
    "רשימת — List all things",
    { limit: z.number().default(50).describe("Max results") },
    async ({ limit }) => {
      const { data, error } = await supabase.from("my_table").select("*").limit(limit);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

Then in `mcp-server/src/index.ts`:
```typescript
import { registerMyDomainTools } from "./tools/my-domain.js";
// ...
registerMyDomainTools(server);
```

---

## Validation & CI

```bash
# Check module registration + table coverage
node scripts/check-mcp-tools.mjs

# Build the server
cd mcp-server && npm run build

# Check docs sync (routes, edge functions, DB tables in README)
node scripts/check-docs.mjs
```

Both scripts respect `SKIP_DOCS_CHECK=1` for emergency bypasses and `--warn-only` for non-blocking runs (used by the PostToolUse hook).
