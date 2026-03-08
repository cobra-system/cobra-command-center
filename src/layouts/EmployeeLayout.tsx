import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AppContext";
import { LogOut } from "lucide-react";
import cobraLogo from "@/assets/cobra-logo.png";

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
        <img src={cobraLogo} alt="COBRA.IO" className="h-7 brightness-0 invert" />
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
