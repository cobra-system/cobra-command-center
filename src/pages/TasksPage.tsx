import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTodo, CalendarDays, Repeat, Zap } from "lucide-react";
import { useState } from "react";
import TaskBoard from "@/components/tasks/TaskBoard";
import TaskWeeklyView from "@/components/tasks/TaskWeeklyView";
import RecurringTasksPanel from "@/components/tasks/RecurringTasksPanel";
import WorkflowsPanel from "@/components/tasks/WorkflowsPanel";

export default function TasksPage() {
  const [tab, setTab] = useState("board");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">ניהול משימות</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="board" className="gap-1.5 text-xs">
            <ListTodo className="h-3.5 w-3.5" />לוח משימות
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" />תצוגה שבועית
          </TabsTrigger>
          <TabsTrigger value="recurring" className="gap-1.5 text-xs">
            <Repeat className="h-3.5 w-3.5" />חוזרות
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" />תהליכים
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <TaskBoard />
        </TabsContent>
        <TabsContent value="weekly" className="mt-4">
          <TaskWeeklyView />
        </TabsContent>
        <TabsContent value="recurring" className="mt-4">
          <RecurringTasksPanel />
        </TabsContent>
        <TabsContent value="workflows" className="mt-4">
          <WorkflowsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
