import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useAuth } from "@/contexts/AppContext";
import { OutlookProvider } from "@/contexts/OutlookContext";
import { useState, useCallback } from "react";
import SplashScreen from "@/components/SplashScreen";
import LoginPage from "@/pages/LoginPage";
import ManagerLayout from "@/layouts/ManagerLayout";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import SuppliersPage from "@/pages/SuppliersPage";
import SupplierDetailPage from "@/pages/SupplierDetailPage";
import TasksPage from "@/pages/TasksPage";
import SettingsPage from "@/pages/SettingsPage";
import DocumentsPage from "@/pages/DocumentsPage";
import DocumentDetailPage from "@/pages/DocumentDetailPage";
import ReorderPage from "@/pages/ReorderPage";
import ReportsPage from "@/pages/ReportsPage";
import MyTasksPage from "@/pages/MyTasksPage";
import MyTaskDetailPage from "@/pages/MyTaskDetailPage";
import InventoryPage from "@/pages/InventoryPage";

import NotFound from "@/pages/NotFound";
import IssuesPage from "@/pages/IssuesPage";
const queryClient = new QueryClient();

function RequireManager() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== "MANAGER") return <Navigate to="/my-tasks" replace />;
  return <ManagerLayout />;
}

function RequireAuth() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <EmployeeLayout />;
}

function RootRedirect() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role === "MANAGER") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/my-tasks" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireManager />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/recurring-tasks" element={<Navigate to="/tasks" replace />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/workflows" element={<Navigate to="/tasks" replace />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/reorder" element={<ReorderPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/sap" element={<Navigate to="/settings" replace />} />
        <Route path="/compliance" element={<Navigate to="/documents" replace />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/my-tasks" element={<MyTasksPage />} />
        <Route path="/my-tasks/:id" element={<MyTaskDetailPage />} />
      </Route>

      {/* Redirect old /team to /settings */}
      <Route path="/team" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppWithSplash() {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <OutlookProvider>
          <AppWithSplash />
        </OutlookProvider>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
