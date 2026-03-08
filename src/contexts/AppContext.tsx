import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  users as initialUsers,
  products as initialProducts,
  orders as initialOrders,
  tasks as initialTasks,
  suppliers as initialSuppliers,
  type User,
  type Product,
  type Order,
  type Task,
  type Supplier,
  type TaskStatus,
  type OrderStatus,
} from "@/data/mockData";

interface AuthState {
  currentUser: User | null;
  login: (emailOrPin: string, password?: string) => boolean;
  logout: () => void;
}

interface DataState {
  products: Product[];
  orders: Order[];
  tasks: Task[];
  suppliers: Supplier[];
  users: User[];
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  addTaskNote: (taskId: string, note: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  addOrder: (order: Order) => void;
  addTask: (task: Task) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [productsState, setProducts] = useState(initialProducts);
  const [ordersState, setOrders] = useState(initialOrders);
  const [tasksState, setTasks] = useState(initialTasks);
  const [suppliersState] = useState(initialSuppliers);
  const [usersState, setUsers] = useState(initialUsers);

  const login = useCallback((emailOrPin: string, password?: string): boolean => {
    // Manager login
    if (password) {
      const user = usersState.find(u => u.email === emailOrPin && u.role === "MANAGER");
      if (user && password === "cobra2026") {
        setCurrentUser(user);
        return true;
      }
      return false;
    }
    // Employee PIN login
    const user = usersState.find(u => u.pin === emailOrPin);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  }, [usersState]);

  const logout = useCallback(() => setCurrentUser(null), []);

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  }, []);

  const addTaskNote = useCallback((taskId: string, note: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: note } : t));
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  }, []);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => [...prev, task]);
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const addUser = useCallback((user: User) => {
    setUsers(prev => [...prev, user]);
  }, []);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      <DataContext.Provider value={{
        products: productsState,
        orders: ordersState,
        tasks: tasksState,
        suppliers: suppliersState,
        users: usersState,
        updateTaskStatus,
        addTaskNote,
        updateOrderStatus,
        addTask,
        updateProduct,
        addUser,
        updateUser,
      }}>
        {children}
      </DataContext.Provider>
    </AuthContext.Provider>
  );
}
