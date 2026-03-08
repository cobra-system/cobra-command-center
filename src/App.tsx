import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useAuth } from "@/contexts/AppContext";
import LoginPage from "@/pages/LoginPage";
import ManagerLayout from "@/layouts/ManagerLayout";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import OrdersPage from "@/pages/OrdersPage";
import SuppliersPage from "@/pages/SuppliersPage";
import TasksPage from "@/pages/TasksPage";
import TeamPage from "@/pages/TeamPage";
import MyTasksPage from "@/pages/MyTasksPage";
import MyTaskDetailPage from "@/pages/MyTaskDetailPage";
import NotFound from "@/pages/NotFound";
import type { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedManager({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== "MANAGER") return <Navigate to="/my-tasks" replace />;
  return <>{children}</>;
}

function ProtectedEmployee({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role === "MANAGER") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/my-tasks" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Manager routes */}
            <Route element={<ProtectedManager><ManagerLayout /></ProtectedManager>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/team" element={<TeamPage />} />
            </Route>

            {/* Employee routes */}
            <Route element={<ProtectedEmployee><EmployeeLayout /></ProtectedEmployee>}>
              <Route path="/my-tasks" element={<MyTasksPage />} />
              <Route path="/my-tasks/:id" element={<MyTaskDetailPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
