import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

interface UserSetup {
  email: string;
  password: string;
  name: string;
  role: "MANAGER" | "WAREHOUSE_MANAGER" | "LOGISTICS" | "DRIVER";
  pin: string | null;
}

const USERS: UserSetup[] = [
  { email: "noam@cobra.co.il", password: "cobra2026", name: "נועם", role: "MANAGER", pin: "1234" },
  { email: "georgi@cobra.co.il", password: "cobra1111", name: "גיאורגי גריגוריאנץ", role: "WAREHOUSE_MANAGER", pin: "1111" },
  { email: "ziv@cobra.co.il", password: "cobra2222", name: "זיו בוזגלו", role: "LOGISTICS", pin: "2222" },
];

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(externalUrl, externalServiceKey);

    const results: string[] = [];
    results.push(`External URL: ${externalUrl}`);

    // List all existing auth users
    const { data: { users: existingUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
    if (listError) {
      results.push(`Error listing users: ${listError.message}`);
    }
    results.push(`Existing auth users: ${existingUsers?.length || 0}`);
    for (const u of existingUsers || []) {
      results.push(`  Auth: ${u.email} id=${u.id}`);
    }

    // List existing profiles
    const { data: existingProfiles, error: profError } = await supabaseAdmin.from("profiles").select("id, name, role, pin");
    if (profError) {
      results.push(`Error listing profiles: ${profError.message}`);
    }
    results.push(`Existing profiles: ${existingProfiles?.length || 0}`);
    for (const p of existingProfiles || []) {
      results.push(`  Profile: ${p.name} (${p.role}) pin=${p.pin ? "SET" : "NULL"} id=${p.id}`);
    }

    // For each desired user, ensure auth user + profile + user_role exist
    for (const u of USERS) {
      const existingAuth = existingUsers?.find((au: any) => au.email === u.email);

      let userId: string;

      if (existingAuth) {
        userId = existingAuth.id;
        results.push(`${u.name}: Auth user exists (${userId})`);

        // Update password
        const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name, role: u.role },
        });
        results.push(pwdError ? `  Password update error: ${pwdError.message}` : `  Password updated`);
      } else {
        // Create auth user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name, role: u.role },
        });

        if (createError || !newUser?.user) {
          results.push(`${u.name}: CREATE FAILED - ${createError?.message || "unknown"}`);
          continue;
        }
        userId = newUser.user.id;
        results.push(`${u.name}: Created auth user (${userId})`);
      }

      // Upsert profile
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        { id: userId, name: u.name, role: u.role, pin: u.pin },
        { onConflict: "id" }
      );
      results.push(profileError ? `  Profile error: ${profileError.message}` : `  Profile OK`);

      // Upsert user_role
      const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: u.role },
        { onConflict: "user_id,role" }
      );
      results.push(roleError ? `  Role error: ${roleError.message}` : `  Role OK`);
    }

    // Clean up duplicate profiles that don't match any desired user
    const { data: allProfiles } = await supabaseAdmin.from("profiles").select("id, name, role");
    if (allProfiles) {
      const desiredIds = new Set<string>();
      for (const u of USERS) {
        const auth = existingUsers?.find((au: any) => au.email === u.email);
        if (auth) desiredIds.add(auth.id);
      }
      // Re-fetch to get updated user list
      const { data: { users: updatedUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
      for (const u of updatedUsers || []) {
        const matchesDesired = USERS.some(du => du.email === u.email);
        if (matchesDesired) desiredIds.add(u.id);
      }

      for (const p of allProfiles) {
        if (!desiredIds.has(p.id)) {
          results.push(`Orphan profile: ${p.name} (${p.id}) - keeping for now`);
        }
      }
    }

    // Ensure workflow template exists
    const { data: existingTpl } = await supabaseAdmin
      .from("workflow_templates").select("id").eq("category", "procurement").maybeSingle();
    if (!existingTpl) {
      const { error: tplError } = await supabaseAdmin.from("workflow_templates").insert({
        name: "תהליך רכש בינלאומי",
        category: "procurement",
        description: "תהליך רכש סטנדרטי",
        steps: [
          { name: "הזמנה ראשונית (PI)" },
          { name: "אישור מנהל" },
          { name: "העברה בנקאית (SWIFT)" },
          { name: "אישור יצרן" },
          { name: "משלוח" },
          { name: "קליטה במחסן" },
        ],
      });
      results.push(tplError ? `Template error: ${tplError.message}` : "Procurement template created");
    } else {
      results.push(`Procurement template exists: ${existingTpl.id}`);
    }

    // Ensure Israeli supplier workflow template exists
    const { data: existingIsraelTpl } = await supabaseAdmin
      .from("workflow_templates").select("id").eq("category", "procurement_israel").maybeSingle();
    if (!existingIsraelTpl) {
      const { error: israelTplError } = await supabaseAdmin.from("workflow_templates").insert({
        name: "הזמנת רכש מישראל",
        category: "procurement_israel",
        description: "תהליך רכש מספק ישראלי — אישור וחתימה",
        steps: [
          { action: "confirm",    index: 0, name: "הפקת הזמנה / הזמנת עבודה", required: true },
          { action: "approve",    index: 1, name: "העברה למחסן לטיפול",        required: true },
          { action: "approve",    index: 2, name: "אישור וחתימה",               required: true },
          { action: "send_email", index: 3, name: "שליחה לספק",                 required: true },
          { action: "send_email", index: 4, name: "קליטת סחורה + מייל לאלינור", required: true },
          { action: "confirm",    index: 5, name: "אישור קליטה במלאי",          required: true },
        ],
      });
      results.push(israelTplError ? `Israel template error: ${israelTplError.message}` : "Israel procurement template created");
    } else {
      results.push(`Israel procurement template exists: ${existingIsraelTpl.id}`);
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
