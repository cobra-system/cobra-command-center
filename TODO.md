# MCP New Capabilities - TODO

## Planned MCP Tool Modules

### 1. Analytics & Reports (`analytics.ts`)
- [ ] `get_dashboard_kpis` - Total orders, revenue, pending payments, low-stock count
- [ ] `get_sales_velocity` - Product sales velocity for reorder planning
- [ ] `get_supplier_performance` - Lead time accuracy, issue rate per supplier
- [ ] `get_inventory_valuation` - Stock value by center/product
- [ ] `get_order_pipeline` - Orders grouped by status with totals
- [ ] `get_overdue_items` - Overdue tasks, expired compliance, late orders in one call

### 2. Notifications & Alerts (`notifications.ts`)
- [ ] `list_alerts` - Expiring compliance, low stock, overdue payments, late ETAs
- [ ] `get_critical_alerts` - Only high-priority items requiring immediate attention
- [ ] `check_reorder_needs` - Products below reorder point with suggested quantities

### 3. Bulk Operations (`bulk-ops.ts`)
- [ ] `bulk_update_products` - Update prices/stock for multiple products
- [ ] `bulk_update_order_status` - Change status for multiple orders at once
- [ ] `bulk_complete_tasks` - Mark multiple task instances as done
- [ ] `import_products_csv` - Parse and create products from structured data
- [ ] `bulk_assign_tasks` - Assign multiple tasks to a team member

### 4. Cross-Module Search (`search.ts`)
- [ ] `global_search` - Search across products, orders, suppliers, documents by keyword
- [ ] `get_entity_timeline` - Full activity history for any entity (order/product/supplier)
- [ ] `get_supplier_full_picture` - Orders + payments + documents + issues for a supplier
- [ ] `get_product_full_picture` - Stock + orders + issues + compliance for a product

### 5. Financial Tools (`finance.ts`)
- [ ] `get_payment_summary` - Total paid/pending/overdue by period
- [ ] `get_supplier_balance` - Outstanding balance per supplier
- [ ] `forecast_upcoming_payments` - Payments due in the next N days
- [ ] `get_currency_exposure` - Breakdown by USD/EUR/ILS

### 6. Scheduled Reminders & Follow-ups (`reminders.ts`)
- [ ] `create_follow_up` - Schedule a follow-up for an order/supplier/issue
- [ ] `list_pending_follow_ups` - What needs attention today
- [ ] `auto_generate_daily_report` - Build daily report from system data automatically

### 7. Infrastructure
- [ ] Register all new tool modules in `mcp-server/src/index.ts`
- [ ] Build MCP server (`npm run build` in `mcp-server/`)
- [ ] Push to branch `claude/mcp-new-capabilities-mUogL`
