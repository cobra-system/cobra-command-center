import { Outlet, useNavigate } from "react-router-dom";
import { useAuth, useData } from "@/contexts/AppContext";
import { LogOut } from "lucide-react";
import cobraLogo from "@/assets/cobra-logo.png";

export default function EmployeeLayout() {
  const { currentUser, logout } = useAuth();
  const { tasks } = useData();
  const navigate = useNavigate();

  const myTasks = tasks.filter(t => t.assignee_id === currentUser?.id);
  const done = myTasks.filter(t => t.status === "DONE").length;
  const total = myTasks.length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto shadow-xl">
      {/* Header with gradient */}
      <header className="relative bg-gradient-to-bl from-[hsl(var(--employee-header))] via-[hsl(150_55%_28%)] to-[hsl(160_45%_20%)] text-[hsl(var(--employee-header-foreground))] px-5 py-4 flex items-center justify-between overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }} />
        <img src={cobraLogo} alt="COBRA.IO" className="h-7 brightness-0 invert relative z-10" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-sm font-bold border border-white/20">
              {currentUser?.name?.[0]}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">{currentUser?.name}</span>
              {total > 0 && (
                <span className="text-[10px] opacity-70">{done}/{total} משימות ✓</span>
              )}
            </div>
          </div>
          <button onClick={handleLogout} className="opacity-60 hover:opacity-100 transition-opacity p-1">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
