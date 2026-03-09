import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useData } from "@/contexts/AppContext";
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
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import cobraLogo from "@/assets/cobra-logo.png";
import GlobalSearch from "@/components/GlobalSearch";

const defaultNavItems = [
  { to: "/dashboard", icon: "LayoutDashboard", label: "דשבורד" },
  { to: "/products", icon: "Package", label: "מוצרים" },
  { to: "/orders", icon: "ShoppingCart", label: "הזמנות" },
  { to: "/workflows", icon: "Zap", label: "תהליכים" },
  { to: "/inventory", icon: "Warehouse", label: "מלאי" },
  { to: "/documents", icon: "FileText", label: "מסמכים" },
  { to: "/suppliers", icon: "Truck", label: "ספקים" },
  { to: "/tasks", icon: "ListTodo", label: "משימות" },
  { to: "/recurring-tasks", icon: "Repeat", label: "משימות חוזרות" },
  { to: "/reorder", icon: "CalendarClock", label: "תכנון רכש" },
  { to: "/reports", icon: "BarChart3", label: "דוחות" },
  { to: "/settings", icon: "Settings", label: "הגדרות" },
  { to: "/sap", icon: "Server", label: "SAP B1" },
];

const iconMap: Record<string, any> = {
  LayoutDashboard, Package, ShoppingCart, Truck, ListTodo,
  Settings, FileText, CalendarClock, BarChart3, Warehouse, GripVertical, Server, Repeat, Zap,
};

const NAV_ORDER_KEY = "cobra-nav-order";

function getStoredOrder(): typeof defaultNavItems {
  try {
    const stored = localStorage.getItem(NAV_ORDER_KEY);
    if (!stored) return defaultNavItems;
    const order: string[] = JSON.parse(stored);
    // Rebuild from stored order, adding any new items not in stored
    const itemMap = new Map(defaultNavItems.map(i => [i.to, i]));
    const result = order.filter(to => itemMap.has(to)).map(to => itemMap.get(to)!);
    // Add any missing items
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
  const { tasks } = useData();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navItems, setNavItems] = useState(getStoredOrder);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const pendingCount = tasks.filter(t => t.status !== "DONE").length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newItems = [...navItems];
    const [removed] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, removed);
    setNavItems(newItems);
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(newItems.map(i => i.to)));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 right-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 flex items-center justify-between">
          <img src={cobraLogo} alt="COBRA.IO" className="h-10 brightness-0 invert cursor-pointer" onClick={() => { navigate("/dashboard"); window.location.reload(); }} />
          <button className="lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <GlobalSearch />

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item, index) => {
            const Icon = iconMap[item.icon] || Package;
            return (
              <div
                key={item.to}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center group transition-all ${
                  dragOverIndex === index ? "border-t-2 border-primary" : ""
                } ${dragIndex === index ? "opacity-40" : ""}`}
              >
                <div className="opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing px-0.5 text-sidebar-foreground/40">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
                <NavLink
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {item.to === "/tasks" && pendingCount > 0 && (
                    <span className="mr-auto flex items-center gap-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold">
              {currentUser?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser?.name}</p>
              <p className="text-xs text-sidebar-foreground/50">{currentUser?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-sidebar-foreground/50 hover:text-sidebar-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center justify-between">
          <img src={cobraLogo} alt="COBRA.IO" className="h-8" />
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6 text-foreground" />
          </button>
        </header>

        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
