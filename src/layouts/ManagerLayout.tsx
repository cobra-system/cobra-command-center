import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useData } from "@/contexts/AppContext";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  ListTodo,
  Users,
  LogOut,
  Shield,
  AlertTriangle,
  Menu,
  X,
  Settings,
  BookOpen,
  FileText,
  CreditCard,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "דשבורד" },
  { to: "/products", icon: Package, label: "מוצרים" },
  { to: "/orders", icon: ShoppingCart, label: "הזמנות" },
  { to: "/documents", icon: FileText, label: "מסמכים (PI/PO)" },
  { to: "/payments", icon: CreditCard, label: "תשלומים" },
  { to: "/suppliers", icon: Truck, label: "ספקים" },
  { to: "/tasks", icon: ListTodo, label: "משימות" },
  { to: "/journal", icon: BookOpen, label: "יומן למידה" },
  { to: "/team", icon: Users, label: "צוות" },
  { to: "/settings", icon: Settings, label: "הגדרות" },
];

export default function ManagerLayout() {
  const { currentUser, logout } = useAuth();
  const { tasks } = useData();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const p0Count = tasks.filter(t => t.priority === "P0" && t.status !== "DONE").length;

  const handleLogout = () => {
    logout();
    navigate("/login");
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
          <div className="flex items-center gap-2.5">
            <Shield className="h-7 w-7" />
            <span className="text-xl font-black tracking-tight">COBRA.IO</span>
          </div>
          <button className="lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
              {item.to === "/tasks" && p0Count > 0 && (
                <span className="mr-auto flex items-center gap-1 bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3" />
                  {p0Count}
                </span>
              )}
            </NavLink>
          ))}
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
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-primary">COBRA.IO</span>
          </div>
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
