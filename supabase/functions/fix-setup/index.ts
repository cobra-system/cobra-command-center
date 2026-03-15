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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: string[] = [];

    // Fix Georgi's PIN to 1111
    const { error: e1 } = await supabaseAdmin
      .from("profiles")
      .update({ pin: "1111" })
      .eq("name", "גיאורגי גריגוריאנץ");
    results.push(e1 ? `PIN Georgi error: ${e1.message}` : "PIN Georgi → 1111: OK");

    // Fix Ziv's PIN to 2222
    const { error: e2 } = await supabaseAdmin
      .from("profiles")
      .update({ pin: "2222" })
      .eq("name", "זיו בוזגלו");
    results.push(e2 ? `PIN Ziv error: ${e2.message}` : "PIN Ziv → 2222: OK");

    // Merge task assignee names
    // Update tasks with "זיו" to "זיו בוזגלו"
    const { error: e3 } = await supabaseAdmin
      .from("tasks")
      .update({ assignee_name: "זיו בוזגלו" })
      .eq("assignee_name", "זיו");
    results.push(e3 ? `Merge Ziv tasks: ${e3.message}` : "Merge Ziv tasks: OK");

    // Update tasks with "ג'ורג'" to "גיאורגי גריגוריאנץ"
    const { error: e4 } = await supabaseAdmin
      .from("tasks")
      .update({ assignee_name: "גיאורגי גריגוריאנץ" })
      .eq("assignee_name", "ג'ורג'");
    results.push(e4 ? `Merge George tasks: ${e4.message}` : "Merge George tasks: OK");

    // Change admin email from admin@cobra.io to noam@cobra.co.il
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "MANAGER")
      .single();

    if (adminProfile) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
        adminProfile.id,
        { email: "noam@cobra.co.il" }
      );
      results.push(emailError ? `Email error: ${emailError.message}` : "Email → noam@cobra.co.il: OK");
    } else {
      results.push("Admin profile not found");
    }

    // Clean up duplicate profiles by checking for duplicates
    const { data: allProfiles } = await supabaseAdmin.from("profiles").select("id, name, role");
    results.push(`Total profiles: ${allProfiles?.length || 0}`);

    return new Response(JSON.stringify({ results }), {
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
