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
        .is("deleted_at", null)
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
      risk_level: z.enum(["low", "medium", "high"]).optional().describe("Risk level: low, medium, high"),
      lead_time_days: z.number().optional().describe("Lead time in days"),
      supplier_number: z.string().optional().describe("Supplier number / internal ID (e.g. '042')"),
    },
    async ({ company, contact_name, email, phone, role, country, products, notes, payment_terms, risk_level, lead_time_days, supplier_number }) => {
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
          supplier_number: supplier_number || null,
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
      risk_level: z.enum(["low", "medium", "high"]).optional().describe("Risk level: low, medium, high"),
      lead_time_days: z.number().optional().describe("Lead time in days"),
      supplier_number: z.string().optional().describe("Supplier number / internal ID (e.g. '042')"),
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

  // --- Supplier Contacts ---

  server.tool(
    "create_supplier_contact",
    "יצירת איש קשר לספק — Create a contact for a supplier",
    {
      supplier_id: z.string().uuid().describe("Supplier UUID"),
      name: z.string().describe("Contact name"),
      role: z.string().optional().describe("Contact role"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      is_primary: z.boolean().default(false).describe("Is this the primary contact?"),
    },
    async ({ supplier_id, name, role, email, phone, is_primary }) => {
      const { data, error } = await supabase
        .from("supplier_contacts")
        .insert({
          supplier_id,
          name,
          role: role || null,
          email: email || null,
          phone: phone || null,
          is_primary,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Supplier contact created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_supplier_contact",
    "עדכון איש קשר של ספק — Update a supplier contact's details",
    {
      id: z.string().uuid().describe("Contact UUID"),
      name: z.string().optional().describe("Contact name"),
      role: z.string().optional().describe("Contact role"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      is_primary: z.boolean().optional().describe("Is this the primary contact?"),
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
        .from("supplier_contacts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Supplier contact updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_supplier_contact",
    "מחיקת איש קשר של ספק — Delete a supplier contact",
    {
      id: z.string().uuid().describe("Contact UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("supplier_contacts")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Supplier contact deleted successfully" }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Supplier Bank Details — פרטי בנק לספק
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "create_supplier_bank_details",
    "הוספת פרטי בנק לספק — Create wire transfer bank details for a supplier",
    {
      supplier_id: z.string().uuid().describe("Supplier UUID"),
      beneficiary_name: z.string().describe("Beneficiary name (company receiving the wire)"),
      bank_name: z.string().optional().describe("Bank name"),
      swift_code: z.string().optional().describe("SWIFT / BIC code"),
      account_number: z.string().optional().describe("Bank account number or IBAN"),
      bank_address: z.string().optional().describe("Bank address"),
      currency: z.string().optional().describe("Currency code (e.g. 'USD', 'EUR', 'CNY')"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async ({ supplier_id, beneficiary_name, bank_name, swift_code, account_number, bank_address, currency, notes }) => {
      const { data, error } = await supabase
        .from("supplier_bank_details")
        .insert({
          supplier_id,
          beneficiary_name,
          bank_name: bank_name ?? null,
          swift_code: swift_code ?? null,
          account_number: account_number ?? null,
          bank_address: bank_address ?? null,
          currency: currency ?? null,
          notes: notes ?? null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_supplier_bank_details",
    "עדכון פרטי בנק לספק — Update wire transfer bank details",
    {
      id: z.string().uuid().describe("supplier_bank_details record UUID"),
      beneficiary_name: z.string().optional().describe("Beneficiary name"),
      bank_name: z.string().nullable().optional().describe("Bank name"),
      swift_code: z.string().nullable().optional().describe("SWIFT / BIC code"),
      account_number: z.string().nullable().optional().describe("Account number or IBAN"),
      bank_address: z.string().nullable().optional().describe("Bank address"),
      currency: z.string().nullable().optional().describe("Currency code"),
      notes: z.string().nullable().optional().describe("Notes"),
    },
    async ({ id, ...fields }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) patch[k] = v;
      }

      const { data, error } = await supabase
        .from("supplier_bank_details")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_supplier_bank_details",
    "מחיקת פרטי בנק לספק — Delete bank details record",
    {
      id: z.string().uuid().describe("supplier_bank_details record UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("supplier_bank_details")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_id: id }) }] };
    }
  );
}
