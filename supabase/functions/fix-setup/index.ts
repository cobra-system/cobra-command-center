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
    // Connect to EXTERNAL Supabase
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(externalUrl, externalServiceKey);

    const results: string[] = [];

    // Fix PINs - set plaintext PINs for employee login
    const { data: allProfiles } = await supabaseAdmin.from("profiles").select("id, name, role, pin");
    results.push(`Found ${allProfiles?.length || 0} profiles`);

    if (allProfiles) {
      for (const p of allProfiles) {
        results.push(`Profile: ${p.name} (${p.role}) pin=${p.pin ? 'SET' : 'NULL'}`);
      }

      // Find Georgi
      const georgi = allProfiles.find((p: any) => p.name.includes("גיאורגי") || p.name.includes("ג'ורג'"));
      if (georgi) {
        const { error } = await supabaseAdmin.from("profiles").update({ pin: "1111" }).eq("id", georgi.id);
        results.push(error ? `PIN Georgi error: ${error.message}` : `PIN Georgi (${georgi.name}) → 1111: OK`);
      } else {
        results.push("Georgi profile not found");
      }

      // Find Ziv
      const ziv = allProfiles.find((p: any) => p.name.includes("זיו"));
      if (ziv) {
        const { error } = await supabaseAdmin.from("profiles").update({ pin: "2222" }).eq("id", ziv.id);
        results.push(error ? `PIN Ziv error: ${error.message}` : `PIN Ziv (${ziv.name}) → 2222: OK`);
      } else {
        results.push("Ziv profile not found");
      }
    }

    // Merge task assignee names
    const { error: e3 } = await supabaseAdmin
      .from("tasks").update({ assignee_name: "זיו בוזגלו" }).eq("assignee_name", "זיו");
    results.push(e3 ? `Merge Ziv tasks: ${e3.message}` : "Merge Ziv tasks: OK");

    const { error: e4 } = await supabaseAdmin
      .from("tasks").update({ assignee_name: "גיאורגי גריגוריאנץ" }).eq("assignee_name", "ג'ורג'");
    results.push(e4 ? `Merge George tasks: ${e4.message}` : "Merge George tasks: OK");

    // Change admin email
    const adminProfile = allProfiles?.find((p: any) => p.role === "MANAGER");
    if (adminProfile) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(adminProfile.id);
      if (authUser?.user?.email !== "noam@cobra.co.il") {
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
          adminProfile.id, { email: "noam@cobra.co.il" }
        );
        results.push(emailError ? `Email error: ${emailError.message}` : "Email → noam@cobra.co.il: OK");
      } else {
        results.push("Email already noam@cobra.co.il");
      }
    }

    // Ensure procurement workflow template exists
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
          { name: "קליטה במחסן" }
        ]
      });
      results.push(tplError ? `Template error: ${tplError.message}` : "Procurement template created: OK");
    } else {
      results.push(`Procurement template exists: ${existingTpl.id}`);
    }

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
