import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "לא מורשה" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "לא מורשה" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", caller.id).single();
    if (!callerProfile || callerProfile.role !== "MANAGER") {
      return new Response(JSON.stringify({ error: "רק מנהל יכול לנהל עובדים" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, employee_id, name, role, pin } = await req.json();

    if (action === "update") {
      if (!employee_id) {
        return new Response(JSON.stringify({ error: "חסר מזהה עובד" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check PIN uniqueness if changed
      if (pin) {
        const { data: existingPin } = await supabaseAdmin
          .from("profiles").select("id").eq("pin", pin).neq("id", employee_id).maybeSingle();
        if (existingPin) {
          return new Response(JSON.stringify({ error: "קוד PIN כבר בשימוש" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const updates: Record<string, any> = {};
      if (name) updates.name = name;
      if (role) updates.role = role;
      if (pin) updates.pin = pin;

      await supabaseAdmin.from("profiles").update(updates).eq("id", employee_id);

      // Update user_roles if role changed
      if (role) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", employee_id);
        await supabaseAdmin.from("user_roles").insert({ user_id: employee_id, role });
      }

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
      if (employee_id === caller.id) {
        return new Response(JSON.stringify({ error: "אי אפשר למחוק את עצמך" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete auth user (cascades to profiles and user_roles)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employee_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
