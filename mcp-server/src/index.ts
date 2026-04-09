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
import { registerWorkflowTools } from "./tools/workflows.js";
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
registerWorkflowTools(server);
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

// Start the server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
