import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useAuth } from "@/contexts/AppContext";
import { OutlookProvider } from "@/contexts/OutlookContext";
import LoginPage from "@/pages/LoginPage";
import ManagerLayout from "@/layouts/ManagerLayout";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import OrdersPage from "@/pages/OrdersPage";
import SuppliersPage from "@/pages/SuppliersPage";
import TasksPage from "@/pages/TasksPage";
import TeamPage from "@/pages/TeamPage";
import SettingsPage from "@/pages/SettingsPage";
import LearningJournalPage from "@/pages/LearningJournalPage";
import DocumentsPage from "@/pages/DocumentsPage";
import PaymentsPage from "@/pages/PaymentsPage";
import ReorderPage from "@/pages/ReorderPage";
import DependencyMapPage from "@/pages/DependencyMapPage";
import ReportsPage from "@/pages/ReportsPage";
import MyTasksPage from "@/pages/MyTasksPage";
import MyTaskDetailPage from "@/pages/MyTaskDetailPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function RequireManager() {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== "MANAGER") return <Navigate to="/my-tasks" replace />;
  return <ManagerLayout />;
}

function RequireAuth() {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <EmployeeLayout />;
}

function RootRedirect() {
  const { currentUser } = useAuth();
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
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/journal" element={<LearningJournalPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/reorder" element={<ReorderPage />} />
        <Route path="/dependencies" element={<DependencyMapPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/my-tasks" element={<MyTasksPage />} />
        <Route path="/my-tasks/:id" element={<MyTaskDetailPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <OutlookProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </OutlookProvider>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
