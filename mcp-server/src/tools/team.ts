import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { unwrapRows } from "../lib/queryResult.js";

export function registerTeamTools(server: McpServer) {
  server.tool(
    "list_team_members",
    "רשימת חברי צוות — List all team members (profiles)",
    {
      limit: z.number().default(100).describe("Max results"),
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("name")
        .limit(limit);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_team_member",
    "פרטי חבר צוות — Get a team member's profile and roles",
    {
      id: z.string().uuid().describe("Profile UUID"),
    },
    async ({ id }) => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("user_roles").select("*").eq("user_id", id),
      ]);

      if (profileRes.error) return { content: [{ type: "text" as const, text: `Error: ${profileRes.error.message}` }] };

      const result = {
        ...profileRes.data,
        user_roles: unwrapRows(rolesRes, "roles"),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_team_member",
    "עדכון חבר צוות — Update a team member's profile (name, role, pin, division)",
    {
      id: z.string().uuid().describe("Profile UUID"),
      name: z.string().optional().describe("Display name"),
      role: z.string().optional().describe("Role (e.g. 'manager', 'worker', 'driver', or custom role key)"),
      pin: z.string().regex(/^\d{4}$/).optional().describe("4-digit PIN code (numbers only, exactly 4 digits)"),
      division: z.string().nullable().optional().describe("Division for division manager role: 'AWACS' | 'כפתור' | 'DOORE' | 'דלק מוטורס' | 'פריזבי קרסו' | 'לובינסקי'. Pass null to clear."),
    },
    async ({ id, name, role, pin, division }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (pin !== undefined) updates.pin = pin;
      if (division !== undefined) updates.division = division;

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error updating team member: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Team member updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_role_definitions",
    "רשימת הגדרות תפקידים — List all role definitions",
    {},
    async () => {
      const { data, error } = await supabase
        .from("role_definitions")
        .select("*")
        .order("created_at");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_role_definition",
    "יצירת תפקיד חדש — Create a new custom role definition",
    {
      name: z.string().describe("Role display name (e.g. 'מחסנאי')"),
    },
    async ({ name }) => {
      const { data, error } = await supabase
        .from("role_definitions")
        .insert({ name } as never)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error creating role: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Role created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "update_role_definition",
    "עדכון שם תפקיד — Update a role definition's name",
    {
      id: z.string().uuid().describe("Role definition UUID"),
      name: z.string().describe("New role name"),
    },
    async ({ id, name }) => {
      const { data, error } = await supabase
        .from("role_definitions")
        .update({ name } as never)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error updating role: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Role updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_role_definition",
    "מחיקת תפקיד — Delete a custom role definition",
    {
      id: z.string().uuid().describe("Role definition UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("role_definitions")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Role definition deleted successfully" }] };
    }
  );

  server.tool(
    "get_role_permissions",
    "הרשאות תפקיד — Get all module permissions for a specific role",
    {
      role: z.string().describe("Role key (e.g. 'manager', 'worker', or custom role system_key)"),
    },
    async ({ role }) => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("role", role)
        .order("module_key");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_role_permission",
    "עדכון הרשאת תפקיד — Set the permission level for a role on a specific module",
    {
      role: z.string().describe("Role key"),
      module_key: z.string().describe("Module key (e.g. 'orders', 'inventory', 'compliance')"),
      permission_level: z.enum(["none", "view", "edit"]).describe("Permission level: none, view, or edit"),
    },
    async ({ role, module_key, permission_level }) => {
      const { data, error } = await supabase
        .from("role_permissions")
        .upsert(
          { role, module_key, permission_level },
          { onConflict: "role,module_key" }
        )
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error updating permission: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Permission updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );
}
