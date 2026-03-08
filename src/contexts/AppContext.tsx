import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

// Re-export types for compatibility
export type Role = "MANAGER" | "WAREHOUSE_MANAGER" | "LOGISTICS" | "DRIVER";
export type OrderStatus = "PENDING" | "ORDERED" | "SHIPPED" | "ARRIVED" | "CANCELLED";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface Profile {
  id: string;
  name: string;
  role: Role;
  pin?: string | null;
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
}

interface AuthState {
  currentUser: Profile | null;
  session: Session | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<string | null>;
  loginWithPin: (pin: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

interface DataState {
  products: Product[];
  orders: Order[];
  tasks: Task[];
  suppliers: Supplier[];
  profiles: Profile[];
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
  addTask: (task: Omit<Task, "id">) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  addProfile: (profile: { email: string; name: string; role: Role; pin?: string }) => Promise<void>;
  updateProfile: (id: string, updates: Partial<Profile>) => Promise<void>;
  resetDailyTasks: () => Promise<void>;
  createEmployee: (data: { name: string; role: Role; pin: string }) => Promise<string | null>;
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Login with email/password
  const loginWithEmail = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  // Login with PIN (via edge function)
  const loginWithPin = useCallback(async (pin: string): Promise<string | null> => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/login-with-pin`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ pin }),
      });

      const result = await response.json();
      if (!response.ok) return result.error || "שגיאה בכניסה";

      const { error } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (error) return error.message;
      return null;
    } catch {
      return "שגיאה בחיבור לשרת";
    }
  }, []);

  // Login with Google
  const loginWithGoogle = useCallback(async () => {
    const { lovable } = await import("@/integrations/lovable/index");
    await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
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
      setOrders(ords.map(o => ({ ...o, items: o.order_items || [] })) as unknown as Order[]);
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (data) setTasks(data as Task[]);
  }, []);

  const refreshSuppliers = useCallback(async () => {
    const { data } = await supabase.from("suppliers").select("*").order("company");
    if (data) setSuppliers(data as Supplier[]);
  }, []);

  const refreshProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setProfiles(data as Profile[]);
  }, []);

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
      refreshSuppliers(),
      refreshProfiles(),
    ]).finally(() => setDataLoading(false));
  }, [session, refreshProducts, refreshOrders, refreshTasks, refreshSuppliers, refreshProfiles]);

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
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await supabase.from("tasks").update({ status }).eq("id", taskId);
  }, []);

  const addTaskNote = useCallback(async (taskId: string, note: string) => {
    ownMutationIds.current.add(taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: note } : t));
    await supabase.from("tasks").update({ notes: note }).eq("id", taskId);
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    await supabase.from("orders").update({ status }).eq("id", orderId);
  }, []);

  const addOrder = useCallback(async (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => {
    const { items, ...orderData } = order;
    const { data: newOrder } = await supabase.from("orders").insert(orderData).select("id").single();
    if (newOrder) {
      const orderItems = items.map(item => ({ ...item, order_id: newOrder.id }));
      await supabase.from("order_items").insert(orderItems);
      await refreshOrders();
    }
  }, [refreshOrders]);

  const addTask = useCallback(async (task: Omit<Task, "id">) => {
    await supabase.from("tasks").insert(task);
    await refreshTasks();
  }, [refreshTasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    ownMutationIds.current.add(id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    await supabase.from("tasks").update(updates).eq("id", id);
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    ownMutationIds.current.add(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const { components, ...dbUpdates } = updates as any;
    await supabase.from("products").update(dbUpdates).eq("id", id);
    await refreshProducts();
  }, [refreshProducts]);

  const addProfile = useCallback(async (profile: { email: string; name: string; role: Role; pin?: string }) => {
    await refreshProfiles();
  }, [refreshProfiles]);

  const updateProfile = useCallback(async (id: string, updates: Partial<Profile>) => {
    await supabase.from("profiles").update(updates).eq("id", id);
    await refreshProfiles();
  }, [refreshProfiles]);

  const resetDailyTasks = useCallback(async () => {
    const dailyTasks = tasks.filter(t => t.is_daily && t.status !== "TODO");
    setTasks(prev => prev.map(t => t.is_daily ? { ...t, status: "TODO" } : t));
    for (const t of dailyTasks) {
      ownMutationIds.current.add(t.id);
      await supabase.from("tasks").update({ status: "TODO" }).eq("id", t.id);
    }
  }, [tasks]);

  const createEmployee = useCallback(async (data: { name: string; role: Role; pin: string }): Promise<string | null> => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/create-employee`;
      const sess = await supabase.auth.getSession();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

  return (
    <AuthContext.Provider value={{ currentUser, session, loading: authLoading, loginWithEmail, loginWithPin, loginWithGoogle, logout }}>
      <DataContext.Provider value={{
        products,
        orders,
        tasks,
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
        addTask,
        updateTask,
        deleteTask,
        updateProduct,
        addProfile,
        updateProfile,
        resetDailyTasks,
        createEmployee,
      }}>
        {children}
      </DataContext.Provider>
    </AuthContext.Provider>
  );
}

// Helper constants
export const categories = ["הכל", "מיגון ואיתור", "מולטימדיה", "בטיחות", "נוחות וקישוריות", "בית"];
export const priorityLabel: Record<string, string> = { P0: "דחוף", P1: "גבוה", P2: "רגיל", P3: "נמוך" };
export const statusLabel: Record<string, string> = { PENDING: "ממתין", ORDERED: "הוזמן", SHIPPED: "נשלח", ARRIVED: "הגיע", CANCELLED: "בוטל" };
export { taskStatusLabel };
export const roleLabel: Record<string, string> = { MANAGER: "מנהל", WAREHOUSE_MANAGER: "מנהל מחסן", LOGISTICS: "לוגיסטיקה", DRIVER: "נהג" };
