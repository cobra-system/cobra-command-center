import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { applyMigrations } from "@/lib/applyMigrations";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { MODULES, getFullPermissionsForManager, type PermissionLevel, type RolePermissions } from "@/lib/permissions";

// Re-export types for compatibility
export type Role = "MANAGER" | "WAREHOUSE_MANAGER" | "LOGISTICS" | "DRIVER";
export type OrderStatus = "PENDING" | "ORDERED" | "SHIPPED" | "ARRIVED" | "CANCELLED";
export type Priority = "דחוף" | "גבוה" | "בינוני" | "נמוך";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface Profile {
  id: string;
  name: string;
  role: Role;
  role_definition_id?: string | null;
}

export interface Product {
  id: string;
  category: string;
  division?: string | null;
  name: string;
  description?: string | null;
  sku: string;
  product_type: string;
  supplier?: string | null;
  supplier_id?: string | null;
  supplier_origin?: string | null;
  shipping?: string | null;
  purchase_price?: number | null;
  monthly_sales?: number | null;
  monthly_order?: number | null;
  sale_price?: number | null;
  stock_qty: number;
  incoming_qty: number;
  notes?: string | null;
  components?: ProductComponent[];
  reorder_point?: number | null;
  lead_time_days?: number | null;
  monthly_sales_avg?: number | null;
  end_product_url?: string | null;
  end_product_image?: string | null;
}

export interface ProductComponent {
  id: string;
  product_id: string;
  name: string;
  sku?: string | null;
  supplier?: string | null;
  origin?: string | null;
  stock_qty?: number | null;
  price?: number | null;
  notes?: string | null;
}

export interface SupplierContact {
  id: string;
  supplier_id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary: boolean;
}

export interface Supplier {
  id: string;
  contact_name: string;
  company: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  country?: string | null;
  products?: string | null;
  notes?: string | null;
  lead_time_days?: number | null;
  payment_terms?: string | null;
  risk_level?: string | null;
  backup_supplier_id?: string | null;
  website?: string | null;
  contacts?: SupplierContact[];
}

export interface Order {
  id: string;
  priority: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  shipping?: string | null;
  status: string;
  order_date?: string | null;
  payment_date?: string | null;
  etd?: string | null;
  eta?: string | null;
  total_price?: number | null;
  contact_name?: string | null;
  notes?: string | null;
  tracking_number?: string | null;
  updated_at?: string | null;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  name: string;
  qty: number;
  price?: number | null;
}

export interface Goal {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  milestone?: string | null;
  deliverable?: string | null;
  notes?: string | null;
  is_daily: boolean;
  recurring_task_id?: string | null;
  depends_on?: string[] | null;
  // Recurring template fields (non-null when this task IS a recurring template)
  frequency?: string | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  days_before?: number | null;
  time_of_day?: string | null;
  is_active?: boolean | null;
  last_generated?: string | null;
  completed_at?: string | null;
  created_by?: string | null;
}

interface AuthState {
  currentUser: Profile | null;
  session: Session | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

export interface RoleDefinition {
  id: string;
  name: string;
  system_key: string | null;
}

export interface RolePermissionRecord {
  id: string;
  role: string;
  module_key: string;
  permission_level: PermissionLevel;
}

interface DataState {
  products: Product[];
  orders: Order[];
  tasks: Task[];
  goals: Goal[];
  suppliers: Supplier[];
  profiles: Profile[];
  roleDefinitions: RoleDefinition[];
  loading: boolean;
  refreshProducts: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshSuppliers: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  addTaskNote: (taskId: string, note: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  addOrder: (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => Promise<void>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  addTask: (task: Omit<Task, "id">) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  refreshGoals: () => Promise<void>;
  addGoal: (goal: Omit<Goal, "id">) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  addProduct: (product: Omit<Product, "id" | "components">, components?: Omit<ProductComponent, "id" | "product_id">[]) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addComponent: (component: Omit<ProductComponent, "id">) => Promise<void>;
  updateComponent: (id: string, updates: Partial<ProductComponent>) => Promise<void>;
  deleteComponent: (id: string) => Promise<void>;
  addProfile: (profile: { email: string; name: string; role: Role }) => Promise<void>;
  updateProfile: (id: string, updates: Partial<Profile>) => Promise<void>;
  resetDailyTasks: () => Promise<void>;
  createEmployee: (data: { name: string; role: Role; email: string; password: string; role_definition_id?: string }) => Promise<string | null>;
  addSupplier: (supplier: Omit<Supplier, "id">) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  refreshRoleDefinitions: () => Promise<void>;
  addRoleDefinition: (name: string) => Promise<void>;
  updateRoleDefinition: (id: string, name: string) => Promise<void>;
  deleteRoleDefinition: (id: string) => Promise<void>;
  rolePermissions: RolePermissionRecord[];
  currentUserPermissions: RolePermissions;
  refreshRolePermissions: () => Promise<void>;
  upsertRolePermission: (role: string, moduleKey: string, level: PermissionLevel) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const DataContext = createContext<DataState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be within DataProvider");
  return ctx;
}

const taskStatusLabel: Record<string, string> = { TODO: "לביצוע", IN_PROGRESS: "בביצוע", DONE: "הושלם", BLOCKED: "חסום" };

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Track own mutations to suppress self-notifications
  const ownMutationIds = useRef<Set<string>>(new Set());

  // Fetch profile for a user
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    return data as Profile | null;
  }, []);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(async () => {
          const profile = await fetchProfile(sess.user.id);
          setCurrentUser(profile);
          setAuthLoading(false);
        }, 0);
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      setSession(sess);
      if (sess?.user) {
        const profile = await fetchProfile(sess.user.id);
        setCurrentUser(profile);
      }
      setAuthLoading(false);

      // Apply any pending database migrations
      applyMigrations().catch(console.error);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Login with email/password
  const loginWithEmail = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);


  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  }, []);

  // Data fetchers
  const refreshProducts = useCallback(async () => {
    const { data: prods } = await supabase.from("products").select("*").order("category");
    if (prods) {
      const assembledIds = prods.filter(p => p.product_type === "מורכב").map(p => p.id);
      let compsMap: Record<string, ProductComponent[]> = {};
      if (assembledIds.length > 0) {
        const { data: comps } = await supabase.from("product_components").select("*").in("product_id", assembledIds);
        if (comps) {
          comps.forEach(c => {
            if (!compsMap[c.product_id]) compsMap[c.product_id] = [];
            compsMap[c.product_id].push(c as ProductComponent);
          });
        }
      }
      setProducts(prods.map(p => ({ ...p, components: compsMap[p.id] || [] })) as Product[]);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    const { data: ords } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (ords) {
      setOrders(ords.map(o => {
        const items = o.order_items || [];
        const calculatedTotal = items.reduce((sum, item) => {
          const itemTotal = (item.price || 0) * (item.qty || 0);
          return sum + itemTotal;
        }, 0);
        return { ...o, items, total_price: calculatedTotal };
      }) as unknown as Order[]);
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").neq("status", "TEMPLATE").order("created_at", { ascending: false });
    if (data) setTasks(data as Task[]);
  }, []);

  const refreshGoals = useCallback(async () => {
    const { data, error } = await supabase.from("goals").select("*").order("sort_order");
    if (error) {
      if (error.message?.includes("schema cache") || error.code === "42P01") {
        console.error("טבלת goals לא קיימת. יש להריץ את המיגרציה דרך Supabase SQL Editor.");
      }
      return;
    }
    if (data) setGoals(data as Goal[]);
  }, []);

  const refreshSuppliers = useCallback(async () => {
    const { data } = await supabase.from("suppliers").select("*").order("company");
    if (data) {
      // Fetch contacts for all suppliers
      const { data: contacts } = await supabase.from("supplier_contacts").select("*").order("is_primary", { ascending: false });
      const contactsMap: Record<string, SupplierContact[]> = {};
      if (contacts) {
        contacts.forEach((c: any) => {
          if (!contactsMap[c.supplier_id]) contactsMap[c.supplier_id] = [];
          contactsMap[c.supplier_id].push(c as SupplierContact);
        });
      }
      setSuppliers(data.map((s: any) => ({ ...s, contacts: contactsMap[s.id] || [] })) as Supplier[]);
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setProfiles(data as Profile[]);
  }, []);

  const refreshRoleDefinitions = useCallback(async () => {
    const { data } = await supabase.from("role_definitions").select("*").order("created_at");
    if (data) setRoleDefinitions(data as RoleDefinition[]);
  }, []);

  const refreshRolePermissions = useCallback(async () => {
    const { data } = await supabase.from("role_permissions").select("*");
    if (data) setRolePermissions(data as RolePermissionRecord[]);
  }, []);

  const upsertRolePermission = useCallback(async (role: string, moduleKey: string, level: PermissionLevel) => {
    try {
      const { error } = await supabase.from("role_permissions").upsert(
        { role, module_key: moduleKey, permission_level: level } as any,
        { onConflict: "role,module_key" }
      );
      if (error) throw error;
      await refreshRolePermissions();
    } catch (err) {
      toast.error("שגיאה בעדכון הרשאות: " + ((err as any)?.message || "נסה שוב"));
    }
  }, [refreshRolePermissions]);

  // Fetch data when authenticated
  useEffect(() => {
    if (!session) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    Promise.all([
      refreshProducts(),
      refreshOrders(),
      refreshTasks(),
      refreshGoals(),
      refreshSuppliers(),
      refreshProfiles(),
      refreshRoleDefinitions(),
      refreshRolePermissions(),
    ]).finally(() => setDataLoading(false));
  }, [session, refreshProducts, refreshOrders, refreshTasks, refreshGoals, refreshSuppliers, refreshProfiles, refreshRoleDefinitions, refreshRolePermissions]);

  // Realtime subscription for tasks
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          const taskId = (payload.new as any)?.id || (payload.old as any)?.id;
          
          // Skip notifications for own mutations
          if (ownMutationIds.current.has(taskId)) {
            ownMutationIds.current.delete(taskId);
            return;
          }

          if (payload.eventType === 'UPDATE') {
            const newTask = payload.new as Task;
            const oldTask = payload.old as any;
            
            setTasks(prev => prev.map(t => t.id === newTask.id ? newTask : t));

            // Show notification for status changes
            if (oldTask.status && oldTask.status !== newTask.status) {
              const statusText = taskStatusLabel[newTask.status] || newTask.status;
              toast.info(`📋 "${newTask.title}" → ${statusText}`, {
                description: newTask.assignee_name ? `עודכן ע״י ${newTask.assignee_name}` : undefined,
              });
            }
          } else if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task;
            setTasks(prev => [newTask, ...prev]);
            toast.info(`📋 משימה חדשה: "${newTask.title}"`);
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setTasks(prev => prev.filter(t => t.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // Mutations
  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    ownMutationIds.current.add(taskId);
    const prevTasks = tasks;
    const completedAt = status === "DONE" ? new Date().toISOString() : null;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, completed_at: completedAt } : t));
    const { error } = await supabase.from("tasks").update({ status, completed_at: completedAt }).eq("id", taskId);
    if (error) {
      setTasks(prevTasks);
      toast.error("שגיאה בעדכון משימה: " + (error.message || "נסה שוב"));
    }
  }, [tasks]);

  const addTaskNote = useCallback(async (taskId: string, note: string) => {
    ownMutationIds.current.add(taskId);
    const prevTasks = tasks;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: note } : t));
    const { error } = await supabase.from("tasks").update({ notes: note }).eq("id", taskId);
    if (error) {
      setTasks(prevTasks);
      toast.error("שגיאה בשמירת הערה: " + (error.message || "נסה שוב"));
    }
  }, [tasks]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const prevOrders = orders;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) {
      setOrders(prevOrders);
      toast.error("שגיאה בעדכון סטטוס הזמנה: " + (error.message || "נסה שוב"));
    }
  }, [orders]);

  const addOrder = useCallback(async (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => {
    try {
      const { items, ...orderData } = order;
      const { data: newOrder, error: orderError } = await supabase.from("orders").insert(orderData).select("id").single();
      if (orderError) {
        toast.error("שגיאה ביצירת הזמנה: " + (orderError.message || "נסה שוב"));
        return;
      }
      if (newOrder) {
        const orderItems = items.map(item => ({ ...item, order_id: newOrder.id }));
        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
        if (itemsError) {
          toast.error("שגיאה בהוספת פריטים: " + (itemsError.message || "נסה שוב"));
          return;
        }
        // Auto-start procurement workflow — use different template for Israeli suppliers
        let workflowCategory = "procurement";
        if (order.supplier_id) {
          const { data: supplierData } = await supabase
            .from("suppliers")
            .select("country")
            .eq("id", order.supplier_id)
            .maybeSingle();
          if (supplierData?.country === "ישראל") {
            workflowCategory = "procurement_israel";
          }
        }
        const { data: tpl } = await supabase.from("workflow_templates").select("id").eq("category", workflowCategory).limit(1).maybeSingle();
        if (tpl) {
          await supabase.from("workflow_instances").insert({ template_id: tpl.id, order_id: newOrder.id });
        }
        await refreshOrders();
        toast.success("הזמנה נוצרה בהצלחה");
      }
    } catch (err) {
      toast.error("שגיאה בלתי צפויה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshOrders]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    try {
      const { items, ...dbUpdates } = updates as any;
      const { error } = await supabase.from("orders").update(dbUpdates).eq("id", id);
      if (error) {
        toast.error("שגיאה בעדכון הזמנה: " + (error.message || "נסה שוב"));
        return;
      }
      await refreshOrders();
      toast.success("הזמנה עודכנה בהצלחה");
    } catch (err) {
      toast.error("שגיאה בלתי צפויה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    try {
      // Delete workflow step logs first (referenced by workflow_instances)
      const { data: instances } = await supabase.from("workflow_instances").select("id").eq("order_id", id);
      if (instances && instances.length > 0) {
        const instanceIds = instances.map((i: any) => i.id);
        await supabase.from("workflow_step_logs").delete().in("instance_id", instanceIds);
        await supabase.from("workflow_instances").delete().eq("order_id", id);
      }
      const { error: itemsError } = await supabase.from("order_items").delete().eq("order_id", id);
      if (itemsError) throw itemsError;
      const { error: orderError } = await supabase.from("orders").delete().eq("id", id);
      if (orderError) throw orderError;
      await refreshOrders();
      toast.success("הזמנה נמחקה בהצלחה");
    } catch (err) {
      toast.error("שגיאה במחיקת הזמנה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshOrders]);

  const addTask = useCallback(async (task: Omit<Task, "id">) => {
    try {
      const { error } = await supabase.from("tasks").insert(task);
      if (error) throw error;
      await refreshTasks();
      toast.success("משימה נוצרה בהצלחה");
    } catch (err) {
      toast.error("שגיאה ביצירת משימה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshTasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    ownMutationIds.current.add(id);
    const prevTasks = tasks;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) {
      setTasks(prevTasks);
      toast.error("שגיאה בעדכון משימה: " + (error.message || "נסה שוב"));
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    ownMutationIds.current.add(id);
    const prevTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      setTasks(prevTasks);
      toast.error("שגיאה במחיקת משימה: " + (error.message || "נסה שוב"));
      throw error;
    }
  }, [tasks]);

  const addGoal = useCallback(async (goal: Omit<Goal, "id">) => {
    const { error } = await supabase.from("goals").insert(goal);
    if (error) {
      if (error.message?.includes("schema cache") || error.code === "42P01") {
        toast.error("טבלת מטרות-על לא נמצאה. יש להריץ את המיגרציה דרך Supabase SQL Editor — ראה קונסול לפרטים.");
      } else {
        toast.error("שגיאה ביצירת מטרה: " + (error.message || "נסה שוב"));
      }
      return;
    }
    await refreshGoals();
    toast.success("מטרה נוספה");
  }, [refreshGoals]);

  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    const prev = goals;
    setGoals(g => g.map(item => item.id === id ? { ...item, ...updates } : item));
    const { error } = await supabase.from("goals").update(updates).eq("id", id);
    if (error) {
      setGoals(prev);
      toast.error("שגיאה בעדכון מטרה: " + (error.message || "נסה שוב"));
    }
  }, [goals]);

  const deleteGoal = useCallback(async (id: string) => {
    const prev = goals;
    setGoals(g => g.filter(item => item.id !== id));
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) {
      setGoals(prev);
      toast.error("שגיאה במחיקת מטרה: " + (error.message || "נסה שוב"));
    }
  }, [goals]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    try {
      const { components, supplier_id, ...dbUpdates } = updates as any;
      const { error } = await supabase.from("products").update(dbUpdates).eq("id", id);
      if (error) throw error;
      // Sync stock with main center inventory
      if (dbUpdates.stock_qty !== undefined) {
        const { data: mainCenter } = await supabase.from("distribution_centers").select("id").eq("is_main", true).maybeSingle();
        if (mainCenter) {
          await supabase.from("center_inventory").upsert(
            { center_id: mainCenter.id, product_id: id, quantity: dbUpdates.stock_qty } as any,
            { onConflict: "center_id,product_id" }
          );
        }
      }
      await refreshProducts();
      toast.success("מוצר עודכן בהצלחה");
    } catch (err) {
      toast.error("שגיאה בעדכון מוצר: " + (err instanceof Error ? err.message : "נסה שוב"));
      throw err;
    }
  }, [refreshProducts]);

  const addProduct = useCallback(async (product: Omit<Product, "id" | "components">, components?: Omit<ProductComponent, "id" | "product_id">[]) => {
    try {
      const { supplier_id, ...productData } = product as any;
      const { data: newProd, error: prodError } = await supabase.from("products").insert(productData).select("id").single();
      if (prodError) throw prodError;
      if (newProd && components && components.length > 0) {
        const { error: compError } = await supabase.from("product_components").insert(components.map(c => ({ ...c, product_id: newProd.id })));
        if (compError) throw compError;
      }
      await refreshProducts();
      toast.success("מוצר נוצר בהצלחה");
    } catch (err) {
      toast.error("שגיאה ביצירת מוצר: " + (err instanceof Error ? err.message : "נסה שוב"));
      throw err;
    }
  }, [refreshProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const { error: compError } = await supabase.from("product_components").delete().eq("product_id", id);
      if (compError) throw compError;
      const { error: prodError } = await supabase.from("products").delete().eq("id", id);
      if (prodError) throw prodError;
      await refreshProducts();
      toast.success("מוצר נמחק בהצלחה");
    } catch (err) {
      toast.error("שגיאה במחיקת מוצר: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshProducts]);

  const addComponent = useCallback(async (component: Omit<ProductComponent, "id">) => {
    try {
      const { error } = await supabase.from("product_components").insert(component);
      if (error) throw error;
      await refreshProducts();
      toast.success("רכיב נוסף בהצלחה");
    } catch (err) {
      toast.error("שגיאה בהוספת רכיב: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshProducts]);

  const updateComponent = useCallback(async (id: string, updates: Partial<ProductComponent>) => {
    try {
      const { product_id, ...dbUpdates } = updates as any;
      const { error } = await supabase.from("product_components").update(dbUpdates).eq("id", id);
      if (error) throw error;
      await refreshProducts();
      toast.success("רכיב עודכן בהצלחה");
    } catch (err) {
      toast.error("שגיאה בעדכון רכיב: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshProducts]);

  const deleteComponent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("product_components").delete().eq("id", id);
      if (error) throw error;
      await refreshProducts();
      toast.success("רכיב נמחק בהצלחה");
    } catch (err) {
      toast.error("שגיאה במחיקת רכיב: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshProducts]);

  const addProfile = useCallback(async (profile: { email: string; name: string; role: Role }) => {
    try {
      const res = await supabase.functions.invoke("create-employee", {
        body: { email: profile.email, name: profile.name, role: profile.role },
      });
      if (res.error) throw new Error(res.error.message);
      await refreshProfiles();
      toast.success("עובד נוסף בהצלחה");
    } catch (err) {
      toast.error("שגיאה בהוספת עובד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshProfiles]);

  const updateProfile = useCallback(async (id: string, updates: Partial<Profile>) => {
    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
      await refreshProfiles();
      toast.success("פרופיל עודכן בהצלחה");
    } catch (err) {
      toast.error("שגיאה בעדכון פרופיל: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshProfiles]);

  const resetDailyTasks = useCallback(async () => {
    const dailyTasks = tasks.filter(t => t.is_daily && t.status !== "TODO");
    setTasks(prev => prev.map(t => t.is_daily ? { ...t, status: "TODO" } : t));
    for (const t of dailyTasks) {
      ownMutationIds.current.add(t.id);
      await supabase.from("tasks").update({ status: "TODO" }).eq("id", t.id);
    }
  }, [tasks]);

  const createEmployee = useCallback(async (data: { name: string; role: Role; email: string; password: string; role_definition_id?: string }): Promise<string | null> => {
    try {
      const url = `${SUPABASE_URL}/functions/v1/create-employee`;
      const sess = await supabase.auth.getSession();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${sess.data.session?.access_token}`,
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) return result.error || "שגיאה ביצירת עובד";
      await refreshProfiles();
      return null;
    } catch {
      return "שגיאה בחיבור לשרת";
    }
  }, [refreshProfiles]);

  const addSupplier = useCallback(async (supplier: Omit<Supplier, "id">) => {
    try {
      const { error } = await supabase.from("suppliers").insert(supplier as any);
      if (error) throw error;
      await refreshSuppliers();
      toast.success("ספק נוסף בהצלחה");
    } catch (err) {
      toast.error("שגיאה בהוספת ספק: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshSuppliers]);

  const updateSupplier = useCallback(async (id: string, updates: Partial<Supplier>) => {
    try {
      const { error } = await supabase.from("suppliers").update(updates as any).eq("id", id);
      if (error) throw error;
      await refreshSuppliers();
      toast.success("ספק עודכן בהצלחה");
    } catch (err) {
      toast.error("שגיאה בעדכון ספק: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshSuppliers]);

  const deleteSupplier = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      await refreshSuppliers();
      toast.success("ספק נמחק בהצלחה");
    } catch (err) {
      toast.error("שגיאה במחיקת ספק: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshSuppliers]);

  const addRoleDefinition = useCallback(async (name: string) => {
    try {
      const { error } = await supabase.from("role_definitions").insert({ name } as any);
      if (error) throw error;
      await refreshRoleDefinitions();
      toast.success("תפקיד נוסף בהצלחה");
    } catch (err) {
      toast.error("שגיאה בהוספת תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshRoleDefinitions]);

  const updateRoleDefinition = useCallback(async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("role_definitions").update({ name } as any).eq("id", id);
      if (error) throw error;
      await refreshRoleDefinitions();
      toast.success("תפקיד עודכן בהצלחה");
    } catch (err) {
      toast.error("שגיאה בעדכון תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshRoleDefinitions]);

  const deleteRoleDefinition = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("role_definitions").delete().eq("id", id);
      if (error) throw error;
      await refreshRoleDefinitions();
      toast.success("תפקיד נמחק בהצלחה");
    } catch (err) {
      toast.error("שגיאה במחיקת תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshRoleDefinitions]);

  const currentUserPermissions: RolePermissions = useMemo(() => {
    if (!currentUser || currentUser.role === "MANAGER") {
      return getFullPermissionsForManager();
    }
    // Determine the permission lookup key:
    // - If the user has a role_definition_id, find that definition and use system_key (for system roles)
    //   or the UUID (for custom roles) as the key stored in role_permissions.role
    // - Otherwise fall back to the profile's app_role value
    let effectiveRoleKey: string = currentUser.role;
    if (currentUser.role_definition_id) {
      const rd = roleDefinitions.find((r) => r.id === currentUser.role_definition_id);
      if (rd) effectiveRoleKey = rd.system_key ?? rd.id;
    }
    const perms: RolePermissions = {};
    for (const mod of MODULES) {
      const record = rolePermissions.find(
        (rp) => rp.role === effectiveRoleKey && rp.module_key === mod.key
      );
      perms[mod.key] = record?.permission_level ?? "none";
    }
    return perms;
  }, [currentUser, rolePermissions, roleDefinitions]);

  return (
    <AuthContext.Provider value={{ currentUser, session, loading: authLoading, loginWithEmail, logout }}>
      <DataContext.Provider value={{
        products,
        orders,
        tasks,
        goals,
        suppliers,
        profiles,
        loading: dataLoading,
        refreshProducts,
        refreshOrders,
        refreshTasks,
        refreshSuppliers,
        refreshProfiles,
        updateTaskStatus,
        addTaskNote,
        updateOrderStatus,
        addOrder,
        updateOrder,
        deleteOrder,
        addTask,
        updateTask,
        deleteTask,
        refreshGoals,
        addGoal,
        updateGoal,
        deleteGoal,
        updateProduct,
        addProduct,
        deleteProduct,
        addComponent,
        updateComponent,
        deleteComponent,
        addProfile,
        updateProfile,
        resetDailyTasks,
        createEmployee,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        roleDefinitions,
        refreshRoleDefinitions,
        addRoleDefinition,
        updateRoleDefinition,
        deleteRoleDefinition,
        rolePermissions,
        currentUserPermissions,
        refreshRolePermissions,
        upsertRolePermission,
      }}>
        {children}
      </DataContext.Provider>
    </AuthContext.Provider>
  );
}

// Helper constants
export const categories = ["הכל", "מיגון ואיתור", "מולטימדיה", "בטיחות", "נוחות וקישוריות", "בית"];
export const divisions = ["AWCAS", "דלק מוטורס", "קראסו (פריזבי)", "לובינסקי", "כפתור", "Doore", "מוסד Cobra"];
export const priorityLabel: Record<string, string> = { "דחוף": "דחוף", "גבוה": "גבוה", "בינוני": "בינוני", "נמוך": "נמוך" };
export const statusLabel: Record<string, string> = { PENDING: "ממתין", ORDERED: "הוזמן", SHIPPED: "נשלח", ARRIVED: "הגיע", CANCELLED: "בוטל" };
export { taskStatusLabel };
export const roleLabel: Record<string, string> = { MANAGER: "מנהל", WAREHOUSE_MANAGER: "מנהל מחסן", LOGISTICS: "לוגיסטיקה", DRIVER: "נהג" };
