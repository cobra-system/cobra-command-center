import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useAuth, useData } from "@/contexts/AppContext";
import { Suspense, lazy, useState, useCallback } from "react";
import SplashScreen from "@/components/SplashScreen";
import { useMiddleClickNavigation } from "@/hooks/useMiddleClickNavigation";
import { canView, getModuleKeyFromRoute, MODULES, isDivisionManager, isDivisionManagerAllowedPath } from "@/lib/permissions";
import { ThemeProvider } from "next-themes";

// Eager: needed on first render
import LoginPage from "@/pages/LoginPage";
import ManagerLayout from "@/layouts/ManagerLayout";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import NotFound from "@/pages/NotFound";

// Lazy: loaded on demand per route
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const ProductDetailPage = lazy(() => import("@/pages/ProductDetailPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const OrderDetailPage = lazy(() => import("@/pages/OrderDetailPage"));
const SuppliersPage = lazy(() => import("@/pages/SuppliersPage"));
const SupplierDetailPage = lazy(() => import("@/pages/SupplierDetailPage"));
const TasksPage = lazy(() => import("@/pages/TasksPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage"));
const DocumentDetailPage = lazy(() => import("@/pages/DocumentDetailPage"));
const ReorderPage = lazy(() => import("@/pages/ReorderPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const MyTasksPage = lazy(() => import("@/pages/MyTasksPage"));
const MyTaskDetailPage = lazy(() => import("@/pages/MyTaskDetailPage"));
const IssuesPage = lazy(() => import("@/pages/IssuesPage"));
const WasteManagementPage = lazy(() => import("@/pages/WasteManagementPage"));
const EquipmentPage = lazy(() => import("@/pages/EquipmentPage"));
const InstallerDetailPage = lazy(() => import("@/pages/InstallerDetailPage"));
const DivisionDetailPage = lazy(() => import("@/pages/DivisionDetailPage"));
const AlertsPage = lazy(() => import("@/pages/AlertsPage"));
const LogisticsMapPage = lazy(() => import("@/pages/LogisticsMapPage"));
const IssueDetailPage = lazy(() => import("@/pages/IssueDetailPage"));
const ComponentDetailPage = lazy(() => import("@/pages/ComponentDetailPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function divisionHome(division: string) {
  return `/equipment/division/${encodeURIComponent(division)}`;
}

function RequireManager() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== "MANAGER") {
    if (isDivisionManager(currentUser)) return <Navigate to={divisionHome(currentUser.division!)} replace />;
    return <Navigate to="/my-tasks" replace />;
  }
  return <ManagerLayout />;
}

function RequirePermission() {
  const { currentUser, loading } = useAuth();
  const { currentUserPermissions } = useData();
  const location = useLocation();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role === "MANAGER") return <ManagerLayout />;

  // Division managers get the rich Manager UI but only on a curated set of pages.
  if (isDivisionManager(currentUser)) {
    if (!isDivisionManagerAllowedPath(location.pathname)) {
      return <Navigate to={divisionHome(currentUser.division!)} replace />;
    }
    return <ManagerLayout />;
  }

  // Non-managers cannot access these manager-only modules
  const managerOnlyPaths = ["/dashboard", "/suppliers", "/reports"];
  if (managerOnlyPaths.some(path => location.pathname.startsWith(path))) {
    return <Navigate to="/my-tasks" replace />;
  }

  const moduleKey = getModuleKeyFromRoute(location.pathname);
  if (!moduleKey || !canView(currentUserPermissions, moduleKey)) {
    return <Navigate to="/my-tasks" replace />;
  }
  return <EmployeeLayout />;
}

function RequireAuth() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  // Division managers don't use /my-tasks — bounce them to their division.
  if (isDivisionManager(currentUser)) return <Navigate to={divisionHome(currentUser.division!)} replace />;
  return <EmployeeLayout />;
}

function RootRedirect() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role === "MANAGER") return <Navigate to="/dashboard" replace />;
  if (currentUser.division) return <Navigate to={divisionHome(currentUser.division)} replace />;
  return <Navigate to="/my-tasks" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireManager />}>
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route element={<RequirePermission />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/products/:productId/components/:componentId" element={<ComponentDetailPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/recurring-tasks" element={<Navigate to="/tasks" replace />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:id" element={<IssueDetailPage />} />
        <Route path="/meetings" element={<Navigate to="/orders" replace />} />
        <Route path="/inventory" element={<Navigate to="/equipment?tab=warehouses" replace />} />
        <Route path="/workflows" element={<Navigate to="/tasks" replace />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/reorder" element={<ReorderPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/waste-management" element={<WasteManagementPage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/equipment/installer/:id" element={<InstallerDetailPage />} />
        <Route path="/equipment/division/:divisionName" element={<DivisionDetailPage />} />
        <Route path="/compliance" element={<Navigate to="/documents" replace />} />
        <Route path="/shipment-groups" element={<Navigate to="/orders" replace />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/logistics-map" element={<LogisticsMapPage />} />
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

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

function AppRoutesWithMiddleClick() {
  useMiddleClickNavigation();
  return (
    <Suspense fallback={<PageLoader />}>
      <AppRoutes />
    </Suspense>
  );
}

function AppWithSplash() {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <BrowserRouter>
        <AppRoutesWithMiddleClick />
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppProvider>
            <AppWithSplash />
          </AppProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;
