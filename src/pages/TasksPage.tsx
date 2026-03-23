import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Grid3x3, Clock, GanttChart } from "lucide-react";
import TaskWeeklyView from "@/components/tasks/TaskWeeklyView";
import TaskMonthlyView from "@/components/tasks/TaskMonthlyView";
import TaskDayView from "@/components/tasks/TaskDayView";
import TaskGanttView from "@/components/tasks/TaskGanttView";

export default function TasksPage() {
  const [view, setView] = useState("weekly");
  const { hasEdit } = usePermissions("tasks");

  return (
    <div className="h-full flex flex-col" dir="rtl">
      <Tabs value={view} onValueChange={setView} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="weekly" className="gap-1.5">
            <Grid3x3 className="h-4 w-4" />
            שבוע
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            יום
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <Clock className="h-4 w-4" />
            חודש
          </TabsTrigger>
          <TabsTrigger value="gantt" className="gap-1.5">
            <GanttChart className="h-4 w-4" />
            גאנט
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="flex-1">
          <TaskWeeklyView />
        </TabsContent>

        <TabsContent value="daily" className="flex-1">
          <TaskDayView />
        </TabsContent>

        <TabsContent value="monthly" className="flex-1">
          <TaskMonthlyView />
        </TabsContent>

        <TabsContent value="gantt" className="flex-1">
          <TaskGanttView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
