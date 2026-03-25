import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useData } from "@/contexts/AppContext";
import { canView, getModuleKeyFromRoute } from "@/lib/permissions";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  ListTodo,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  CalendarClock,
  BarChart3,
  Warehouse,
  GripVertical,
  Server,
  Repeat,
  Zap,
  ScrollText,
  Wrench,
  ChevronLeft,
  Users,
} from "lucide-react";
import { useState } from "react";
import cobraLogo from "@/assets/cobra-logo.png";
import GlobalSearch from "@/components/GlobalSearch";

const defaultNavItems = [
  { to: "/dashboard", icon: "LayoutDashboard", label: "דשבורד" },
  { to: "/products", icon: "Package", label: "מוצרים" },
  { to: "/orders", icon: "ShoppingCart", label: "הזמנות" },
  { to: "/tasks", icon: "ListTodo", label: "משימות" },
  { to: "/meetings", icon: "Users", label: "פגישות" },
  { to: "/inventory", icon: "Warehouse", label: "מלאי" },
  { to: "/documents", icon: "FileText", label: "מסמכים" },
  { to: "/suppliers", icon: "Truck", label: "ספקים" },
  { to: "/issues", icon: "Wrench", label: "תקלות" },
  { to: "/reorder", icon: "CalendarClock", label: "תכנון רכש" },
  { to: "/reports", icon: "BarChart3", label: "דוחות" },
  { to: "/settings", icon: "Settings", label: "הגדרות" },
];

const iconMap: Record<string, any> = {
  LayoutDashboard, Package, ShoppingCart, Truck, ListTodo,
  Settings, FileText, CalendarClock, BarChart3, Warehouse, GripVertical, Server, Repeat, Zap, ScrollText, Wrench, Users,
};

const NAV_ORDER_KEY = "cobra-nav-order";

function getStoredOrder(): typeof defaultNavItems {
  try {
    const stored = localStorage.getItem(NAV_ORDER_KEY);
    if (!stored) return defaultNavItems;
    const order: string[] = JSON.parse(stored);
    const itemMap = new Map(defaultNavItems.map(i => [i.to, i]));
    const result = order.filter(to => itemMap.has(to)).map(to => itemMap.get(to)!);
    defaultNavItems.forEach(item => {
      if (!result.find(r => r.to === item.to)) result.push(item);
    });
    return result;
  } catch {
    return defaultNavItems;
  }
}

export default function ManagerLayout() {
  const { currentUser, logout } = useAuth();
  const { tasks, currentUserPermissions } = useData();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [navItems, setNavItems] = useState(getStoredOrder);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const isManager = currentUser?.role === "MANAGER";
  const visibleNavItems = navItems.filter((item) => {
    if (isManager) return true;
    if (item.to === "/settings") return false;
    const moduleKey = getModuleKeyFromRoute(item.to);
    return moduleKey ? canView(currentUserPermissions, moduleKey) : false;
  });
  const pendingCount = tasks.filter(t => t.status !== "DONE").length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const newItems = [...navItems];
    const [removed] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, removed);
    setNavItems(newItems);
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(newItems.map(i => i.to)));
    setDragIndex(null); setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 right-0 z-50 flex flex-col
        bg-card/95 backdrop-blur-xl border-l border-border/50
        transition-all duration-300 ease-out
        ${collapsed ? "w-[72px]" : "w-[280px]"}
        ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo area */}
        <div className={`h-16 flex items-center border-b border-border/50 ${collapsed ? "justify-center px-2" : "px-5 justify-between"}`}>
          {!collapsed && (
            <img
              src={cobraLogo}
              alt="COBRA.IO"
              className="h-8 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
              onClick={() => { navigate("/dashboard"); window.location.reload(); }}
            />
          )}
          {collapsed && (
            <img
              src={cobraLogo}
              alt="COBRA.IO"
              className="h-7 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
              onClick={() => { navigate("/dashboard"); window.location.reload(); }}
            />
          )}
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <GlobalSearch />
          </div>
        )}

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? "px-2" : "px-3"} space-y-0.5 scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent`}>
          {visibleNavItems.map((item, index) => {
            const Icon = iconMap[item.icon] || Package;
            return (
              <div
                key={item.to}
                draggable={!collapsed}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center group transition-all ${
                  dragOverIndex === index ? "border-t-2 border-primary/60" : ""
                } ${dragIndex === index ? "opacity-50" : ""}`}
              >
                {!collapsed && (
                  <div className="opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing px-2 text-muted-foreground transition-opacity duration-200">
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                <NavLink
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex-1 flex items-center gap-3 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                      collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"
                    } ${
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`
                  }
                >
                  <Icon className={`${collapsed ? "h-5 w-5" : "h-[18px] w-[18px]"} shrink-0`} />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.to === "/tasks" && pendingCount > 0 && (
                    <span className="ms-auto text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full leading-none">
                      {pendingCount}
                    </span>
                  )}
                  {collapsed && item.to === "/tasks" && pendingCount > 0 && (
                    <span className="absolute top-0 right-0 h-2 w-2 bg-primary rounded-full" />
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex justify-center py-2 border-t border-border/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted/60 transition-colors"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180 rtl:rotate-0" : "rtl:rotate-180"}`} />
          </button>
        </div>

        {/* User profile */}
        <div className={`border-t border-border/50 ${collapsed ? "p-2" : "p-3"}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-2 py-2"}`}>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0 shadow-sm">
              {currentUser?.name?.[0]}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{currentUser?.name}</p>
                <p className="text-[11px] text-muted-foreground">{currentUser?.role}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
          <img src={cobraLogo} alt="COBRA.IO" className="h-7 opacity-90" />
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 transition-colors">
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 p-3 sm:p-4 lg:p-8 max-w-[1600px] overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
