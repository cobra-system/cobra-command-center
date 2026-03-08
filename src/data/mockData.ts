// Mock data for COBRA.IO management system
// Will be replaced with Lovable Cloud (Supabase) later

export type Role = "MANAGER" | "WAREHOUSE_MANAGER" | "LOGISTICS" | "DRIVER";
export type OrderStatus = "PENDING" | "ORDERED" | "SHIPPED" | "ARRIVED" | "CANCELLED";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface User {
  id: string;
  name: string;
  email?: string;
  pin?: string;
  role: Role;
}

export interface Product {
  id: string;
  category: string;
  division?: string;
  name: string;
  description?: string;
  sku: string;
  productType: string;
  supplier?: string;
  supplierOrigin?: string;
  shipping?: string;
  purchasePrice?: number;
  monthlySales?: number;
  monthlyOrder?: number;
  salePrice?: number;
  stockQty: number;
  incomingQty: number;
  notes?: string;
  components?: ProductComponent[];
}

export interface ProductComponent {
  id: string;
  name: string;
  sku?: string;
  supplier?: string;
  origin?: string;
  stockQty?: number;
  price?: number;
  notes?: string;
}

export interface Supplier {
  id: string;
  contactName: string;
  company: string;
  email?: string;
  phone?: string;
  role?: string;
  country?: string;
  products?: string;
  notes?: string;
}

export interface Order {
  id: string;
  priority: Priority;
  supplierId?: string;
  supplierName?: string;
  shipping?: string;
  status: OrderStatus;
  orderDate?: string;
  paymentDate?: string;
  etd?: string;
  eta?: string;
  totalPrice?: number;
  contactName?: string;
  notes?: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string;
  name: string;
  qty: number;
  price?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  startDate?: string;
  milestone?: string;
  deliverable?: string;
  notes?: string;
  isDaily: boolean;
}

// ─── Users ───
export const users: User[] = [
  { id: "u1", name: "מנהל", email: "admin@cobra.io", role: "MANAGER" },
  { id: "u2", name: "ג'ורג'", pin: "1111", role: "WAREHOUSE_MANAGER" },
  { id: "u3", name: "זיו", pin: "2222", role: "LOGISTICS" },
];

// ─── Products ───
export const products: Product[] = [
  { id:"p1", category:"מיגון ואיתור", division:"AWCAS", name:"PROOF Z-4K", description:"מערכת צילום וניטור", sku:"z4k", productType:"מוגמר", supplier:"iStarVideo", supplierOrigin:"סין", shipping:"ימי + אווירי", purchasePrice:95, monthlySales:630, monthlyOrder:1600, stockQty:1600, incomingQty:1600 },
  { id:"p2", category:"מיגון ואיתור", division:"AWCAS", name:"S400", description:"מערכת צילום וניטור", sku:"s400", productType:"מוגמר", supplier:"iStarVideo", supplierOrigin:"סין", shipping:"ימי + אווירי", purchasePrice:83, monthlySales:105, monthlyOrder:400, stockQty:0, incomingQty:400 },
  { id:"p3", category:"מיגון ואיתור", division:"כפתור", name:"KAF32", description:"מערכת צילום וניטור", sku:"ks400", productType:"מוגמר", supplier:"iStarVideo", supplierOrigin:"סין", shipping:"ימי + אווירי", purchasePrice:73, monthlySales:0, monthlyOrder:50, stockQty:77, incomingQty:200, notes:"SAP לא מיושר מול חברת כפתור" },
  { id:"p4", category:"מיגון ואיתור", division:"כפתור", name:"COBRA Secret", description:"מערכת ניטור וניתוק", sku:"cobrasecrect", productType:"מורכב", supplierOrigin:"ישראל, סין", shipping:"ימי", monthlySales:50, monthlyOrder:50, stockQty:383, incomingQty:0, notes:"אין צפי הזמנות. אין צריכה." },
  { id:"p5", category:"מיגון ואיתור", division:"AWCAS", name:"COBRA Biometric", description:"מערכת התנעה ביומטרית", sku:"biofin", productType:"מורכב", supplier:"CR Team", supplierOrigin:"ישראל, סין", shipping:"אווירי", monthlySales:20, stockQty:0, incomingQty:0, notes:"לעדכן ספירה" },
  { id:"p6", category:"מיגון ואיתור", division:"AWCAS, דלק מוטורס, כפתור", name:"מערכת איתור Connect", description:"מערכת ניטור", sku:"5224", productType:"מוגמר", supplierOrigin:"ישראל", shipping:"יבשתי", monthlySales:200, monthlyOrder:300, stockQty:1008, incomingQty:0 },
  { id:"p7", category:"מולטימדיה", division:"AWCAS", name:"COBRA BackseatTV1", description:"מערכת מולטימדיה", sku:"cobratv1", productType:"מורכב", supplier:"ACESVision", supplierOrigin:"סין", shipping:"ימי", purchasePrice:232.9, monthlySales:3, stockQty:69, incomingQty:0 },
  { id:"p8", category:"מולטימדיה", division:"AWCAS", name:"COBRA BackseatTV2", description:"מערכת מולטימדיה", sku:"cobratv2", productType:"מורכב", supplier:"ACESVision", supplierOrigin:"סין", shipping:"ימי", purchasePrice:140, monthlySales:2, stockQty:0, incomingQty:0 },
  { id:"p9", category:"מולטימדיה", division:"קראסו, דלק מוטורס, לובינסקי", name:"מסכי אנדרואיד", description:"מערכת מולטימדיה", sku:"AHM1280A", productType:"מוגמר", supplier:"ACESVision", supplierOrigin:"סין", shipping:"ימי", purchasePrice:130, monthlySales:42, stockQty:63, incomingQty:0 },
  { id:"p10", category:"מולטימדיה", division:"קראסו, דלק מוטורס, לובינסקי", name:"אוזניות בלוטוס", description:"אוזניות בלוטוס", sku:"BT100", productType:"מוגמר", supplier:"ACESVision", supplierOrigin:"סין", shipping:"ימי", purchasePrice:7.5, monthlySales:65, stockQty:0, incomingQty:0, notes:"לעדכן ספירה" },
  { id:"p11", category:"בטיחות", division:"כפתור", name:"הכפתור", sku:"kaf4g_new", productType:"מוגמר", supplier:"CR Team", supplierOrigin:"ישראל", shipping:"יבשתי", purchasePrice:150, monthlyOrder:780, stockQty:194, incomingQty:500, notes:"צריך ליישר קו עם מחלקת הכפתור בנוגע למקטים" },
  { id:"p12", category:"בטיחות", division:"AWCAS, כפתור, קראסו", name:"Blindspot", sku:"m305", productType:"מוגמר", supplier:"AutoStar", supplierOrigin:"סין", shipping:"ימי", purchasePrice:84, monthlySales:105, monthlyOrder:100, stockQty:0, incomingQty:0, notes:"לעדכן ספירה" },
  { id:"p13", category:"בטיחות", division:"AWCAS", name:"AWACS CM 108", sku:"r8", productType:"מורכב", supplier:"A.I Matics", supplierOrigin:"דרום קוריאה", shipping:"ימי", purchasePrice:145, monthlySales:60, stockQty:6, incomingQty:500 },
  { id:"p14", category:"בטיחות", division:"דלק מוטורס", name:"Surround-Eye Parking Sensors", sku:"r294", productType:"מוגמר", supplier:"VodaPhone", supplierOrigin:"איטליה", shipping:"אווירי", purchasePrice:26, monthlySales:260, monthlyOrder:300, stockQty:242, incomingQty:0 },
  { id:"p15", category:"בטיחות", division:"דלק מוטורס", name:"COBRA Alert", sku:"4821", productType:"מוגמר", supplier:"VodaPhone", supplierOrigin:"איטליה", shipping:"אווירי", purchasePrice:39.5, monthlySales:530, monthlyOrder:775, stockQty:63, incomingQty:0 },
  { id:"p16", category:"נוחות וקישוריות", division:"כפתור", name:"COBRA Mobile Key", sku:"mkey-v05", productType:"מורכב", supplier:"CR Team", supplierOrigin:"ישראל, סין", shipping:"ימי", monthlySales:15, stockQty:226, incomingQty:0 },
  { id:"p17", category:"נוחות וקישוריות", division:"דלק מוטורס", name:"פותח תא מטען", sku:"tgcx5", productType:"מוגמר", supplier:"vehicleTech", supplierOrigin:"סין", shipping:"ימי + אווירי", purchasePrice:230, monthlySales:37, monthlyOrder:50, stockQty:190, incomingQty:50, notes:"כרגע אין צפי הזמנות מדלק מוטורס" },
  { id:"p18", category:"נוחות וקישוריות", division:"לובינסקי", name:"פותח מצלמה אחורית לברלינגו", sku:"31217", productType:"מוגמר", supplier:"BOW", supplierOrigin:"סין", shipping:"אווירי", purchasePrice:86, monthlySales:90, monthlyOrder:100, stockQty:162, incomingQty:0 },
  { id:"p19", category:"בית", division:"Doore", name:"Doore", sku:"doorexr-full", productType:"מורכב", supplierOrigin:"ישראל, סין", shipping:"ימי + אווירי", monthlySales:60, stockQty:169, incomingQty:0 },
];

// ─── Suppliers ───
export const suppliers: Supplier[] = [
  { id:"s1", contactName:"MAIRIA / Carolyn", company:"iStar Video", email:"maria@istarvideo.com", country:"חול", products:"PROOF Z-4K, S400, KAF32, Doore Doorbell" },
  { id:"s2", contactName:"Simon", company:"ACESVision", email:"sales@acesvision.com", country:"חול", products:"BackseatTV1, BackseatTV2, מסכי אנדרואיד" },
  { id:"s3", contactName:"Denver", company:"BOW", email:"denverzheng@hotmail.com", country:"חול", products:"פותח מצלמה אחורית לברלינגו" },
  { id:"s4", contactName:"Winni Wu", company:"GROW", email:"winni@hzgrow.com", country:"חול", products:"סורק טביעות אצבע לביומטרי" },
  { id:"s5", contactName:"Lois", company:"Kaier", email:"sales8@szkaier.com", country:"חול", products:"מערכות מולטימדיה" },
  { id:"s6", contactName:"ADA", company:"LOWC", email:"ada@lowctech.com", country:"חול", products:"סוללות" },
  { id:"s7", contactName:"Jenny", company:"RootRust", email:"jenny@rootrust.com", country:"חול", products:"דונגלים, נתבים" },
  { id:"s8", contactName:"Ivy", company:"SwitchBot WOAN", email:"ivy@switch-bot.com", country:"חול", products:"Doore Ultra" },
  { id:"s9", contactName:"John", company:"VehicleTech", email:"john@vehicle-tech.net", country:"חול", products:"פותח תא מטען" },
  { id:"s10", contactName:"Brikena / Federica", company:"Vodafone Automotive", email:"brikena.hamataj@vodafone.com", country:"חול", products:"COBRA Alert, Parking Sensors" },
  { id:"s11", contactName:"Emma", company:"AutoStar / Just Supply", email:"emma@auto-star.com.cn", country:"חול", products:"Blindspot" },
  { id:"s12", contactName:"Neil", company:"A.I. Matics", email:"neil@aimatics.ai", country:"חול", products:"AWACS CM108" },
  { id:"s13", contactName:"Zoe", company:"TS Prototypes", email:"sales9@tsprototypes.com", country:"חול", products:"פלסטיקה לביומטרי" },
  { id:"s14", contactName:"Nataya", company:"AUTHOR-ALARM", email:"vankova@author-alarm.com", country:"חול", products:"IGLA100, IGLA200, IGLA230" },
  { id:"s15", contactName:"Pancras Qiu", company:"Kunshan RCD Electronics", email:"sales16@ksrcd.com", country:"חול", products:"" },
  { id:"s16", contactName:"Florian", company:"KUDA", email:"florian.kuhlmann@kuda-phonebase.de", country:"חול", products:"" },
  { id:"s17", contactName:"Wendy", company:"HYF / Herofun-Bio", email:"sales07@herofun-bio.com", country:"חול", products:"" },
  { id:"s18", contactName:"Cari", company:"Topfoison", email:"cari.huang@topfoison.com", country:"חול", products:"תצוגות" },
  { id:"s19", contactName:"Jenny", company:"Fastline PCB", email:"jenny@fastlinepcb.com", country:"חול", products:"PCB" },
  { id:"s20", contactName:"אופיר", company:"ניפון", phone:"054-2315566", email:"udi.nippon@gmail.com", country:"ישראל", products:"מולטימדיות" },
  { id:"s21", contactName:"ישראל", company:"ספטרוטק", phone:"0522260438", country:"ישראל", products:"קודניות" },
  { id:"s22", contactName:"אריאל", company:"ERM", phone:"0545727969", email:"ariel@erm.co.il", country:"ישראל", products:"מרים, קודניות" },
  { id:"s23", contactName:"ברוך", company:"חיווט נאה", phone:"0504287855", country:"ישראל", products:"צמות" },
  { id:"s24", contactName:"רועי", company:"דרור כלי עבודה", phone:"0545900107", email:"office@dror-tools.co.il", country:"ישראל", products:"כלי עבודה" },
  { id:"s25", contactName:"גילי", company:"MTS", phone:"0502931497", country:"ישראל", products:"בגדים" },
  { id:"s26", contactName:"יואב", company:"קונטקט ליין", phone:"0544237237", country:"ישראל", products:"מצלמות רוורס, מסכים, חיישנים" },
  { id:"s27", contactName:"יניב", company:"אדי מערכות", phone:"03-9629296", email:"yaniv@adi-system.co.il", country:"ישראל", products:"מצלמות, סאבופר" },
];

// ─── Orders ───
export const orders: Order[] = [
  { id:"o1", priority:"P0", supplierName:"iStar", shipping:"ימי", status:"SHIPPED", eta:"2026-04-10", items:[{ id:"oi1", orderId:"o1", name:"PROOF Z-4K", qty:1600 }] },
  { id:"o2", priority:"P1", supplierName:"iStar", shipping:"ימי", status:"SHIPPED", items:[{ id:"oi2", orderId:"o2", name:"S400", qty:400 }] },
  { id:"o3", priority:"P2", supplierName:"SwitchBot", status:"ORDERED", items:[{ id:"oi3", orderId:"o3", name:"Doore Ultra", qty:350 }] },
  { id:"o4", priority:"P3", supplierName:"iStar", status:"ORDERED", items:[{ id:"oi4", orderId:"o4", name:"Doore Doorbell", qty:1000 }] },
];

// ─── Tasks ───
export const tasks: Task[] = [
  { id:"t1", title:"ספירת מלאי — COBRA Biometric", priority:"P0", status:"TODO", isDaily:false, notes:"ספירה ואיפוס מלאי", assigneeId:"u2", assigneeName:"ג'ורג'" },
  { id:"t2", title:"ספירת מלאי — COBRA TV", priority:"P0", status:"TODO", isDaily:false, assigneeId:"u2", assigneeName:"ג'ורג'" },
  { id:"t3", title:"ספירת מלאי — הכפתור", priority:"P0", status:"IN_PROGRESS", isDaily:false, assigneeId:"u2", assigneeName:"ג'ורג'" },
  { id:"t4", title:"ספירת מלאי — Blindspot", priority:"P0", status:"TODO", isDaily:false, assigneeId:"u2", assigneeName:"ג'ורג'" },
  { id:"t5", title:"איזון SAP מול חברת כפתור — KAF32", priority:"P1", status:"TODO", isDaily:false, notes:"מקט KAF32 לא מיושר", assigneeId:"u3", assigneeName:"זיו" },
  { id:"t6", title:"עדכון מלאי אוזניות בלוטוס BT100", priority:"P2", status:"DONE", isDaily:false, assigneeId:"u2", assigneeName:"ג'ורג'" },
  { id:"t7", title:"בדיקת ETA הזמנת Z4K מ-iStar", priority:"P0", status:"TODO", isDaily:false, notes:"ETA: 10 אפריל 2026", assigneeId:"u3", assigneeName:"זיו" },
  { id:"t8", title:"ארגון מחסן קדמי", priority:"P2", status:"DONE", isDaily:true, assigneeId:"u2", assigneeName:"ג'ורג'" },
  { id:"t9", title:"קבלת משלוח iStar", priority:"P1", status:"TODO", isDaily:true, assigneeId:"u2", assigneeName:"ג'ורג'" },
  { id:"t10", title:"עדכון מלאי במערכת", priority:"P2", status:"TODO", isDaily:true, assigneeId:"u2", assigneeName:"ג'ורג'" },
];

// ─── Helpers ───
export const priorityLabel: Record<Priority, string> = { P0: "דחוף", P1: "גבוה", P2: "רגיל", P3: "נמוך" };
export const statusLabel: Record<OrderStatus, string> = { PENDING: "ממתין", ORDERED: "הוזמן", SHIPPED: "נשלח", ARRIVED: "הגיע", CANCELLED: "בוטל" };
export const taskStatusLabel: Record<TaskStatus, string> = { TODO: "לביצוע", IN_PROGRESS: "בביצוע", DONE: "הושלם", BLOCKED: "חסום" };
export const roleLabel: Record<Role, string> = { MANAGER: "מנהל", WAREHOUSE_MANAGER: "מנהל מחסן", LOGISTICS: "לוגיסטיקה", DRIVER: "נהג" };

export const categories = ["הכל", "מיגון ואיתור", "מולטימדיה", "בטיחות", "נוחות וקישוריות", "בית"];
