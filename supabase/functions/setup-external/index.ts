import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const EXTERNAL_URL = "https://ljpdwezgahrrffnwajho.supabase.co";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!externalKey) {
    return new Response(JSON.stringify({ error: "Missing EXTERNAL_SUPABASE_SERVICE_ROLE_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(EXTERNAL_URL, externalKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { step } = await req.json().catch(() => ({ step: "users" }));

  try {
    if (step === "users") {
      // Create auth users
      const usersToCreate = [
        { email: "admin@cobra.io", password: "cobra2026", name: "מנהל", role: "MANAGER", pin: null },
        { email: "george@cobra.io", password: "pin1111", name: "ג'ורג'", role: "WAREHOUSE_MANAGER", pin: "1111" },
        { email: "ziv@cobra.io", password: "pin2222", name: "זיו", role: "LOGISTICS", pin: "2222" },
      ];

      const userIds: Record<string, string> = {};

      // List users once
      const { data: existingUsers } = await sb.auth.admin.listUsers();

      for (const u of usersToCreate) {
        const existing = existingUsers?.users?.find(eu => eu.email === u.email);

        if (existing) {
          userIds[u.name] = existing.id;
        } else {
          const { data: authData, error: authError } = await sb.auth.admin.createUser({
            email: u.email, password: u.password, email_confirm: true,
            user_metadata: { name: u.name, role: u.role },
          });
          if (authError) throw new Error(`Failed to create ${u.email}: ${authError.message}`);
          userIds[u.name] = authData.user.id;
        }

        // Upsert profile + role
        await sb.from("profiles").upsert({ id: userIds[u.name], name: u.name, role: u.role, pin: u.pin });
        await sb.from("user_roles").upsert({ user_id: userIds[u.name], role: u.role }, { onConflict: "user_id,role" });
      }

      return new Response(JSON.stringify({ success: true, step: "users", userIds }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (step === "products") {
      const products = [
        { id: "a08eae25-9e1b-40b4-bc5b-ca45f023f510", category:"מיגון ואיתור", division:"AWCAS", name:"PROOF Z-4K", description:"מערכת צילום וניטור", sku:"z4k", product_type:"מוגמר", supplier:"iStarVideo", supplier_origin:"סין", shipping:"ימי + אווירי", purchase_price:95, monthly_sales:630, monthly_order:1600, stock_qty:1600, incoming_qty:1600 },
        { id: "31afae31-cb81-4093-8c41-2b97acdb54e2", category:"מיגון ואיתור", division:"AWCAS", name:"S400", description:"מערכת צילום וניטור", sku:"s400", product_type:"מוגמר", supplier:"iStarVideo", supplier_origin:"סין", shipping:"ימי + אווירי", purchase_price:83, monthly_sales:105, monthly_order:400, stock_qty:0, incoming_qty:400 },
        { id: "e671aaac-afa4-447a-9a1a-b5da0e6b7fcf", category:"מיגון ואיתור", division:"כפתור", name:"KAF32", description:"מערכת צילום וניטור", sku:"ks400", product_type:"מוגמר", supplier:"iStarVideo", supplier_origin:"סין", shipping:"ימי + אווירי", purchase_price:73, monthly_sales:0, monthly_order:50, stock_qty:77, incoming_qty:200, notes:"SAP לא מיושר מול חברת כפתור" },
        { id: "80796a7c-5937-41c3-a867-3badeab12db8", category:"מיגון ואיתור", division:"כפתור", name:"COBRA Secret", description:"מערכת ניטור וניתוק", sku:"cobrasecrect", product_type:"מורכב", supplier_origin:"ישראל, סין", shipping:"ימי", monthly_sales:50, monthly_order:50, stock_qty:383, incoming_qty:0, notes:"אין צפי הזמנות. אין צריכה." },
        { id: "f2ef4b54-cc79-457e-9d28-1c00e7967888", category:"מיגון ואיתור", division:"AWCAS", name:"COBRA Biometric", description:"מערכת התנעה ביומטרית", sku:"biofin", product_type:"מורכב", supplier:"CR Team", supplier_origin:"ישראל, סין", shipping:"אווירי", monthly_sales:20, stock_qty:0, incoming_qty:0, notes:"לעדכן ספירה" },
        { id: "8d5ef79e-0a52-4191-a942-be1bdb463013", category:"מיגון ואיתור", division:"AWCAS, דלק מוטורס, כפתור", name:"מערכת איתור Connect", description:"מערכת ניטור", sku:"5224", product_type:"מוגמר", supplier_origin:"ישראל", shipping:"יבשתי", monthly_sales:200, monthly_order:300, stock_qty:1008, incoming_qty:0 },
        { id: "6e543c60-5b9c-4e02-b3b8-2043341dea89", category:"מולטימדיה", division:"AWCAS", name:"COBRA BackseatTV1", description:"מערכת מולטימדיה", sku:"cobratv1", product_type:"מורכב", supplier:"ACESVision", supplier_origin:"סין", shipping:"ימי", purchase_price:232.9, monthly_sales:3, stock_qty:69, incoming_qty:0 },
        { id: "65386b8a-b6f6-4ad6-8d15-954d98dca96f", category:"מולטימדיה", division:"AWCAS", name:"COBRA BackseatTV2", description:"מערכת מולטימדיה", sku:"cobratv2", product_type:"מורכב", supplier:"ACESVision", supplier_origin:"סין", shipping:"ימי", purchase_price:140, monthly_sales:2, stock_qty:0, incoming_qty:0 },
        { id: "6eadcd04-0a6b-434e-b38e-c6e12e9bb8a1", category:"מולטימדיה", division:"קראסו, דלק מוטורס, לובינסקי", name:"מסכי אנדרואיד", description:"מערכת מולטימדיה", sku:"AHM1280A", product_type:"מוגמר", supplier:"ACESVision", supplier_origin:"סין", shipping:"ימי", purchase_price:130, monthly_sales:42, stock_qty:63, incoming_qty:0 },
        { id: "de4a5e92-c94e-4bf9-b8e1-fa3ab8fe8b1e", category:"מולטימדיה", division:"קראסו, דלק מוטורס, לובינסקי", name:"אוזניות בלוטוס", description:"אוזניות בלוטוס", sku:"BT100", product_type:"מוגמר", supplier:"ACESVision", supplier_origin:"סין", shipping:"ימי", purchase_price:7.5, monthly_sales:65, stock_qty:0, incoming_qty:0, notes:"לעדכן ספירה" },
        { id: "3c61ac22-200a-4042-8d5f-28bae43b7165", category:"בטיחות", division:"כפתור", name:"הכפתור", sku:"kaf4g_new", product_type:"מוגמר", supplier:"CR Team", supplier_origin:"ישראל", shipping:"יבשתי", purchase_price:150, monthly_order:780, stock_qty:194, incoming_qty:500 },
        { id: "dd42601d-c3b4-4390-bd3e-385d52290573", category:"בטיחות", division:"AWCAS, כפתור, קראסו", name:"Blindspot", sku:"m305", product_type:"מוגמר", supplier:"AutoStar", supplier_origin:"סין", shipping:"ימי", purchase_price:84, monthly_sales:105, monthly_order:100, stock_qty:0, incoming_qty:0 },
        { id: "063cda4c-8a67-4da5-9ab1-7d51f5789d3f", category:"בטיחות", division:"AWCAS", name:"AWACS CM 108", sku:"r8", product_type:"מורכב", supplier:"A.I Matics", supplier_origin:"דרום קוריאה", shipping:"ימי", purchase_price:145, monthly_sales:60, stock_qty:6, incoming_qty:500 },
        { id: "18ef7456-af16-43e1-8c87-27aff82b3b00", category:"בטיחות", division:"דלק מוטורס", name:"Surround-Eye Parking Sensors", sku:"r294", product_type:"מוגמר", supplier:"VodaPhone", supplier_origin:"איטליה", shipping:"אווירי", purchase_price:26, monthly_sales:260, monthly_order:300, stock_qty:242, incoming_qty:0 },
        { id: "b9a8019c-fe63-4fc4-a851-0c5a52b04ef2", category:"בטיחות", division:"דלק מוטורס", name:"COBRA Alert", sku:"4821", product_type:"מוגמר", supplier:"VodaPhone", supplier_origin:"איטליה", shipping:"אווירי", purchase_price:39.5, monthly_sales:530, monthly_order:775, stock_qty:63, incoming_qty:0 },
        { id: "b71f2810-ce08-4d3e-a9a8-a9b5e2f9bca7", category:"נוחות וקישוריות", division:"כפתור", name:"COBRA Mobile Key", sku:"mkey-v05", product_type:"מורכב", supplier:"CR Team", supplier_origin:"ישראל, סין", shipping:"ימי", monthly_sales:15, stock_qty:226, incoming_qty:0 },
        { id: "0a988a3b-f6d8-4e84-a1e2-2be7ee1e72b3", category:"נוחות וקישוריות", division:"דלק מוטורס", name:"פותח תא מטען", sku:"tgcx5", product_type:"מוגמר", supplier:"vehicleTech", supplier_origin:"סין", shipping:"ימי + אווירי", purchase_price:230, monthly_sales:37, monthly_order:50, stock_qty:190, incoming_qty:50 },
        { id: "a14f8f5d-0c90-44a7-a5a8-f7e4b8f3d2c1", category:"נוחות וקישוריות", division:"לובינסקי", name:"פותח מצלמה אחורית לברלינגו", sku:"31217", product_type:"מוגמר", supplier:"BOW", supplier_origin:"סין", shipping:"אווירי", purchase_price:86, monthly_sales:90, monthly_order:100, stock_qty:162, incoming_qty:0 },
        { id: "c3b5a7d9-e2f1-4d8a-b6c4-9e7f0a1d2b3c", category:"בית", division:"Doore", name:"Doore", sku:"doorexr-full", product_type:"מורכב", supplier_origin:"ישראל, סין", shipping:"ימי + אווירי", monthly_sales:60, stock_qty:169, incoming_qty:0 },
      ];

      const { error } = await sb.from("products").upsert(products, { onConflict: "sku" });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, step: "products", count: products.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (step === "suppliers") {
      const suppliers = [
        { id: "9756e3a3-dc31-4340-8051-b50252f97c49", contact_name:"MAIRIA / Carolyn", company:"iStar Video", email:"maria@istarvideo.com", country:"חול", products:"PROOF Z-4K, S400, KAF32, Doore Doorbell" },
        { id: "09fd9c26-d4c8-4179-a323-f187835aa652", contact_name:"Simon", company:"ACESVision", email:"sales@acesvision.com", country:"חול", products:"BackseatTV1, BackseatTV2, מסכי אנדרואיד" },
        { id: "a8c7b9d1-3e5f-4a2d-b6c8-9e1f0a3d5b7c", contact_name:"Denver", company:"BOW", email:"denverzheng@hotmail.com", country:"חול", products:"פותח מצלמה אחורית לברלינגו" },
        { id: "b9d8c0e2-4f6a-5b3e-c7d9-0f2a1b4c6d8e", contact_name:"Winni Wu", company:"GROW", email:"winni@hzgrow.com", country:"חול", products:"סורק טביעות אצבע לביומטרי" },
        { id: "3afd858e-f5b8-4032-8e5a-cd170e5cb28d", contact_name:"Ivy", company:"SwitchBot WOAN", email:"ivy@switch-bot.com", country:"חול", products:"Doore Ultra" },
        { id: "a780e0a6-8192-431e-938f-b65475dfeeed", contact_name:"John", company:"VehicleTech", email:"john@vehicle-tech.net", country:"חול", products:"פותח תא מטען" },
        { id: "46b4eae6-1b52-473c-ae25-dd5acd65d05e", contact_name:"Brikena / Federica", company:"Vodafone Automotive", email:"brikena.hamataj@vodafone.com", country:"חול", products:"COBRA Alert, Parking Sensors" },
        { id: "3817bfe9-e7f9-4bf4-bf90-3cc09ab8ddd6", contact_name:"Emma", company:"AutoStar / Just Supply", email:"emma@auto-star.com.cn", country:"חול", products:"Blindspot" },
        { id: "bfa6abce-28bb-4322-a990-f6d08df7eefa", contact_name:"Neil", company:"A.I. Matics", email:"neil@aimatics.ai", country:"חול", products:"AWACS CM108" },
        { id: "f5c3e2d1-9a8b-4c7d-e6f5-a4b3c2d1e0f9", contact_name:"Zoe", company:"TS Prototypes", email:"sales9@tsprototypes.com", country:"חול", products:"פלסטיקה לביומטרי" },
        { id: "a6d4f3e2-0b9c-5d8e-f7a6-b5c4d3e2f1a0", contact_name:"Nataya", company:"AUTHOR-ALARM", email:"vankova@author-alarm.com", country:"חול", products:"IGLA100, IGLA200, IGLA230" },
      ];

      const { error } = await sb.from("suppliers").upsert(suppliers, { onConflict: "id" });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, step: "suppliers", count: suppliers.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (step === "orders") {
      const orders = [
        { id: "93dd155e-4e02-4cb1-a214-a25ce42a4a67", priority:"דחוף", supplier_name:"iStar", shipping:"ימי", status:"SHIPPED", eta:"2026-04-10T00:00:00Z" },
        { id: "9b03b22b-3b8c-4a20-a2f3-a28be816b133", priority:"גבוה", supplier_name:"iStar", shipping:"ימי", status:"SHIPPED" },
        { id: "a3681410-1467-4af1-af04-e757e7ed92e8", priority:"דחוף", supplier_name:"Switch-Bot", supplier_id:"3afd858e-f5b8-4032-8e5a-cd170e5cb28d", status:"ORDERED" },
        { id: "700c41f0-5dcb-4be0-89e9-68ba6ada18d3", priority:"בינוני", supplier_name:"AutoStar", supplier_id:"3817bfe9-e7f9-4bf4-bf90-3cc09ab8ddd6", shipping:"ימי", status:"ORDERED", total_price:16800 },
        { id: "18b7868d-4fb3-4c6b-a08d-8056252e2c94", priority:"בינוני", supplier_name:"A.I.Matics", supplier_id:"bfa6abce-28bb-4322-a990-f6d08df7eefa", shipping:"ימי", status:"PENDING", total_price:72500 },
      ];

      const { error: ordErr } = await sb.from("orders").upsert(orders, { onConflict: "id" });
      if (ordErr) throw ordErr;

      const orderItems = [
        { id: "b477ef24-1d69-48c0-a492-a9c81b22bd95", order_id: "93dd155e-4e02-4cb1-a214-a25ce42a4a67", name: "PROOF Z-4K", qty: 1600 },
        { id: "aba8f98c-3308-4c74-bc97-7ba4e06badca", order_id: "9b03b22b-3b8c-4a20-a2f3-a28be816b133", name: "S400", qty: 400 },
        { id: "add14735-9e88-4f29-bcb0-15fdc293ed0f", order_id: "a3681410-1467-4af1-af04-e757e7ed92e8", name: "Doore Ultra", qty: 350 },
        { id: "11a5c801-2122-4778-baf9-d9c161d53a38", order_id: "700c41f0-5dcb-4be0-89e9-68ba6ada18d3", name: "Blindspot", qty: 200, price: 84, product_id: "dd42601d-c3b4-4390-bd3e-385d52290573" },
        { id: "c5464fad-eab9-4fd6-bae0-af6cd5e2cc96", order_id: "18b7868d-4fb3-4c6b-a08d-8056252e2c94", name: "AWACS CM 108", qty: 500, price: 145, product_id: "063cda4c-8a67-4da5-9ab1-7d51f5789d3f" },
      ];

      const { error: oiErr } = await sb.from("order_items").upsert(orderItems, { onConflict: "id" });
      if (oiErr) throw oiErr;

      return new Response(JSON.stringify({ success: true, step: "orders" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (step === "tasks") {
      // First get user IDs
      const { data: existingUsers } = await sb.auth.admin.listUsers();
      const georgeId = existingUsers?.users?.find(u => u.email === "george@cobra.io")?.id;
      const zivId = existingUsers?.users?.find(u => u.email === "ziv@cobra.io")?.id;
      const adminId = existingUsers?.users?.find(u => u.email === "admin@cobra.io")?.id;

      const tasks = [
        { title:"ספירת מלאי — COBRA Biometric", priority:"דחוף", status:"TODO", is_daily:false, notes:"ספירה ואיפוס מלאי", assignee_id:georgeId, assignee_name:"ג'ורג'" },
        { title:"ספירת מלאי — COBRA TV", priority:"דחוף", status:"TODO", is_daily:false, assignee_id:georgeId, assignee_name:"ג'ורג'" },
        { title:"ספירת מלאי — הכפתור", priority:"דחוף", status:"TODO", is_daily:false, assignee_id:georgeId, assignee_name:"ג'ורג'" },
        { title:"ספירת מלאי — Blindspot", priority:"דחוף", status:"TODO", is_daily:false, assignee_id:georgeId, assignee_name:"ג'ורג'" },
        { title:"איזון SAP מול חברת כפתור — KAF32", priority:"גבוה", status:"TODO", is_daily:false, notes:"מקט KAF32 לא מיושר", assignee_id:zivId, assignee_name:"זיו" },
        { title:"בדיקת ETA הזמנת Z4K מ-iStar", priority:"דחוף", status:"TODO", is_daily:false, notes:"ETA: 10 אפריל 2026", assignee_id:zivId, assignee_name:"זיו" },
        { title:"ארגון מחסן קדמי", priority:"בינוני", status:"TODO", is_daily:true, assignee_id:georgeId, assignee_name:"ג'ורג'" },
        { title:"קבלת משלוח iStar", priority:"גבוה", status:"TODO", is_daily:true, assignee_id:georgeId, assignee_name:"ג'ורג'" },
        { title:"עדכון מלאי במערכת", priority:"בינוני", status:"TODO", is_daily:true, assignee_id:georgeId, assignee_name:"ג'ורג'" },
        { title:"חתימה דיגיטלית", priority:"גבוה", status:"TODO", is_daily:false, assignee_id:adminId, assignee_name:"נועם" },
        { title:"העברה של כל הסיסמאות שיש", priority:"דחוף", status:"TODO", is_daily:false, assignee_id:adminId, assignee_name:"נועם" },
        { title:"פתיחה של משתמש בSAP", priority:"דחוף", status:"TODO", is_daily:false, assignee_name:"נועם" },
        { title:"פורטל סלקום - סיסמא", priority:"דחוף", status:"TODO", is_daily:false, assignee_name:"נועם" },
        { title:"פורטל פלאפון - סיסמא", priority:"דחוף", status:"TODO", is_daily:false, assignee_name:"נועם" },
      ];

      const { error } = await sb.from("tasks").insert(tasks);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, step: "tasks" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (step === "extras") {
      // Distribution centers, recurring tasks, compliance, workflow templates
      const centers = [
        { id: "ac235b17-fd89-4b58-a6c0-14e730e97e35", name: "מרכז הפצה תל אביב", city: "תל אביב", type: "main", is_main: true },
        { id: "8efd8988-533f-46b3-9bf7-8c6973c82c06", name: "דלק מוטורס", type: "bonded", is_main: false },
        { id: "71182d80-571c-439d-baf6-ccf1f4374d45", name: "פריזבי קרסו", type: "bonded", is_main: false },
        { id: "ba65b0d3-324f-4ecd-b0cc-eade6491f57b", name: "לובינסקי", type: "bonded", is_main: false },
      ];
      await sb.from("distribution_centers").upsert(centers, { onConflict: "id" });

      const recurringTaskTemplates = [
        { id: "f9f1ce6a-3d6c-4d05-a61b-d39823cf6d04", title: "ישיבת רכש PI - שני", description: "ישיבת רכש PI ביום שני", frequency: "weekly", priority: "גבוה", day_of_week: 1, days_before: 1, time_of_day: "09:00:00", is_active: true, status: "TEMPLATE", is_daily: false },
        { id: "0bf8ca5b-c81f-4127-8e9a-d7372bcf417f", title: "ישיבת רכש PI - חמישי", description: "ישיבת רכש PI ביום חמישי", frequency: "weekly", priority: "גבוה", day_of_week: 4, days_before: 1, time_of_day: "09:00:00", is_active: true, status: "TEMPLATE", is_daily: false },
        { id: "400511a2-3c48-4fd9-a515-3bb87143b2fa", title: "יישור קו תשלומים עם קרן", description: "סיכום חודשי של תשלומים ותזרים מזומנים", frequency: "monthly", priority: "גבוה", day_of_month: 1, days_before: 3, time_of_day: "09:00:00", is_active: true, status: "TEMPLATE", is_daily: false },
        { id: "e149f43e-8adb-45ea-929b-33e786ea84fa", title: "לוז נסיעות מחסן", description: "בניית לוז הנסיעות של המחסן ליום למחרת", frequency: "daily", priority: "גבוה", time_of_day: "16:00:00", is_active: true, status: "TEMPLATE", is_daily: false },
      ];
      await sb.from("tasks").upsert(recurringTaskTemplates, { onConflict: "id" });

      const complianceItems = [
        { id: "57facbfb-b609-4d23-b410-00df982eda29", name: "רישיון יבוא", category: "יבוא", status: "active", expiry_date: "2026-12-31", notes: "חידוש שנתי" },
        { id: "2ea694c1-a070-4801-87a4-4b74906a0ba4", name: "רישיון תקשורת", category: "תקשורת", status: "active", expiry_date: "2026-09-26", notes: "רישיון תקשורת למוצר Biometric" },
      ];
      await sb.from("compliance_items").upsert(complianceItems, { onConflict: "id" });

      const workflowTemplate = {
        id: "b5a990c9-579d-4d9f-8e9a-90a8856ad00b",
        name: "הזמנת רכש מחו\"ל",
        description: "תהליך מלא להזמנת רכש בינלאומית",
        category: "procurement",
        steps: [
          { action: "upload_file", index: 0, name: "קבלת PI מספק", required: true },
          { action: "send_email",  index: 1, name: "שליחת PI למחלקת פיננסים", required: true },
          { action: "approve",     index: 2, name: "אישור בישיבת רכש", required: true },
          { action: "input_eta",   index: 3, name: "שליחת SWIFT לספק + עדכון ETA במערכת", required: true },
          { action: "send_email",  index: 4, name: "קליטת סחורה + מייל לאחרית SAP אלינור", required: true },
          { action: "confirm",     index: 5, name: "אישור קליטה במלאי", required: true },
        ],
      };
      await sb.from("workflow_templates").upsert(workflowTemplate, { onConflict: "id" });

      const israelWorkflowTemplate = {
        id: "c7b881d0-68ae-4e0a-9f1b-a1b9967be11c",
        name: "הזמנת רכש מישראל",
        description: "תהליך רכש מספק ישראלי",
        category: "procurement_israel",
        steps: [
          { action: "confirm",    index: 0, name: "קבלת בקשה להזמנה", required: true },
          { action: "approve",    index: 1, name: "הזמנה אושרה",       required: true },
          { action: "send_email", index: 2, name: "שליחה לספק",        required: true },
          { action: "confirm",    index: 3, name: "נשלחה לספק",        required: true },
        ],
      };
      await sb.from("workflow_templates").upsert(israelWorkflowTemplate, { onConflict: "id" });

      return new Response(JSON.stringify({ success: true, step: "extras" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown step. Use: users, products, suppliers, orders, tasks, extras" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err), step }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
