import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth, useData } from "@/contexts/AppContext";
import MobileNavPopup from "@/components/MobileNavPopup";
import MobileSearchOverlay from "@/components/MobileSearchOverlay";
import { canView, getModuleKeyFromRoute, isDivisionManager } from "@/lib/permissions";
import { BONDED_DIVISIONS } from "@/components/equipment/constants";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  ListTodo,
  FolderKanban,
  LogOut,
  Menu,
  Search,
  Settings,
  FileText,
  Calendar,
  CalendarClock,
  BarChart3,
  GripVertical,
  Server,
  Repeat,
  Zap,
  ScrollText,
  Wrench,
  ChevronLeft,
  Recycle,
  Boxes,
  ArrowLeft,
  ExternalLink,
  Map,
  Lock,
  Moon,
  Sun,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { EntityContextMenu, type ContextMenuGroupItem } from "@/components/EntityContextMenu";
import { useState } from "react";
import { useTheme } from "next-themes";
import cobraLogo from "@/assets/cobra-logo.png";
import GlobalSearch from "@/components/GlobalSearch";
import { useOrderRequestToasts } from "@/hooks/useOrderRequestToasts";

const defaultNavItems = [
  { to: "/dashboard", icon: "LayoutDashboard", label: "דשבורד" },
  { to: "/products", icon: "Package", label: "מוצרים" },
  { to: "/orders", icon: "ShoppingCart", label: "רכש" },
  { to: "/equipment", icon: "Boxes", label: "חטיבות" },
  { to: "/tasks", icon: "ListTodo", label: "משימות" },
  { to: "/projects", icon: "FolderKanban", label: "פרויקטים" },
  { to: "/documents", icon: "FileText", label: "מסמכים" },
  { to: "/suppliers", icon: "Truck", label: "ספקים" },
  { to: "/issues", icon: "Wrench", label: "תקלות" },
  { to: "/waste-management", icon: "Recycle", label: "ניהול בלאי" },
  { to: "/reorder", icon: "CalendarClock", label: "תכנון רכש" },
  { to: "/logistics-map", icon: "Map", label: "מפת מחסן" },
  { to: "/lock-control", icon: "Lock", label: "בקרת נעילה" },
  { to: "/reports", icon: "BarChart3", label: "דוחות" },
  { to: "/trash", icon: "Trash2", label: "סל מחזור" },
  { to: "/settings", icon: "Settings", label: "הגדרות" },
];

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Package, ShoppingCart, Truck, ListTodo, FolderKanban,
  Settings, FileText, Calendar, CalendarClock, BarChart3, GripVertical, Server, Repeat, Zap, ScrollText, Wrench, Recycle, Boxes, Map, Lock, Trash2,
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
  const { tasks, currentUserPermissions, roleDefinitions } = useData();
  const roleLabel = roleDefinitions.find((rd) => rd.id === currentUser?.role_definition_id)?.name ?? currentUser?.role;
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Surface order-request lifecycle events as in-app toasts (RLS already filters)
  useOrderRequestToasts();
  const [navItems, setNavItems] = useState(getStoredOrder);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { theme, setTheme } = useTheme();

  const isManager = currentUser?.role === "MANAGER";
  const divisionManager = isDivisionManager(currentUser);
  const isBondedDivMgr = divisionManager && BONDED_DIVISIONS.has(currentUser!.division!);
  const divEnc = divisionManager ? encodeURIComponent(currentUser!.division!) : "";
  const visibleNavItems = divisionManager
    ? isBondedDivMgr
      ? [
          { to: `/division/${divEnc}/consumption`, icon: "BarChart3", label: "צריכה" },
          { to: "/products", icon: "Package", label: "מוצרים" },
          { to: `/division/${divEnc}/quarterly-planning`, icon: "Calendar", label: "תכנון רבעוני" },
          { to: "/orders", icon: "ShoppingCart", label: "רכש" },
          { to: "/suppliers", icon: "Truck", label: "ספקים" },
          { to: "/waste-management", icon: "Recycle", label: "בלאי" },
        ]
      : [
          { to: `/equipment/division/${divEnc}`, icon: "Boxes", label: "החטיבה שלי" },
          { to: "/products", icon: "Package", label: "מוצרים" },
          { to: "/orders", icon: "ShoppingCart", label: "רכש" },
          { to: "/suppliers", icon: "Truck", label: "ספקים" },
          { to: "/waste-management", icon: "Recycle", label: "ניהול בלאי" },
        ]
    : navItems.filter((item) => {
        if (isManager) return true;
        if (item.to === "/settings") return false;
        const moduleKey = getModuleKeyFromRoute(item.to);
        return moduleKey ? canView(currentUserPermissions, moduleKey) : false;
      });
  const pendingCount = tasks.filter(t => t.status !== "DONE").length;
  const pageTitle =
    visibleNavItems.find(item => location.pathname.startsWith(item.to))?.label ??
    defaultNavItems.find(item => location.pathname.startsWith(item.to))?.label ??
    "";
  const navDraggable = !divisionManager;

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
      {/* Sidebar (desktop only) */}
      <aside className={`
        hidden lg:flex sticky top-0 h-screen z-50 flex-col shrink-0
        bg-card/95 backdrop-blur-xl border-l border-border/50
        transition-all duration-300 ease-out
        ${collapsed ? "w-[72px]" : "w-[280px]"}
      `}>
        {/* Logo area */}
        <div className={`h-16 flex items-center border-b border-border/50 ${collapsed ? "justify-center px-2" : "px-5 justify-between"}`}>
          {!collapsed && (
            <img
              src={cobraLogo}
              alt="COBRA.IO"
              className="h-8 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
              onClick={() => {
                navigate(divisionManager ? (isBondedDivMgr ? `/division/${divEnc}/consumption` : `/equipment/division/${divEnc}`) : "/dashboard");
                window.location.reload();
              }}
            />
          )}
          {collapsed && (
            <img
              src={cobraLogo}
              alt="COBRA.IO"
              className="h-7 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
              onClick={() => {
                navigate(divisionManager ? (isBondedDivMgr ? `/division/${divEnc}/consumption` : `/equipment/division/${divEnc}`) : "/dashboard");
                window.location.reload();
              }}
            />
          )}
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
            const navMenuGroups: ContextMenuGroupItem[][] = [
              [
                { label: "נווט לעמוד", icon: ArrowLeft, onClick: () => { navigate(item.to); setSidebarOpen(false); } },
                { label: "פתח בלשונית חדשה", icon: ExternalLink, onClick: () => window.open(item.to, "_blank") },
              ],
            ];
            return (
              <EntityContextMenu key={item.to} groups={navMenuGroups}>
              <div
                draggable={navDraggable && !collapsed}
                onDragStart={navDraggable ? () => handleDragStart(index) : undefined}
                onDragOver={navDraggable ? (e) => handleDragOver(e, index) : undefined}
                onDrop={navDraggable ? () => handleDrop(index) : undefined}
                onDragEnd={navDraggable ? handleDragEnd : undefined}
                className={`flex items-center group transition-all ${
                  navDraggable && dragOverIndex === index ? "border-t-2 border-primary/60" : ""
                } ${navDraggable && dragIndex === index ? "opacity-50" : ""}`}
              >
                {navDraggable && !collapsed && (
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
              </EntityContextMenu>
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
                <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
              </div>
            )}
            {!collapsed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/60"
                  title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
            {collapsed && (
              <>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/60 mt-1"
                  title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <img src={cobraLogo} alt="COBRA.IO" className="h-6 opacity-90 shrink-0" />
          <span className="flex-1 text-sm font-semibold text-foreground text-center truncate">{pageTitle}</span>
          <button onClick={() => setSearchOpen(true)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 transition-colors shrink-0">
            <Search className="h-5 w-5" />
          </button>
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 transition-colors shrink-0">
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <div key={location.pathname} className="flex-1 p-3 sm:p-4 lg:p-8 max-w-[1600px] overflow-x-hidden page-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile fullscreen nav popup */}
      <MobileNavPopup
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        visibleNavItems={visibleNavItems}
        pendingCount={pendingCount}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Mobile fullscreen search overlay */}
      <MobileSearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
}
