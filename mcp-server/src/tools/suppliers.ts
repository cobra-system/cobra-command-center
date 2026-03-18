import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerSupplierTools(server: McpServer) {
  server.tool(
    "list_suppliers",
    "רשימת ספקים — List all suppliers",
    {
      search: z.string().optional().describe("Search by company or contact name"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ search, limit }) => {
      let query = supabase
        .from("suppliers")
        .select("*")
        .order("company")
        .limit(limit);

      if (search) query = query.or(`company.ilike.%${search}%,contact_name.ilike.%${search}%`);

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

  server.tool(
    "create_supplier",
    "יצירת ספק חדש — Create a new supplier",
    {
      company: z.string().describe("Company name"),
      contact_name: z.string().optional().describe("Contact person name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      role: z.string().optional().describe("Supplier role/type"),
      country: z.string().optional().describe("Country of origin"),
      products: z.string().optional().describe("Products supplied (free text)"),
      notes: z.string().optional().describe("Additional notes"),
      payment_terms: z.string().optional().describe("Payment terms (e.g. Net 30)"),
      risk_level: z.string().optional().describe("Risk level (low/medium/high)"),
      lead_time_days: z.number().optional().describe("Lead time in days"),
    },
    async ({ company, contact_name, email, phone, role, country, products, notes, payment_terms, risk_level, lead_time_days }) => {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          company,
          contact_name: contact_name || null,
          email: email || null,
          phone: phone || null,
          role: role || null,
          country: country || null,
          products: products || null,
          notes: notes || null,
          payment_terms: payment_terms || null,
          risk_level: risk_level || null,
          lead_time_days: lead_time_days ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Supplier created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_supplier",
    "עדכון ספק — Update an existing supplier's details",
    {
      id: z.string().uuid().describe("Supplier UUID"),
      company: z.string().optional().describe("Company name"),
      contact_name: z.string().optional().describe("Contact person name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      role: z.string().optional().describe("Supplier role/type"),
      country: z.string().optional().describe("Country"),
      products: z.string().optional().describe("Products supplied"),
      notes: z.string().optional().describe("Notes"),
      payment_terms: z.string().optional().describe("Payment terms"),
      risk_level: z.string().optional().describe("Risk level"),
      lead_time_days: z.number().optional().describe("Lead time in days"),
    },
    async ({ id, ...fields }) => {
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updates[key] = value;
      }

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }

      const { data, error } = await supabase
        .from("suppliers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Supplier updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_supplier",
    "מחיקת ספק — Delete a supplier by ID",
    {
      id: z.string().uuid().describe("Supplier UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Supplier deleted successfully` }] };
    }
  );
}
