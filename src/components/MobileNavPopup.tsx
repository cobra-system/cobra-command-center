import { NavLink, useNavigate } from "react-router-dom";
import {
  X,
  LogOut,
  Package,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  ListTodo,
  Settings,
  FileText,
  CalendarClock,
  BarChart3,
  Wrench,
  Recycle,
  Boxes,
  Bell,
  Map,
  type LucideIcon,
} from "lucide-react";
import cobraLogo from "@/assets/cobra-logo.png";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Package, ShoppingCart, Truck, ListTodo,
  Settings, FileText, CalendarClock, BarChart3, Wrench, Recycle, Boxes, Bell, Map,
};

interface MobileNavPopupProps {
  isOpen: boolean;
  onClose: () => void;
  visibleNavItems: { to: string; icon: string; label: string }[];
  pendingCount: number;
  currentUser: { name?: string; role?: string } | null;
  onLogout: () => void;
}

export default function MobileNavPopup({
  isOpen,
  onClose,
  visibleNavItems,
  pendingCount,
  currentUser,
  onLogout,
}: MobileNavPopupProps) {
  return (
    <div
      className={`
        fixed inset-0 z-50 bg-background flex flex-col lg:hidden
        transition-all duration-200 ease-out
        ${isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border/50 shrink-0">
        <img src={cobraLogo} alt="COBRA.IO" className="h-7 opacity-90" />
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
        {visibleNavItems.map((item) => {
          const Icon = iconMap[item.icon] || Package;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
              {item.to === "/tasks" && pendingCount > 0 && (
                <span className="ms-auto text-xs font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full leading-none">
                  {pendingCount}
                </span>
              )}

            </NavLink>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div className="border-t border-border/50 p-4 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0 shadow-sm">
            {currentUser?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{currentUser?.name}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
