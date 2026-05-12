import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerProductTools } from "./tools/products.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerSupplierTools } from "./tools/suppliers.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerInventoryTools } from "./tools/inventory.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerDailyReportTools } from "./tools/daily-reports.js";
import { registerComplianceTools } from "./tools/compliance.js";
import { registerTeamTools } from "./tools/team.js";
import { registerMeetingTools } from "./tools/meetings.js";
import { registerPaymentTools } from "./tools/payments.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerNotificationTools } from "./tools/notifications.js";
import { registerBulkOpsTools } from "./tools/bulk-ops.js";
import { registerSearchTools } from "./tools/search.js";
import { registerFinanceTools } from "./tools/finance.js";
import { registerReminderTools } from "./tools/reminders.js";
import { registerLearningJournalTools } from "./tools/learning-journal.js";
import { registerGoalTools } from "./tools/goals.js";
import { registerAuditLogTools } from "./tools/audit-logs.js";
import { registerUserPreferenceTools } from "./tools/user-preferences.js";
import { registerShippingTools } from "./tools/shipping.js";
import { registerOrderPaymentTools } from "./tools/order-payments.js";
import { registerProcurementAgendaTools } from "./tools/procurement-agenda.js";
import { registerEquipmentTools } from "./tools/equipment.js";
import { registerProcurementMeetingTools } from "./tools/procurement-meeting.js";
import { registerProcurementInventoryTools } from "./tools/procurement-inventory.js";
import { registerDivisionTools } from "./tools/divisions.js";
import { registerWarehouseTools } from "./tools/warehouse.js";
import { registerWarehouseLockTools } from "./tools/warehouse-locks.js";
import { registerWasteTools } from "./tools/waste.js";
import { registerFrisbeeTools } from "./tools/frisbee.js";

const server = new McpServer({
  name: "cobra-command-center",
  version: "1.0.0",
});

// Register all tool groups
registerIssueTools(server);
registerProductTools(server);
registerOrderTools(server);
registerSupplierTools(server);
registerTaskTools(server);
registerInventoryTools(server);
registerDocumentTools(server);
registerDailyReportTools(server);
registerComplianceTools(server);
registerTeamTools(server);
registerMeetingTools(server);
registerPaymentTools(server);
registerAnalyticsTools(server);
registerNotificationTools(server);
registerBulkOpsTools(server);
registerSearchTools(server);
registerFinanceTools(server);
registerReminderTools(server);
registerLearningJournalTools(server);
registerGoalTools(server);
registerAuditLogTools(server);
registerUserPreferenceTools(server);
registerShippingTools(server);
registerOrderPaymentTools(server);
registerProcurementAgendaTools(server);
registerEquipmentTools(server);
registerProcurementMeetingTools(server);
registerProcurementInventoryTools(server);
registerDivisionTools(server);
registerWarehouseTools(server);
registerWarehouseLockTools(server);
registerWasteTools(server);
registerFrisbeeTools(server);

// Start the server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
