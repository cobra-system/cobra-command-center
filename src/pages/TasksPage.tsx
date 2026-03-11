import { useState } from "react";
import TaskWeeklyView from "@/components/tasks/TaskWeeklyView";
import TaskBoard from "@/components/tasks/TaskBoard";
import { LayoutGrid, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "weekly" | "board";

export default function TasksPage() {
  const [view, setView] = useState<View>("weekly");

  return (
    <div className="h-full flex flex-col gap-4">
      {/* View toggle */}
      <div className="flex justify-end">
        <div className="flex bg-secondary rounded-lg p-1 gap-1">
          <button
            onClick={() => setView("weekly")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              view === "weekly" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            תצוגה שבועית
          </button>
          <button
            onClick={() => setView("board")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              view === "board" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            לוח קנבן
          </button>
        </div>
      </div>

      {view === "weekly" ? <TaskWeeklyView /> : <TaskBoard />}
    </div>
  );
}
