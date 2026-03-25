import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useData } from "@/contexts/AppContext";
import { canView, MODULES } from "@/lib/permissions";
import { useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  ShoppingCart,
  ListTodo,
  Warehouse,
  FileText,
  Truck,
  Wrench,
  CalendarClock,
  BarChart3,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  products: Package,
  orders: ShoppingCart,
  tasks: ListTodo,
  inventory: Warehouse,
  documents: FileText,
  suppliers: Truck,
  issues: Wrench,
  reorder: CalendarClock,
  reports: BarChart3,
};

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const MY_TASKS_ITEM: NavItem = {
  to: "/my-tasks",
  icon: ClipboardList,
  label: "המשימות שלי",
};

const MAX_VISIBLE_TABS = 5;

export default function EmployeeBottomNav() {
  const { currentUser } = useAuth();
  const { currentUserPermissions } = useData();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (!currentUser || currentUser.role === "MANAGER") return null;

  const permittedModules: NavItem[] = MODULES
    .filter((m) => canView(currentUserPermissions, m.key))
    .map((m) => ({
      to: m.route,
      icon: MODULE_ICONS[m.key] || Package,
      label: m.label,
    }));

  // Don't show bottom nav if no extra modules permitted
  if (permittedModules.length === 0) return null;

  const allItems = [MY_TASKS_ITEM, ...permittedModules];

  const needsOverflow = allItems.length > MAX_VISIBLE_TABS;
  const visibleItems = needsOverflow
    ? allItems.slice(0, MAX_VISIBLE_TABS - 1)
    : allItems;
  const overflowItems = needsOverflow
    ? allItems.slice(MAX_VISIBLE_TABS - 1)
    : [];

  const isActive = (to: string) => {
    if (to === "/my-tasks") {
      return location.pathname.startsWith("/my-tasks");
    }
    return location.pathname.startsWith(to);
  };

  return (
    <>
      <nav className="sticky bottom-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border/50 flex items-stretch justify-around px-1" style={{ minHeight: 56 }}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 transition-colors relative"
            >
              {active && (
                <div className="absolute top-0 inset-x-3 h-0.5 bg-primary rounded-b-full" />
              )}
              <Icon
                className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`text-[10px] leading-tight text-center truncate max-w-full ${
                  active ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}

        {needsOverflow && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 transition-colors relative"
          >
            {overflowItems.some((item) => isActive(item.to)) && (
              <div className="absolute top-0 inset-x-3 h-0.5 bg-primary rounded-b-full" />
            )}
            <MoreHorizontal
              className={`h-5 w-5 ${
                overflowItems.some((item) => isActive(item.to))
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            />
            <span
              className={`text-[10px] leading-tight ${
                overflowItems.some((item) => isActive(item.to))
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              עוד
            </span>
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>ניווט</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3">
            {overflowItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(item.to);
                  }}
                  className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
