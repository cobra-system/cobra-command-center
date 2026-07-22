import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Grid3x3, Clock, GanttChart } from "lucide-react";
import TaskWeeklyView from "@/components/tasks/TaskWeeklyView";
import TaskMonthlyView from "@/components/tasks/TaskMonthlyView";
import TaskDayView from "@/components/tasks/TaskDayView";
import TaskGanttView from "@/components/tasks/TaskGanttView";

export default function TasksPage() {
  const [view, setView] = useState("daily");
  const { hasEdit } = usePermissions("tasks");

  return (
    <div className="h-full flex flex-col" dir="rtl">
      <Tabs value={view} onValueChange={setView} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="daily" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-1 sm:px-3">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">יום</span>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-1 sm:px-3">
            <Grid3x3 className="h-4 w-4" />
            <span className="hidden sm:inline">שבוע</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-1 sm:px-3">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">חודש</span>
          </TabsTrigger>
          <TabsTrigger value="gantt" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-1 sm:px-3">
            <GanttChart className="h-4 w-4" />
            <span className="hidden sm:inline">גאנט</span>
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
