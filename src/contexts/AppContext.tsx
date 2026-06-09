/**
 * AppContext — Backward-compatible barrel that composes all domain-specific contexts.
 *
 * All 60+ consuming files continue to use `useAuth()` and `useData()` unchanged.
 * New code can import domain-specific hooks directly (useProducts, useOrders, etc.).
 */
import React, { useEffect, useState, type ReactNode } from "react";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AuthProvider, useAuth as useAuthDirect } from "@/contexts/AuthContext";
import { ProductsProvider, useProducts } from "@/contexts/ProductsContext";
import { OrdersProvider, useOrders } from "@/contexts/OrdersContext";
import { TasksProvider, useTasks } from "@/contexts/TasksContext";
import { GoalsProvider, useGoals } from "@/contexts/GoalsContext";
import { SuppliersProvider, useSuppliers } from "@/contexts/SuppliersContext";
import { RolesProvider, useRoles } from "@/contexts/RolesContext";
import { CategoriesProvider, useProductCategories } from "@/contexts/CategoriesContext";

// Re-export types for backward compatibility
export type { Role, OrderStatus, Priority, TaskStatus } from "@/contexts/types";
export type { Profile, Product, ProductComponent, SupplierContact, Supplier } from "@/contexts/types";
export type { Order, OrderItem, Goal, Task } from "@/contexts/types";
export type { RoleDefinition, RolePermissionRecord } from "@/contexts/types";

// Re-export currency hook and type
export { useCurrency } from "@/contexts/CurrencyContext";
export type { DisplayCurrency } from "@/contexts/CurrencyContext";
// Re-export domain hooks for direct use
export { useAuth } from "@/contexts/AuthContext";
export { useProducts } from "@/contexts/ProductsContext";
export { useOrders } from "@/contexts/OrdersContext";
export { useTasks } from "@/contexts/TasksContext";
export { useGoals } from "@/contexts/GoalsContext";
export { useSuppliers } from "@/contexts/SuppliersContext";
export { useRoles } from "@/contexts/RolesContext";
export { useProductCategories } from "@/contexts/CategoriesContext";

// Helper constants
export const categories = ["הכל", "מיגון ואיתור", "מולטימדיה", "בטיחות", "נוחות וקישוריות", "בית"];
export { DIVISIONS as divisions } from "@/components/equipment/constants";
export const priorityLabel: Record<string, string> = { "דחוף": "דחוף", "גבוה": "גבוה", "בינוני": "בינוני", "נמוך": "נמוך" };
export const statusLabel: Record<string, string> = { PENDING: "ממתין", ORDERED: "הוזמן", SHIPPED: "נשלח", ARRIVED_PORT: "הגיע לנמל", CUSTOMS_CLEARANCE: "שחרור מכס", DELIVERED: "נמסר", ARRIVED: "הגיע", CANCELLED: "בוטל" };
export const taskStatusLabel: Record<string, string> = { TODO: "לביצוע", IN_PROGRESS: "בביצוע", DONE: "הושלם", BLOCKED: "חסום" };
export const roleLabel: Record<string, string> = { MANAGER: "מנהל", WAREHOUSE_MANAGER: "מנהל מחסן", LOGISTICS: "לוגיסטיקה", DRIVER: "נהג" };

/**
 * Backward-compatible `useData()` hook.
 * Aggregates all domain contexts into a single object matching the original DataState interface.
 */
export function useData() {
  const { products, refreshProducts, updateProduct, addProduct, deleteProduct, addComponent, updateComponent, deleteComponent } = useProducts();
  const { orders, refreshOrders, updateOrderStatus, addOrder, updateOrder, deleteOrder } = useOrders();
  const { tasks, refreshTasks, updateTaskStatus, addTaskNote, addTask, updateTask, deleteTask, resetDailyTasks } = useTasks();
  const { goals, refreshGoals, addGoal, updateGoal, deleteGoal } = useGoals();
  const { suppliers, refreshSuppliers, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { profiles, roleDefinitions, rolePermissions, currentUserPermissions, refreshProfiles, refreshRoleDefinitions, refreshRolePermissions, addProfile, updateProfile, createEmployee, addRoleDefinition, updateRoleDefinition, deleteRoleDefinition, upsertRolePermission } = useRoles();

  return {
    // State
    products, orders, tasks, goals, suppliers, profiles, roleDefinitions, rolePermissions,
    loading: false,
    // Refresh
    refreshProducts, refreshOrders, refreshTasks, refreshGoals, refreshSuppliers, refreshProfiles, refreshRoleDefinitions, refreshRolePermissions,
    // Product mutations
    updateProduct, addProduct, deleteProduct, addComponent, updateComponent, deleteComponent,
    // Order mutations
    updateOrderStatus, addOrder, updateOrder, deleteOrder,
    // Task mutations
    updateTaskStatus, addTaskNote, addTask, updateTask, deleteTask, resetDailyTasks,
    // Goal mutations
    addGoal, updateGoal, deleteGoal,
    // Supplier mutations
    addSupplier, updateSupplier, deleteSupplier,
    // Profile/Employee mutations
    addProfile, updateProfile, createEmployee,
    // Role mutations
    addRoleDefinition, updateRoleDefinition, deleteRoleDefinition,
    upsertRolePermission, currentUserPermissions,
  };
}

/**
 * DataLoader — fetches all data on auth and passes session to TasksProvider.
 */
function DataLoader({ children }: { children: ReactNode }) {
  const { session, currentUser } = useAuthDirect();
  const { refreshProducts } = useProducts();
  const { refreshOrders } = useOrders();
  const { refreshTasks } = useTasks();
  const { refreshGoals } = useGoals();
  const { refreshSuppliers } = useSuppliers();
  const { refreshProfiles, refreshRoleDefinitions, refreshRolePermissions } = useRoles();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) {
      setLoaded(true);
      return;
    }
    Promise.all([
      refreshProducts(),
      refreshOrders(),
      refreshTasks(),
      refreshGoals(),
      refreshSuppliers(),
      refreshProfiles(),
      refreshRoleDefinitions(),
      refreshRolePermissions(),
    ]).finally(() => setLoaded(true));
  }, [session, refreshProducts, refreshOrders, refreshTasks, refreshGoals, refreshSuppliers, refreshProfiles, refreshRoleDefinitions, refreshRolePermissions]);

  return <>{children}</>;
}

/**
 * AppProvider — composes all domain providers.
 * Maintains the same external API as the original monolithic AppProvider.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <CurrencyProvider>
      <AuthProvider>
        <InnerProviders>
          {children}
        </InnerProviders>
      </AuthProvider>
    </CurrencyProvider>
  );
}

function InnerProviders({ children }: { children: ReactNode }) {
  const { session, currentUser } = useAuthDirect();

  return (
    <RolesProvider currentUser={currentUser}>
      <CategoriesProvider>
        <ProductsProvider>
          <OrdersProvider>
            <TasksProvider session={session}>
              <GoalsProvider>
                <SuppliersProvider>
                  <DataLoader>
                    {children}
                  </DataLoader>
                </SuppliersProvider>
              </GoalsProvider>
            </TasksProvider>
          </OrdersProvider>
        </ProductsProvider>
      </CategoriesProvider>
    </RolesProvider>
  );
}
