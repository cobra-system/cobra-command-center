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

    // Fix PINs and clean up duplicate profiles
    const { data: allProfiles } = await supabaseAdmin.from("profiles").select("id, name, role, pin");
    results.push(`Found ${allProfiles?.length || 0} profiles`);

    if (allProfiles) {
      for (const p of allProfiles) {
        results.push(`Profile: ${p.name} (${p.role}) pin=${p.pin ? 'SET' : 'NULL'}`);
      }

      // Find and remove duplicates - keep the ones with full names
      // Delete "ג'ורג'" (keep "גיאורגי גריגוריאנץ")
      const georgiNew = allProfiles.find((p: any) => p.name === "גיאורגי גריגוריאנץ");
      const georgiOld = allProfiles.find((p: any) => p.name === "ג'ורג'");
      if (georgiNew && georgiOld) {
        // Move tasks from old to new
        await supabaseAdmin.from("tasks").update({ assignee_id: georgiNew.id, assignee_name: "גיאורגי גריגוריאנץ" }).eq("assignee_id", georgiOld.id);
        // Delete old auth user (cascades to profile)
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(georgiOld.id);
        results.push(delErr ? `Delete old Georgi: ${delErr.message}` : "Delete old Georgi (ג'ורג'): OK");
      }

      // Delete "זיו" (keep "זיו בוזגלו")
      const zivNew = allProfiles.find((p: any) => p.name === "זיו בוזגלו");
      const zivOld = allProfiles.find((p: any) => p.name === "זיו" && p.name !== "זיו בוזגלו");
      if (zivNew && zivOld) {
        await supabaseAdmin.from("tasks").update({ assignee_id: zivNew.id, assignee_name: "זיו בוזגלו" }).eq("assignee_id", zivOld.id);
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(zivOld.id);
        results.push(delErr ? `Delete old Ziv: ${delErr.message}` : "Delete old Ziv (זיו): OK");
      }

      // Delete "מנהל" duplicate if exists (keep "נועם")
      const noam = allProfiles.find((p: any) => p.name === "נועם" && p.role === "MANAGER");
      const mngr = allProfiles.find((p: any) => p.name === "מנהל" && p.role === "MANAGER");
      if (noam && mngr) {
        await supabaseAdmin.from("tasks").update({ assignee_id: noam.id }).eq("assignee_id", mngr.id);
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(mngr.id);
        results.push(delErr ? `Delete old Manager: ${delErr.message}` : "Delete old Manager (מנהל): OK");
      }

      // Set PINs on remaining profiles
      if (georgiNew) {
        const { error } = await supabaseAdmin.from("profiles").update({ pin: "1111" }).eq("id", georgiNew.id);
        results.push(error ? `PIN Georgi error: ${error.message}` : `PIN Georgi → 1111: OK`);
      }
      if (zivNew) {
        const { error } = await supabaseAdmin.from("profiles").update({ pin: "2222" }).eq("id", zivNew.id);
        results.push(error ? `PIN Ziv error: ${error.message}` : `PIN Ziv → 2222: OK`);
      }

      // Fix admin email
      if (noam) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(noam.id);
        if (authUser?.user?.email !== "noam@cobra.co.il") {
          const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
            noam.id, { email: "noam@cobra.co.il" }
          );
          results.push(emailError ? `Email error: ${emailError.message}` : "Email → noam@cobra.co.il: OK");
        } else {
          results.push("Email already noam@cobra.co.il");
        }
      } else if (mngr && !noam) {
        // If only "מנהל" exists, rename and update email
        await supabaseAdmin.from("profiles").update({ name: "נועם" }).eq("id", mngr.id);
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
          mngr.id, { email: "noam@cobra.co.il" }
        );
        results.push(emailError ? `Email error: ${emailError.message}` : "Renamed to נועם + email: OK");
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
