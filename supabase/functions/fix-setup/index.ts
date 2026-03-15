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

      // Fix admin - check if "נועם" has valid auth user, if not recreate
      if (noam) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(noam.id);
        if (authUser?.user) {
          if (authUser.user.email !== "noam@cobra.co.il") {
            const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
              noam.id, { email: "noam@cobra.co.il" }
            );
            results.push(emailError ? `Email error: ${emailError.message}` : "Email → noam@cobra.co.il: OK");
          } else {
            results.push("Email already noam@cobra.co.il");
          }
        } else {
          // Orphan profile - delete it and create new admin
          const { error: delProfErr } = await supabaseAdmin.from("profiles").delete().eq("id", noam.id);
          results.push(`Delete orphan profile: ${delProfErr ? delProfErr.message : 'OK'}`);
          
          // Check if an auth user with this email already exists
          const { data: { users: existingUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
          const existingAdmin = existingUsers?.find((u: any) => u.email === "noam@cobra.co.il");
          
          if (existingAdmin) {
            // Auth user already exists, just ensure profile exists
            const { data: existingProfile } = await supabaseAdmin.from("profiles").select("id").eq("id", existingAdmin.id).maybeSingle();
            if (!existingProfile) {
              await supabaseAdmin.from("profiles").insert({ id: existingAdmin.id, name: "נועם", role: "MANAGER" });
            }
            results.push(`Admin exists: ${existingAdmin.id} (${existingAdmin.email})`);
          } else {
            const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
              email: "noam@cobra.co.il",
              password: "cobra2026",
              email_confirm: true,
              user_metadata: { name: "נועם", role: "MANAGER" }
            });
            if (createErr) {
              results.push(`Create admin error: ${createErr.message}`);
              // Try to list all auth users for debugging
              results.push(`Total auth users: ${existingUsers?.length || 0}`);
              existingUsers?.forEach((u: any) => results.push(`  Auth: ${u.email} (${u.id})`));
            } else if (newUser?.user) {
              results.push(`New admin created: ${newUser.user.id}`);
            }
          }
        }
      } else {
        // No "נועם" profile - list auth users and create admin
        const { data: { users: allAuthUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
        results.push(`Auth users: ${allAuthUsers?.length || 0}`);
        allAuthUsers?.forEach((u: any) => results.push(`  Auth: ${u.email} (${u.id})`));
        
        const existingByEmail = allAuthUsers?.find((u: any) => u.email === "noam@cobra.co.il");
        if (existingByEmail) {
          await supabaseAdmin.from("profiles").upsert({ id: existingByEmail.id, name: "נועם", role: "MANAGER" });
          results.push(`Admin profile restored from existing auth: ${existingByEmail.id}`);
        } else {
          // Try creating via signUp
          const { data: signUpData, error: signUpErr } = await supabaseAdmin.auth.admin.createUser({
            email: "noam@cobra.co.il",
            password: "cobra2026",
            email_confirm: true,
          });
          if (signUpErr) {
            results.push(`Create admin error: ${signUpErr.message}`);
          } else if (signUpData?.user) {
            await supabaseAdmin.from("profiles").upsert({ id: signUpData.user.id, name: "נועם", role: "MANAGER" });
            results.push(`New admin created: ${signUpData.user.id}`);
          }
        }
      }
    }

    // Extra merge for any remaining task name references

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
