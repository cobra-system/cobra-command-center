import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerSupplierTools(server: McpServer) {
  server.tool(
    "list_suppliers",
    "רשימת ספקים — List all suppliers",
    {
      search: z.string().optional().describe("Search by name"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ search, limit }) => {
      let query = supabase
        .from("suppliers")
        .select("*")
        .order("name")
        .limit(limit);

      if (search) query = query.ilike("name", `%${search}%`);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_supplier",
    "פרטי ספק — Get supplier details with contacts and price quotes",
    {
      id: z.string().uuid().describe("Supplier UUID"),
    },
    async ({ id }) => {
      const [supplierRes, contactsRes, quotesRes] = await Promise.all([
        supabase.from("suppliers").select("*").eq("id", id).single(),
        supabase.from("supplier_contacts").select("*").eq("supplier_id", id),
        supabase.from("supplier_price_quotes").select("*").eq("supplier_id", id).order("created_at", { ascending: false }).limit(20),
      ]);

      if (supplierRes.error) return { content: [{ type: "text" as const, text: `Error: ${supplierRes.error.message}` }] };

      const result = {
        ...supplierRes.data,
        contacts: contactsRes.data || [],
        price_quotes: quotesRes.data || [],
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
