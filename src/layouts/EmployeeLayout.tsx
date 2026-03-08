import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AppContext";
import { LogOut, Shield } from "lucide-react";

export default function EmployeeLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-[hsl(var(--employee-header))] text-[hsl(var(--employee-header-foreground))] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <span className="font-bold text-sm">COBRA.IO</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{currentUser?.name}</span>
          <button onClick={handleLogout} className="opacity-70 hover:opacity-100">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
