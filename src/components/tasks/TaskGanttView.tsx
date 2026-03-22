import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useData, useAuth, type Task, type TaskStatus } from "@/contexts/AppContext";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";
import {
  addDays,
  differenceInDays,
  format,
  startOfDay,
  endOfDay,
  isWeekend,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfWeek,
  parseISO,
  isValid,
} from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ZoomIn,
  ZoomOut,
  CalendarDays,
  Link2,
  Link2Off,
  GripVertical,
} from "lucide-react";

// --- Constants ---
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 60;
const SIDEBAR_WIDTH = 260;
const MIN_DAY_WIDTH = 28;
const MAX_DAY_WIDTH = 80;
const DEFAULT_DAY_WIDTH = 44;
const BAR_HEIGHT = 28;
const BAR_TOP_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  TODO: { bg: "bg-slate-200", border: "border-slate-400", text: "text-slate-700" },
  IN_PROGRESS: { bg: "bg-blue-200", border: "border-blue-500", text: "text-blue-800" },
  DONE: { bg: "bg-emerald-200", border: "border-emerald-500", text: "text-emerald-800" },
  BLOCKED: { bg: "bg-red-200", border: "border-red-400", text: "text-red-800" },
};

const PRIORITY_COLORS: Record<string, string> = {
  "דחוף": "border-l-red-500",
  "גבוה": "border-l-orange-500",
  "בינוני": "border-l-yellow-500",
  "נמוך": "border-l-green-500",
};

// --- Helpers ---
function parseDateSafe(d: string | null | undefined): Date | null {
  if (!d) return null;
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// --- Types ---
interface DragState {
  taskId: string;
  type: "move" | "resize-start" | "resize-end";
  startX: number;
  origStart: Date;
  origEnd: Date;
}

interface LinkingState {
  fromTaskId: string;
}

// ================================================
// MAIN COMPONENT
// ================================================
export default function TaskGanttView() {
  const { tasks, updateTask, updateTaskStatus, profiles, refreshTasks } = useData();
  const { currentUser } = useAuth();

  // State
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { locale: he }));
  const [selectedAssignee, setSelectedAssignee] = useState("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [linkingState, setLinkingState] = useState<LinkingState | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Number of visible days
  const totalDays = Math.max(28, Math.ceil(900 / dayWidth));

  // Generate day columns
  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(viewStart, i));
  }, [viewStart, totalDays]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) => !t.is_daily);
    if (selectedAssignee !== "all") {
      list = list.filter((t) => t.assignee_id === selectedAssignee);
    }
    // Sort by start_date, then due_date
    list.sort((a, b) => {
      const aStart = parseDateSafe(a.start_date)?.getTime() ?? Infinity;
      const bStart = parseDateSafe(b.start_date)?.getTime() ?? Infinity;
      if (aStart !== bStart) return aStart - bStart;
      const aDue = parseDateSafe(a.due_date)?.getTime() ?? Infinity;
      const bDue = parseDateSafe(b.due_date)?.getTime() ?? Infinity;
      return aDue - bDue;
    });
    return list;
  }, [tasks, selectedAssignee]);

  // Zoom
  const zoomIn = () => setDayWidth((w) => clamp(w + 8, MIN_DAY_WIDTH, MAX_DAY_WIDTH));
  const zoomOut = () => setDayWidth((w) => clamp(w - 8, MIN_DAY_WIDTH, MAX_DAY_WIDTH));

  // Navigate
  const goBack = () => setViewStart((d) => subWeeks(d, 1));
  const goForward = () => setViewStart((d) => addWeeks(d, 1));
  const goToday = () => setViewStart(startOfWeek(new Date(), { locale: he }));

  // --- Drag handlers ---
  const handleDragStart = useCallback(
    (e: React.MouseEvent, taskId: string, type: DragState["type"], start: Date, end: Date) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({ taskId, type, startX: e.clientX, origStart: start, origEnd: end });
      setDragDelta(0);
    },
    []
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragState.startX;
      setDragDelta(delta);
    };

    const handleMouseUp = async () => {
      if (!dragState) return;

      const daysDelta = Math.round(dragDelta / dayWidth);
      if (daysDelta !== 0) {
        let newStart = dragState.origStart;
        let newEnd = dragState.origEnd;

        if (dragState.type === "move") {
          newStart = addDays(dragState.origStart, daysDelta);
          newEnd = addDays(dragState.origEnd, daysDelta);
        } else if (dragState.type === "resize-start") {
          newStart = addDays(dragState.origStart, daysDelta);
          if (newStart >= newEnd) newStart = addDays(newEnd, -1);
        } else if (dragState.type === "resize-end") {
          newEnd = addDays(dragState.origEnd, daysDelta);
          if (newEnd <= newStart) newEnd = addDays(newStart, 1);
        }

        await updateTask(dragState.taskId, {
          start_date: newStart.toISOString(),
          due_date: newEnd.toISOString(),
        });
      }

      setDragState(null);
      setDragDelta(0);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, dragDelta, dayWidth, updateTask]);

  // --- Linking handler ---
  const handleLinkClick = useCallback(
    async (taskId: string) => {
      if (!linkingState) {
        setLinkingState({ fromTaskId: taskId });
        return;
      }

      if (linkingState.fromTaskId === taskId) {
        setLinkingState(null);
        return;
      }

      // Add dependency: taskId depends on linkingState.fromTaskId
      const targetTask = tasks.find((t) => t.id === taskId);
      if (targetTask) {
        const currentDeps = targetTask.depends_on ?? [];
        if (!currentDeps.includes(linkingState.fromTaskId)) {
          await updateTask(taskId, {
            depends_on: [...currentDeps, linkingState.fromTaskId],
          });
        }
      }
      setLinkingState(null);
    },
    [linkingState, tasks, updateTask]
  );

  const handleRemoveDependency = useCallback(
    async (taskId: string, depId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        const newDeps = (task.depends_on ?? []).filter((d) => d !== depId);
        await updateTask(taskId, { depends_on: newDeps.length > 0 ? newDeps : [] });
      }
    },
    [tasks, updateTask]
  );

  // --- Compute bar positions ---
  const taskBars = useMemo(() => {
    const viewStartTime = startOfDay(viewStart).getTime();
    return filteredTasks.map((task, rowIndex) => {
      const start = parseDateSafe(task.start_date);
      const end = parseDateSafe(task.due_date);
      if (!start && !end) return { task, rowIndex, visible: false, left: 0, width: 0, start: null, end: null };

      const barStart = start ?? end!;
      const barEnd = end ?? start!;
      const startDay = differenceInDays(startOfDay(barStart), startOfDay(viewStart));
      const duration = Math.max(1, differenceInDays(startOfDay(barEnd), startOfDay(barStart)) + 1);

      let left = startDay * dayWidth;
      let width = duration * dayWidth;

      // Apply drag delta
      if (dragState && dragState.taskId === task.id) {
        if (dragState.type === "move") {
          left += dragDelta;
        } else if (dragState.type === "resize-start") {
          left += dragDelta;
          width -= dragDelta;
        } else if (dragState.type === "resize-end") {
          width += dragDelta;
        }
        width = Math.max(dayWidth, width);
      }

      return { task, rowIndex, visible: true, left, width, start: barStart, end: barEnd };
    });
  }, [filteredTasks, viewStart, dayWidth, dragState, dragDelta]);

  // --- Dependency arrows ---
  const dependencyArrows = useMemo(() => {
    const arrows: { fromX: number; fromY: number; toX: number; toY: number; taskId: string; depId: string }[] = [];
    const taskBarMap = new Map(taskBars.map((b) => [b.task.id, b]));

    for (const bar of taskBars) {
      const deps = bar.task.depends_on ?? [];
      for (const depId of deps) {
        const depBar = taskBarMap.get(depId);
        if (!depBar || !depBar.visible || !bar.visible) continue;

        const fromX = depBar.left + depBar.width;
        const fromY = depBar.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const toX = bar.left;
        const toY = bar.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        arrows.push({ fromX, fromY, toX, toY, taskId: bar.task.id, depId });
      }
    }
    return arrows;
  }, [taskBars]);

  const todayOffset = useMemo(() => {
    return differenceInDays(startOfDay(new Date()), startOfDay(viewStart)) * dayWidth;
  }, [viewStart, dayWidth]);

  const totalWidth = totalDays * dayWidth;
  const totalHeight = filteredTasks.length * ROW_HEIGHT;

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={goBack}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>
          <CalendarDays className="h-4 w-4 ml-1" />
          היום
        </Button>
        <Button variant="outline" size="sm" onClick={goForward}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 mr-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue placeholder="כולם" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המשתמשים</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={linkingState ? "default" : "outline"}
          size="sm"
          onClick={() => setLinkingState(linkingState ? null : { fromTaskId: "" })}
          className="mr-2"
        >
          {linkingState ? <Link2Off className="h-4 w-4 ml-1" /> : <Link2 className="h-4 w-4 ml-1" />}
          {linkingState ? "ביטול קישור" : "קשר משימות"}
        </Button>

        <div className="flex-1" />

        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 ml-1" />
          משימה חדשה
        </Button>
      </div>

      {/* Gantt Area */}
      <div className="flex-1 border rounded-lg overflow-hidden bg-white flex flex-row-reverse">
        {/* Sidebar - Task list */}
        <div
          className="border-l bg-gray-50 flex-shrink-0 overflow-hidden"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Sidebar header */}
          <div
            className="border-b bg-gray-100 flex items-center px-3 font-semibold text-sm text-gray-600"
            style={{ height: HEADER_HEIGHT }}
          >
            משימות ({filteredTasks.length})
          </div>
          {/* Sidebar rows */}
          <div className="overflow-y-auto" style={{ maxHeight: `calc(100% - ${HEADER_HEIGHT}px)` }}>
            {filteredTasks.map((task) => {
              const colors = STATUS_COLORS[task.status] ?? STATUS_COLORS.TODO;
              const priorityBorder = PRIORITY_COLORS[task.priority] ?? "";
              return (
                <div
                  key={task.id}
                  className={`flex items-center px-3 gap-2 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors border-r-4 ${priorityBorder}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate font-medium">{task.title}</div>
                    {task.assignee_name && (
                      <div className="text-xs text-gray-400 truncate">{task.assignee_name}</div>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${colors.bg} ${colors.text} border ${colors.border}`}
                  >
                    {task.status === "TODO"
                      ? "לביצוע"
                      : task.status === "IN_PROGRESS"
                      ? "בביצוע"
                      : task.status === "DONE"
                      ? "הושלם"
                      : "חסום"}
                  </Badge>
                </div>
              );
            })}
            {filteredTasks.length === 0 && (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                אין משימות להצגה
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto relative"
          style={{ direction: "ltr" }}
        >
          <div ref={timelineRef} style={{ width: totalWidth, minHeight: HEADER_HEIGHT + totalHeight }}>
            {/* Date headers */}
            <div className="sticky top-0 z-20 bg-white border-b" style={{ height: HEADER_HEIGHT }}>
              <div className="relative" style={{ height: HEADER_HEIGHT }}>
                {days.map((day, i) => {
                  const isToday = isSameDay(day, new Date());
                  const isWkend = isWeekend(day);
                  return (
                    <div
                      key={i}
                      className={`absolute top-0 border-r text-center select-none ${
                        isToday
                          ? "bg-blue-50 font-bold text-blue-600"
                          : isWkend
                          ? "bg-gray-50 text-gray-400"
                          : "text-gray-600"
                      }`}
                      style={{
                        left: i * dayWidth,
                        width: dayWidth,
                        height: HEADER_HEIGHT,
                      }}
                    >
                      <div className="text-[10px] mt-1">{format(day, "EEE", { locale: he })}</div>
                      <div className="text-xs">{format(day, "d")}</div>
                      <div className="text-[9px] text-gray-400">{format(day, "MMM", { locale: he })}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid + Bars area */}
            <div className="relative" style={{ height: totalHeight }}>
              {/* Grid lines */}
              {days.map((day, i) => {
                const isWkend = isWeekend(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={i}
                    className={`absolute top-0 border-r ${
                      isToday ? "bg-blue-50/40" : isWkend ? "bg-gray-50/60" : ""
                    }`}
                    style={{
                      left: i * dayWidth,
                      width: dayWidth,
                      height: totalHeight,
                    }}
                  />
                );
              })}

              {/* Row separators */}
              {filteredTasks.map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-b border-gray-100"
                  style={{ top: (i + 1) * ROW_HEIGHT }}
                />
              ))}

              {/* Today line */}
              {todayOffset >= 0 && todayOffset <= totalWidth && (
                <div
                  className="absolute top-0 w-0.5 bg-red-400 z-10"
                  style={{ left: todayOffset + dayWidth / 2, height: totalHeight }}
                />
              )}

              {/* Dependency arrows (SVG) */}
              <svg
                className="absolute top-0 left-0 z-[5] pointer-events-none"
                style={{ width: totalWidth, height: totalHeight }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
                  </marker>
                </defs>
                {dependencyArrows.map((arrow, i) => {
                  const midX = (arrow.fromX + arrow.toX) / 2;
                  return (
                    <g key={i}>
                      <path
                        d={`M ${arrow.fromX} ${arrow.fromY} C ${midX} ${arrow.fromY}, ${midX} ${arrow.toY}, ${arrow.toX} ${arrow.toY}`}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        markerEnd="url(#arrowhead)"
                        opacity="0.7"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Task bars */}
              {taskBars.map((bar) => {
                if (!bar.visible) {
                  // No dates — show placeholder
                  return (
                    <div
                      key={bar.task.id}
                      className="absolute flex items-center justify-center"
                      style={{
                        top: bar.rowIndex * ROW_HEIGHT + BAR_TOP_OFFSET,
                        left: 10,
                        height: BAR_HEIGHT,
                      }}
                    >
                      <span className="text-xs text-gray-400 italic">אין תאריכים</span>
                    </div>
                  );
                }

                const colors = STATUS_COLORS[bar.task.status] ?? STATUS_COLORS.TODO;
                const isDragging = dragState?.taskId === bar.task.id;
                const isLinking = linkingState !== null;
                const isLinkSource = linkingState?.fromTaskId === bar.task.id;
                const hasDeps = (bar.task.depends_on ?? []).length > 0;

                return (
                  <TooltipProvider key={bar.task.id}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div
                          className={`absolute group rounded-md border-2 ${colors.bg} ${colors.border} ${colors.text}
                            ${isDragging ? "opacity-80 shadow-lg z-30" : "z-10 hover:shadow-md"}
                            ${isLinking && !isLinkSource ? "ring-2 ring-indigo-400 cursor-crosshair" : ""}
                            ${isLinkSource ? "ring-2 ring-indigo-600 ring-offset-1" : ""}
                            transition-shadow select-none`}
                          style={{
                            top: bar.rowIndex * ROW_HEIGHT + BAR_TOP_OFFSET,
                            left: bar.left,
                            width: Math.max(dayWidth, bar.width),
                            height: BAR_HEIGHT,
                          }}
                          onClick={() => {
                            if (isLinking) {
                              handleLinkClick(bar.task.id);
                            }
                          }}
                          onDoubleClick={() => setSelectedTask(bar.task)}
                        >
                          {/* Resize handle - start (left) */}
                          <div
                            className="absolute top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/10 rounded-l"
                            style={{ left: 0 }}
                            onMouseDown={(e) =>
                              handleDragStart(e, bar.task.id, "resize-start", bar.start!, bar.end!)
                            }
                          />

                          {/* Move handle - center */}
                          <div
                            className="absolute inset-0 mx-2 cursor-grab active:cursor-grabbing flex items-center px-1 overflow-hidden"
                            onMouseDown={(e) =>
                              handleDragStart(e, bar.task.id, "move", bar.start!, bar.end!)
                            }
                          >
                            <GripVertical className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-40 mr-0.5" />
                            <span className="text-[11px] font-medium truncate">
                              {bar.width > dayWidth * 2 ? bar.task.title : ""}
                            </span>
                            {hasDeps && (
                              <Link2 className="h-3 w-3 flex-shrink-0 opacity-50 mr-auto" />
                            )}
                          </div>

                          {/* Resize handle - end (right) */}
                          <div
                            className="absolute top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/10 rounded-r"
                            style={{ right: 0 }}
                            onMouseDown={(e) =>
                              handleDragStart(e, bar.task.id, "resize-end", bar.start!, bar.end!)
                            }
                          />

                          {/* Progress fill for DONE */}
                          {bar.task.status === "DONE" && (
                            <div className="absolute inset-0 bg-emerald-400/30 rounded-md" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-right max-w-xs" dir="rtl">
                        <div className="font-semibold text-sm">{bar.task.title}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {bar.start && format(bar.start, "dd/MM/yyyy")}
                          {bar.start && bar.end && " → "}
                          {bar.end && format(bar.end, "dd/MM/yyyy")}
                        </div>
                        {bar.task.assignee_name && (
                          <div className="text-xs text-gray-500">אחראי: {bar.task.assignee_name}</div>
                        )}
                        {hasDeps && (
                          <div className="text-xs text-indigo-500 mt-1">
                            תלוי ב-{(bar.task.depends_on ?? []).length} משימות
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1">לחיצה כפולה לעריכה</div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dependency removal panel */}
      {selectedTask && (selectedTask.depends_on ?? []).length > 0 && (
        <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="text-sm font-medium text-indigo-700 mb-1">
            תלויות של &quot;{selectedTask.title}&quot;:
          </div>
          <div className="flex flex-wrap gap-1">
            {(selectedTask.depends_on ?? []).map((depId) => {
              const depTask = tasks.find((t) => t.id === depId);
              return (
                <Badge
                  key={depId}
                  variant="secondary"
                  className="bg-indigo-100 text-indigo-700 cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors"
                  onClick={() => handleRemoveDependency(selectedTask.id, depId)}
                >
                  {depTask?.title ?? "משימה לא נמצאה"}
                  <span className="mr-1 text-xs">✕</span>
                </Badge>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">לחץ על תלות כדי להסיר אותה</div>
        </div>
      )}

      {/* Task detail dialog */}
      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        profiles={profiles}
        currentUser={currentUser}
        onUpdate={updateTask}
        onStatusChange={updateTaskStatus}
      />

      {/* Task create dialog */}
      <TaskCreateDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
