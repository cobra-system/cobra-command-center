import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Create auth users
    const usersToCreate = [
      { email: "admin@cobra.io", password: "cobra2026", name: "מנהל", role: "MANAGER", pin: null },
      { email: "george@cobra.io", password: "pin1111", name: "ג'ורג'", role: "WAREHOUSE_MANAGER", pin: "1111" },
      { email: "ziv@cobra.io", password: "pin2222", name: "זיו", role: "LOGISTICS", pin: "2222" },
    ];

    const userIds: Record<string, string> = {};

    for (const u of usersToCreate) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(eu => eu.email === u.email);
      
      if (existing) {
        userIds[u.name] = existing.id;
        // Update profile with PIN
        await supabaseAdmin.from("profiles").upsert({
          id: existing.id,
          name: u.name,
          role: u.role,
          pin: u.pin,
        });
      } else {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name, role: u.role },
        });
        if (authError) throw new Error(`Failed to create user ${u.email}: ${authError.message}`);
        userIds[u.name] = authData.user.id;
        
        // Update PIN in profile (trigger creates profile)
        if (u.pin) {
          await supabaseAdmin.from("profiles").update({ pin: u.pin }).eq("id", authData.user.id);
        }
      }

      // Add to user_roles
      await supabaseAdmin.from("user_roles").upsert({
        user_id: userIds[u.name],
        role: u.role,
      }, { onConflict: "user_id,role" });
    }

    // 2. Seed products
    const products = [
      { category:"מיגון ואיתור", division:"AWCAS", name:"PROOF Z-4K", description:"מערכת צילום וניטור", sku:"z4k", product_type:"מוגמר", supplier:"iStarVideo", supplier_origin:"סין", shipping:"ימי + אווירי", purchase_price:95, monthly_sales:630, monthly_order:1600, stock_qty:1600, incoming_qty:1600 },
      { category:"מיגון ואיתור", division:"AWCAS", name:"S400", description:"מערכת צילום וניטור", sku:"s400", product_type:"מוגמר", supplier:"iStarVideo", supplier_origin:"סין", shipping:"ימי + אווירי", purchase_price:83, monthly_sales:105, monthly_order:400, stock_qty:0, incoming_qty:400 },
      { category:"מיגון ואיתור", division:"כפתור", name:"KAF32", description:"מערכת צילום וניטור", sku:"ks400", product_type:"מוגמר", supplier:"iStarVideo", supplier_origin:"סין", shipping:"ימי + אווירי", purchase_price:73, monthly_sales:0, monthly_order:50, stock_qty:77, incoming_qty:200, notes:"SAP לא מיושר מול חברת כפתור" },
      { category:"מיגון ואיתור", division:"כפתור", name:"COBRA Secret", description:"מערכת ניטור וניתוק", sku:"cobrasecrect", product_type:"מורכב", supplier_origin:"ישראל, סין", shipping:"ימי", monthly_sales:50, monthly_order:50, stock_qty:383, incoming_qty:0, notes:"אין צפי הזמנות. אין צריכה." },
      { category:"מיגון ואיתור", division:"AWCAS", name:"COBRA Biometric", description:"מערכת התנעה ביומטרית", sku:"biofin", product_type:"מורכב", supplier:"CR Team", supplier_origin:"ישראל, סין", shipping:"אווירי", monthly_sales:20, stock_qty:0, incoming_qty:0, notes:"לעדכן ספירה" },
      { category:"מיגון ואיתור", division:"AWCAS, דלק מוטורס, כפתור", name:"מערכת איתור Connect", description:"מערכת ניטור", sku:"5224", product_type:"מוגמר", supplier_origin:"ישראל", shipping:"יבשתי", monthly_sales:200, monthly_order:300, stock_qty:1008, incoming_qty:0 },
      { category:"מולטימדיה", division:"AWCAS", name:"COBRA BackseatTV1", description:"מערכת מולטימדיה", sku:"cobratv1", product_type:"מורכב", supplier:"ACESVision", supplier_origin:"סין", shipping:"ימי", purchase_price:232.9, monthly_sales:3, stock_qty:69, incoming_qty:0 },
      { category:"מולטימדיה", division:"AWCAS", name:"COBRA BackseatTV2", description:"מערכת מולטימדיה", sku:"cobratv2", product_type:"מורכב", supplier:"ACESVision", supplier_origin:"סין", shipping:"ימי", purchase_price:140, monthly_sales:2, stock_qty:0, incoming_qty:0 },
      { category:"מולטימדיה", division:"קראסו, דלק מוטורס, לובינסקי", name:"מסכי אנדרואיד", description:"מערכת מולטימדיה", sku:"AHM1280A", product_type:"מוגמר", supplier:"ACESVision", supplier_origin:"סין", shipping:"ימי", purchase_price:130, monthly_sales:42, stock_qty:63, incoming_qty:0 },
      { category:"מולטימדיה", division:"קראסו, דלק מוטורס, לובינסקי", name:"אוזניות בלוטוס", description:"אוזניות בלוטוס", sku:"BT100", product_type:"מוגמר", supplier:"ACESVision", supplier_origin:"סין", shipping:"ימי", purchase_price:7.5, monthly_sales:65, stock_qty:0, incoming_qty:0, notes:"לעדכן ספירה" },
      { category:"בטיחות", division:"כפתור", name:"הכפתור", sku:"kaf4g_new", product_type:"מוגמר", supplier:"CR Team", supplier_origin:"ישראל", shipping:"יבשתי", purchase_price:150, monthly_order:780, stock_qty:194, incoming_qty:500, notes:"צריך ליישר קו עם מחלקת הכפתור בנוגע למקטים" },
      { category:"בטיחות", division:"AWCAS, כפתור, קראסו", name:"Blindspot", sku:"m305", product_type:"מוגמר", supplier:"AutoStar", supplier_origin:"סין", shipping:"ימי", purchase_price:84, monthly_sales:105, monthly_order:100, stock_qty:0, incoming_qty:0, notes:"לעדכן ספירה" },
      { category:"בטיחות", division:"AWCAS", name:"AWACS CM 108", sku:"r8", product_type:"מורכב", supplier:"A.I Matics", supplier_origin:"דרום קוריאה", shipping:"ימי", purchase_price:145, monthly_sales:60, stock_qty:6, incoming_qty:500 },
      { category:"בטיחות", division:"דלק מוטורס", name:"Surround-Eye Parking Sensors", sku:"r294", product_type:"מוגמר", supplier:"VodaPhone", supplier_origin:"איטליה", shipping:"אווירי", purchase_price:26, monthly_sales:260, monthly_order:300, stock_qty:242, incoming_qty:0 },
      { category:"בטיחות", division:"דלק מוטורס", name:"COBRA Alert", sku:"4821", product_type:"מוגמר", supplier:"VodaPhone", supplier_origin:"איטליה", shipping:"אווירי", purchase_price:39.5, monthly_sales:530, monthly_order:775, stock_qty:63, incoming_qty:0 },
      { category:"נוחות וקישוריות", division:"כפתור", name:"COBRA Mobile Key", sku:"mkey-v05", product_type:"מורכב", supplier:"CR Team", supplier_origin:"ישראל, סין", shipping:"ימי", monthly_sales:15, stock_qty:226, incoming_qty:0 },
      { category:"נוחות וקישוריות", division:"דלק מוטורס", name:"פותח תא מטען", sku:"tgcx5", product_type:"מוגמר", supplier:"vehicleTech", supplier_origin:"סין", shipping:"ימי + אווירי", purchase_price:230, monthly_sales:37, monthly_order:50, stock_qty:190, incoming_qty:50, notes:"כרגע אין צפי הזמנות מדלק מוטורס" },
      { category:"נוחות וקישוריות", division:"לובינסקי", name:"פותח מצלמה אחורית לברלינגו", sku:"31217", product_type:"מוגמר", supplier:"BOW", supplier_origin:"סין", shipping:"אווירי", purchase_price:86, monthly_sales:90, monthly_order:100, stock_qty:162, incoming_qty:0 },
      { category:"בית", division:"Doore", name:"Doore", sku:"doorexr-full", product_type:"מורכב", supplier_origin:"ישראל, סין", shipping:"ימי + אווירי", monthly_sales:60, stock_qty:169, incoming_qty:0 },
    ];

    // Upsert products
    for (const p of products) {
      await supabaseAdmin.from("products").upsert(p, { onConflict: "sku" });
    }

    // Get product IDs for components
    const { data: dbProducts } = await supabaseAdmin.from("products").select("id, sku");
    const productMap: Record<string, string> = {};
    dbProducts?.forEach(p => { productMap[p.sku] = p.id; });

    // Components for assembled products
    const components = [
      { product_id: productMap["cobrasecrect"], name: "מודול GPS", sku: "gps-01", supplier: "RootRust", origin: "סין", stock_qty: 200, price: 12 },
      { product_id: productMap["cobrasecrect"], name: "יחידת שליטה", sku: "ctrl-01", supplier: "CR Team", origin: "ישראל", stock_qty: 150, price: 35 },
      { product_id: productMap["cobrasecrect"], name: "חיווט ראשי", supplier: "חיווט נאה", origin: "ישראל", stock_qty: 400, price: 8 },
      { product_id: productMap["biofin"], name: "סורק טביעות אצבע", sku: "fp-scan", supplier: "GROW", origin: "סין", stock_qty: 50, price: 18 },
      { product_id: productMap["biofin"], name: "לוח PCB", sku: "pcb-bio", supplier: "Fastline PCB", origin: "סין", stock_qty: 100, price: 22 },
      { product_id: productMap["biofin"], name: "מארז פלסטיק", sku: "case-bio", supplier: "TS Prototypes", origin: "סין", stock_qty: 80, price: 5 },
    ];

    // Clear existing components and insert
    for (const c of components) {
      if (c.product_id) {
        await supabaseAdmin.from("product_components").insert(c);
      }
    }

    // 3. Seed suppliers
    const allSuppliers = [
      { contact_name:"MAIRIA / Carolyn", company:"iStar Video", email:"maria@istarvideo.com", country:"חול", products:"PROOF Z-4K, S400, KAF32, Doore Doorbell" },
      { contact_name:"Simon", company:"ACESVision", email:"sales@acesvision.com", country:"חול", products:"BackseatTV1, BackseatTV2, מסכי אנדרואיד" },
      { contact_name:"Denver", company:"BOW", email:"denverzheng@hotmail.com", country:"חול", products:"פותח מצלמה אחורית לברלינגו" },
      { contact_name:"Winni Wu", company:"GROW", email:"winni@hzgrow.com", country:"חול", products:"סורק טביעות אצבע לביומטרי" },
      { contact_name:"Lois", company:"Kaier", email:"sales8@szkaier.com", country:"חול", products:"מערכות מולטימדיה" },
      { contact_name:"ADA", company:"LOWC", email:"ada@lowctech.com", country:"חול", products:"סוללות" },
      { contact_name:"Jenny", company:"RootRust", email:"jenny@rootrust.com", country:"חול", products:"דונגלים, נתבים" },
      { contact_name:"Ivy", company:"SwitchBot WOAN", email:"ivy@switch-bot.com", country:"חול", products:"Doore Ultra" },
      { contact_name:"John", company:"VehicleTech", email:"john@vehicle-tech.net", country:"חול", products:"פותח תא מטען" },
      { contact_name:"Brikena / Federica", company:"Vodafone Automotive", email:"brikena.hamataj@vodafone.com", country:"חול", products:"COBRA Alert, Parking Sensors" },
      { contact_name:"Emma", company:"AutoStar / Just Supply", email:"emma@auto-star.com.cn", country:"חול", products:"Blindspot" },
      { contact_name:"Neil", company:"A.I. Matics", email:"neil@aimatics.ai", country:"חול", products:"AWACS CM108" },
      { contact_name:"Zoe", company:"TS Prototypes", email:"sales9@tsprototypes.com", country:"חול", products:"פלסטיקה לביומטרי" },
      { contact_name:"Nataya", company:"AUTHOR-ALARM", email:"vankova@author-alarm.com", country:"חול", products:"IGLA100, IGLA200, IGLA230" },
      { contact_name:"Pancras Qiu", company:"Kunshan RCD Electronics", email:"sales16@ksrcd.com", country:"חול" },
      { contact_name:"Florian", company:"KUDA", email:"florian.kuhlmann@kuda-phonebase.de", country:"חול" },
      { contact_name:"Wendy", company:"HYF / Herofun-Bio", email:"sales07@herofun-bio.com", country:"חול" },
      { contact_name:"Cari", company:"Topfoison", email:"cari.huang@topfoison.com", country:"חול", products:"תצוגות" },
      { contact_name:"Jenny", company:"Fastline PCB", email:"jenny@fastlinepcb.com", country:"חול", products:"PCB" },
      { contact_name:"אופיר", company:"ניפון", phone:"054-2315566", email:"udi.nippon@gmail.com", country:"ישראל", products:"מולטימדיות" },
      { contact_name:"ישראל", company:"ספטרוטק", phone:"0522260438", country:"ישראל", products:"קודניות" },
      { contact_name:"אריאל", company:"ERM", phone:"0545727969", email:"ariel@erm.co.il", country:"ישראל", products:"מרים, קודניות" },
      { contact_name:"ברוך", company:"חיווט נאה", phone:"0504287855", country:"ישראל", products:"צמות" },
      { contact_name:"רועי", company:"דרור כלי עבודה", phone:"0545900107", email:"office@dror-tools.co.il", country:"ישראל", products:"כלי עבודה" },
      { contact_name:"גילי", company:"MTS", phone:"0502931497", country:"ישראל", products:"בגדים" },
      { contact_name:"יואב", company:"קונטקט ליין", phone:"0544237237", country:"ישראל", products:"מצלמות רוורס, מסכים, חיישנים" },
      { contact_name:"יניב", company:"אדי מערכות", phone:"03-9629296", email:"yaniv@adi-system.co.il", country:"ישראל", products:"מצלמות, סאבופר" },
    ];

    for (const s of allSuppliers) {
      await supabaseAdmin.from("suppliers").insert(s);
    }

    // 4. Seed orders
    const georgeId = userIds["ג'ורג'"];
    const zivId = userIds["זיו"];

    // Get supplier IDs
    const { data: dbSuppliers } = await supabaseAdmin.from("suppliers").select("id, company");

    const orders = [
      { priority:"דחוף", supplier_name:"iStar", shipping:"ימי", status:"SHIPPED", eta:"2026-04-10T00:00:00Z", items:[{ name:"PROOF Z-4K", qty:1600 }] },
      { priority:"גבוה", supplier_name:"iStar", shipping:"ימי", status:"SHIPPED", items:[{ name:"S400", qty:400 }] },
      { priority:"בינוני", supplier_name:"SwitchBot", status:"ORDERED", items:[{ name:"Doore Ultra", qty:350 }] },
      { priority:"נמוך", supplier_name:"iStar", status:"ORDERED", items:[{ name:"Doore Doorbell", qty:1000 }] },
    ];

    for (const o of orders) {
      const { items, ...orderData } = o;
      const { data: orderRow, error: orderErr } = await supabaseAdmin.from("orders").insert(orderData).select("id").single();
      if (orderErr || !orderRow) continue;
      for (const item of items) {
        await supabaseAdmin.from("order_items").insert({ order_id: orderRow.id, ...item });
      }
    }

    // 5. Seed tasks
    const tasksData = [
      { title:"ספירת מלאי — COBRA Biometric", priority:"דחוף", status:"TODO", is_daily:false, notes:"ספירה ואיפוס מלאי", assignee_id:georgeId, assignee_name:"ג'ורג'" },
      { title:"ספירת מלאי — COBRA TV", priority:"דחוף", status:"TODO", is_daily:false, assignee_id:georgeId, assignee_name:"ג'ורג'" },
      { title:"ספירת מלאי — הכפתור", priority:"דחוף", status:"IN_PROGRESS", is_daily:false, assignee_id:georgeId, assignee_name:"ג'ורג'" },
      { title:"ספירת מלאי — Blindspot", priority:"דחוף", status:"TODO", is_daily:false, assignee_id:georgeId, assignee_name:"ג'ורג'" },
      { title:"איזון SAP מול חברת כפתור — KAF32", priority:"גבוה", status:"TODO", is_daily:false, notes:"מקט KAF32 לא מיושר", assignee_id:zivId, assignee_name:"זיו" },
      { title:"עדכון מלאי אוזניות בלוטוס BT100", priority:"בינוני", status:"DONE", is_daily:false, assignee_id:georgeId, assignee_name:"ג'ורג'" },
      { title:"בדיקת ETA הזמנת Z4K מ-iStar", priority:"דחוף", status:"TODO", is_daily:false, notes:"ETA: 10 אפריל 2026", assignee_id:zivId, assignee_name:"זיו" },
      { title:"ארגון מחסן קדמי", priority:"בינוני", status:"DONE", is_daily:true, assignee_id:georgeId, assignee_name:"ג'ורג'" },
      { title:"קבלת משלוח iStar", priority:"גבוה", status:"TODO", is_daily:true, assignee_id:georgeId, assignee_name:"ג'ורג'" },
      { title:"עדכון מלאי במערכת", priority:"בינוני", status:"TODO", is_daily:true, assignee_id:georgeId, assignee_name:"ג'ורג'" },
    ];

    for (const t of tasksData) {
      await supabaseAdmin.from("tasks").insert(t);
    }

    return new Response(
      JSON.stringify({ success: true, userIds }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
