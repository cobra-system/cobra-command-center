import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { checkRateLimit, getClientId } from "../_shared/rate-limit.ts";
import { validatePassword } from "../_shared/password.ts";
import { logAudit, getClientIp } from "../_shared/audit.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit: 20 management operations per minute per IP
    const clientId = getClientId(req);
    const { limited, retryAfterMs } = checkRateLimit(`manage-employee:${clientId}`, 20, 60_000);
    if (limited) {
      return new Response(
        JSON.stringify({ error: "יותר מדי בקשות, נסה שוב מאוחר יותר" }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((retryAfterMs || 60_000) / 1000)),
          },
        }
      );
    }

    // Verify caller is a MANAGER
    const authResult = await verifyAuth(req, ["MANAGER"]);
    if ("error" in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = authResult.auth.supabaseAdmin;
    const { action, employee_id, name, role, password, role_definition_id, allowed_product_ids } = await req.json();

    if (action === "update") {
      if (!employee_id) {
        return new Response(JSON.stringify({ error: "חסר מזהה עובד" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (role) updates.role = role;
      if (role_definition_id !== undefined) updates.role_definition_id = role_definition_id;
      if (allowed_product_ids !== undefined) updates.allowed_product_ids = allowed_product_ids;

      await supabaseAdmin.from("profiles").update(updates).eq("id", employee_id);

      if (role) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", employee_id);
        await supabaseAdmin.from("user_roles").insert({ user_id: employee_id, role });
      }

      // Optional password reset with strength validation
      if (password) {
        const pwCheck = validatePassword(password);
        if (!pwCheck.valid) {
          return new Response(JSON.stringify({ error: pwCheck.error }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
          employee_id,
          { password }
        );
        if (pwError) {
          return new Response(JSON.stringify({ error: `שגיאה בעדכון סיסמה: ${pwError.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      await logAudit(supabaseAdmin, {
        user_id: authResult.auth.user.id,
        action: password ? "employee.update_password" : "employee.update",
        entity_type: "employee",
        entity_id: employee_id,
        details: { name, role, password_changed: !!password },
        ip_address: getClientIp(req),
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!employee_id) {
        return new Response(JSON.stringify({ error: "חסר מזהה עובד" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Can't delete yourself
      if (employee_id === authResult.auth.user.id) {
        return new Response(JSON.stringify({ error: "אי אפשר למחוק את עצמך" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employee_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await logAudit(supabaseAdmin, {
        user_id: authResult.auth.user.id,
        action: "employee.delete",
        entity_type: "employee",
        entity_id: employee_id,
        ip_address: getClientIp(req),
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "פעולה לא חוקית" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "שגיאה פנימית" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
