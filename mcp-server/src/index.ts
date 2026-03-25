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

// Start the server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
