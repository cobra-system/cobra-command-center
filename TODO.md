# MCP Capabilities - Status

## New Tool Modules (DONE)

### 1. Analytics & Reports (`analytics.ts`)
- [x] `get_dashboard_kpis` - Total orders, revenue, pending payments, low-stock count
- [x] `get_sales_velocity` - Product sales velocity for reorder planning
- [x] `get_supplier_performance` - Lead time accuracy, issue rate per supplier
- [x] `get_inventory_valuation` - Stock value by center/product
- [x] `get_order_pipeline` - Orders grouped by status with totals
- [x] `get_overdue_items` - Overdue tasks, expired compliance, late orders in one call

### 2. Notifications & Alerts (`notifications.ts`)
- [x] `list_alerts` - Expiring compliance, low stock, overdue payments, late ETAs
- [x] `get_critical_alerts` - Only high-priority items requiring immediate attention
- [x] `check_reorder_needs` - Products below reorder point with suggested quantities

### 3. Bulk Operations (`bulk-ops.ts`)
- [x] `bulk_update_products` - Update prices/stock for multiple products
- [x] `bulk_update_order_status` - Change status for multiple orders at once
- [x] `bulk_complete_tasks` - Mark multiple task instances as done
- [x] `import_products_csv` - Parse and create products from structured data
- [x] `bulk_assign_tasks` - Assign multiple tasks to a team member

### 4. Cross-Module Search (`search.ts`)
- [x] `global_search` - Search across products, orders, suppliers, documents by keyword
- [x] `get_entity_timeline` - Full activity history for an order
- [x] `get_supplier_full_picture` - Orders + payments + documents + issues for a supplier
- [x] `get_product_full_picture` - Stock + orders + issues + compliance for a product

### 5. Financial Tools (`finance.ts`)
- [x] `get_payment_summary` - Total paid/pending/overdue by period
- [x] `get_supplier_balance` - Outstanding balance per supplier
- [x] `forecast_upcoming_payments` - Payments due in the next N days
- [x] `get_currency_exposure` - Breakdown by currency

### 6. Scheduled Reminders & Follow-ups (`reminders.ts`)
- [x] `create_follow_up` - Schedule a follow-up for an order/supplier/issue
- [x] `list_pending_follow_ups` - What needs attention today
- [x] `auto_generate_daily_report` - Build daily report from system data automatically

### 7. Learning Journal (`learning-journal.ts`)
- [x] `list_learning_entries` - List learning journal entries
- [x] `get_learning_entry` - Get a single entry
- [x] `create_learning_entry` - Create new entry
- [x] `update_learning_entry` - Update entry
- [x] `delete_learning_entry` - Delete entry

## Bug Fixes (DONE)

### Schema mismatches fixed
- [x] `tasks.ts` - Removed non-existent `category` column from `create_one_time_task`
- [x] `meetings.ts` - Removed query to non-existent `meeting_participants` table
- [x] `search.ts` - Removed non-existent `purchase_documents.supplier_name`
- [x] `finance.ts` - Removed non-existent `orders.currency`
- [x] `reminders.ts` - Removed `category` from tasks insert/select

### Hebrew value fixes
- [x] `notifications.ts` - Fixed English→Hebrew severity/status for product_issues
- [x] `analytics.ts` - Fixed English `closed`→Hebrew `נסגר` for issue status
- [x] `search.ts` - Fixed English `closed`→Hebrew `נסגר` for issue status
- [x] `reminders.ts` - Fixed English→Hebrew severity/status for issues

### Missing registrations fixed
- [x] `payments.ts` - Was never registered in `index.ts`
- [x] `workflows.ts` - Was never registered in `index.ts`

## Tools Added to Existing Modules (DONE)

### Inventory (`inventory.ts`)
- [x] `create_inventory_transfer` - Transfer stock between distribution centers
- [x] `list_inventory_transfers` - List transfers with center names
- [x] `list_center_contacts` - List contacts for a center
- [x] `create_center_contact` - Add contact to a center
- [x] `delete_center_contact` - Remove a center contact

### Products (`products.ts`)
- [x] `list_product_components` - List components of a product
- [x] `create_product_component` - Add component to a product
- [x] `update_product_component` - Update a component
- [x] `delete_product_component` - Delete a component
- [x] Expanded `create_product` with: description, sap_code, lead_time_days, supplier_origin, shipping, reorder_point
- [x] Expanded `update_product` with: description, monthly_order, monthly_sales_avg, lead_time_days, sap_code, supplier_origin, shipping, end_product_image, end_product_url
