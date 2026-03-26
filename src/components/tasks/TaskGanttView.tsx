import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useData, useAuth, type Task, type TaskStatus, type Goal } from "@/contexts/AppContext";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";
import {
  addDays,
  differenceInDays,
  format,
  startOfDay,
  isWeekend,
  isSameDay,
  isSameWeek,
  addWeeks,
  subWeeks,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
  isValid,
  isSameMonth,
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getGoalColor, type GoalColor, GOAL_PALETTE } from "./goalColors";
import GoalsManageDialog from "./GoalsManageDialog";

// --- Constants ---
const ROW_HEIGHT = 40;
const GROUP_HEADER_HEIGHT = 36;
const HEADER_HEIGHT = 52;
const MONTH_HEADER_HEIGHT = 24;
const TOTAL_HEADER_HEIGHT = HEADER_HEIGHT + MONTH_HEADER_HEIGHT;
const SIDEBAR_WIDTH = 280;
const MIN_DAY_WIDTH = 20;
const MAX_DAY_WIDTH = 80;
const DEFAULT_DAY_WIDTH = 36;
const BAR_HEIGHT = 26;
const BAR_TOP_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const WEEK_COL_WIDTH = 100;

const STATUS_ICONS: Record<string, string> = {
  TODO: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
  BLOCKED: "◆",
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

interface GoalGroup {
  goalName: string;
  color: GoalColor;
  colorIndex: number;
  tasks: Task[];
}

// Row types for unified layout
type RowItem =
  | { type: "group-header"; goalName: string; color: GoalColor; colorIndex: number; taskCount: number }
  | { type: "task"; task: Task; goalColor: GoalColor; goalColorIndex: number };

// ================================================
// MAIN COMPONENT
// ================================================
/** Build a GoalColor from a hex color string */
function goalColorFromHex(hex: string): GoalColor {
  // Find the closest palette entry, or build from hex
  const match = GOAL_PALETTE.find(p => p.bg === hex);
  if (match) return match;
  return {
    bg: hex,
    light: hex + "15",
    border: hex + "80",
    headerText: "#ffffff",
    barBg: "",
    barBorder: "",
    barText: "text-white",
  };
}

export default function TaskGanttView() {
  const { tasks, updateTask, updateTaskStatus, profiles, refreshTasks, goals, addGoal } = useData();
  const { currentUser } = useAuth();

  // State
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [ganttScale, setGanttScale] = useState<"day" | "week">("day");
  const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { locale: he }));
  const [selectedAssignee, setSelectedAssignee] = useState("all");
  const [selectedGoal, setSelectedGoal] = useState("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGoalsDialog, setShowGoalsDialog] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [linkingState, setLinkingState] = useState<LinkingState | null>(null);
  const [collapsedGoals, setCollapsedGoals] = useState<Set<string>>(new Set());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  // Number of visible days & effective pixel-per-day (changes with scale)
  const totalDays = ganttScale === "week" ? 26 * 7 : Math.max(42, Math.ceil(1100 / dayWidth));
  const effectiveDayWidth = ganttScale === "week" ? WEEK_COL_WIDTH / 7 : dayWidth;
  const totalWidth = ganttScale === "week" ? 26 * WEEK_COL_WIDTH : totalDays * dayWidth;

  // Generate day columns
  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(viewStart, i));
  }, [viewStart, totalDays]);

  // Week columns for week-scale header/grid
  const weekColumns = useMemo(() => {
    if (ganttScale !== "week") return [];
    return Array.from({ length: 26 }, (_, w) => ({
      weekStart: addDays(viewStart, w * 7),
      weekIndex: w,
    }));
  }, [ganttScale, viewStart]);

  // Month headers
  const monthHeaders = useMemo(() => {
    const months: { label: string; startCol: number; span: number }[] = [];
    let currentMonth = -1;
    let currentYear = -1;
    let startCol = 0;

    days.forEach((day, i) => {
      const m = day.getMonth();
      const y = day.getFullYear();
      if (m !== currentMonth || y !== currentYear) {
        if (months.length > 0) {
          months[months.length - 1].span = i - startCol;
        }
        months.push({ label: format(day, "MMMM yyyy", { locale: he }), startCol: i, span: 0 });
        currentMonth = m;
        currentYear = y;
        startCol = i;
      }
    });
    if (months.length > 0) {
      months[months.length - 1].span = days.length - months[months.length - 1].startCol;
    }
    return months;
  }, [days]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) => !t.is_daily);
    if (selectedAssignee !== "all") {
      list = list.filter((t) => t.assignee_id === selectedAssignee);
    }
    if (selectedGoal !== "all") {
      if (selectedGoal === "__none__") {
        list = list.filter((t) => !t.milestone);
      } else {
        list = list.filter((t) => t.milestone === selectedGoal);
      }
    }
    list.sort((a, b) => {
      const aStart = parseDateSafe(a.start_date)?.getTime() ?? Infinity;
      const bStart = parseDateSafe(b.start_date)?.getTime() ?? Infinity;
      if (aStart !== bStart) return aStart - bStart;
      const aDue = parseDateSafe(a.due_date)?.getTime() ?? Infinity;
      const bDue = parseDateSafe(b.due_date)?.getTime() ?? Infinity;
      return aDue - bDue;
    });
    return list;
  }, [tasks, selectedAssignee, selectedGoal]);

  // Build a map from goal name -> DB goal for color lookup
  const goalByName = useMemo(() => {
    const map = new Map<string, Goal>();
    goals.forEach(g => map.set(g.name, g));
    return map;
  }, [goals]);

  // Group tasks by milestone, ordered by DB goal sort_order
  const goalGroups = useMemo((): GoalGroup[] => {
    const groupMap = new Map<string, Task[]>();

    for (const task of filteredTasks) {
      const goal = task.milestone || "__אחר__";
      if (!groupMap.has(goal)) {
        groupMap.set(goal, []);
      }
      groupMap.get(goal)!.push(task);
    }

    // Build groups: first DB goals in sort_order, then any milestone-only groups, then "אחר"
    const result: GoalGroup[] = [];
    const used = new Set<string>();

    // 1. DB goals in order
    for (const dbGoal of goals) {
      if (groupMap.has(dbGoal.name)) {
        result.push({
          goalName: dbGoal.name,
          color: goalColorFromHex(dbGoal.color),
          colorIndex: result.length,
          tasks: groupMap.get(dbGoal.name)!,
        });
        used.add(dbGoal.name);
      }
    }

    // 2. Milestones not in DB goals
    for (const [name, tasks] of groupMap) {
      if (name !== "__אחר__" && !used.has(name)) {
        result.push({
          goalName: name,
          color: getGoalColor(result.length),
          colorIndex: result.length,
          tasks,
        });
      }
    }

    // 3. "אחר" last
    if (groupMap.has("__אחר__")) {
      result.push({
        goalName: "__אחר__",
        color: getGoalColor(result.length),
        colorIndex: result.length,
        tasks: groupMap.get("__אחר__")!,
      });
    }

    return result;
  }, [filteredTasks, goals]);

  // Build flat row list (group headers + tasks)
  const rows = useMemo((): RowItem[] => {
    const result: RowItem[] = [];
    for (const group of goalGroups) {
      result.push({
        type: "group-header",
        goalName: group.goalName,
        color: group.color,
        colorIndex: group.colorIndex,
        taskCount: group.tasks.length,
      });
      if (!collapsedGoals.has(group.goalName)) {
        for (const task of group.tasks) {
          result.push({
            type: "task",
            task,
            goalColor: group.color,
            goalColorIndex: group.colorIndex,
          });
        }
      }
    }
    return result;
  }, [goalGroups, collapsedGoals]);

  // All unique milestones for the filter (DB goals first, then any orphan milestones)
  const allMilestones = useMemo(() => {
    const fromDb = goals.map(g => g.name);
    const fromTasks = new Set<string>();
    tasks.forEach((t) => { if (t.milestone) fromTasks.add(t.milestone); });
    // Merge: DB goals first, then any extra milestones from tasks
    const all = [...fromDb];
    for (const m of fromTasks) {
      if (!all.includes(m)) all.push(m);
    }
    return all;
  }, [tasks, goals]);

  // Zoom
  const zoomIn = () => setDayWidth((w) => clamp(w + 6, MIN_DAY_WIDTH, MAX_DAY_WIDTH));
  const zoomOut = () => setDayWidth((w) => clamp(w - 6, MIN_DAY_WIDTH, MAX_DAY_WIDTH));

  // Navigate
  const goBack = () => setViewStart((d) => ganttScale === "week" ? subWeeks(d, 4) : subWeeks(d, 1));
  const goForward = () => setViewStart((d) => ganttScale === "week" ? addWeeks(d, 4) : addWeeks(d, 1));
  const goToday = () => setViewStart(startOfWeek(new Date(), { locale: he }));

  // Toggle collapse
  const toggleCollapse = useCallback((goalName: string) => {
    setCollapsedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalName)) next.delete(goalName);
      else next.add(goalName);
      return next;
    });
  }, []);

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

      const daysDelta = Math.round(dragDelta / effectiveDayWidth);
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
  }, [dragState, dragDelta, effectiveDayWidth, updateTask]);

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

  // --- Compute Y positions for each row ---
  const rowPositions = useMemo(() => {
    const positions: { top: number; height: number }[] = [];
    let y = 0;
    for (const row of rows) {
      const h = row.type === "group-header" ? GROUP_HEADER_HEIGHT : ROW_HEIGHT;
      positions.push({ top: y, height: h });
      y += h;
    }
    return positions;
  }, [rows]);

  const totalHeight = rowPositions.length > 0
    ? rowPositions[rowPositions.length - 1].top + rowPositions[rowPositions.length - 1].height
    : 0;

  // --- Compute bar positions ---
  const taskBars = useMemo(() => {
    return rows
      .map((row, rowIndex) => {
        if (row.type !== "task") return null;
        const { task, goalColor } = row;
        const start = parseDateSafe(task.start_date);
        const end = parseDateSafe(task.due_date);
        const { top } = rowPositions[rowIndex];

        if (!start && !end) {
          return { task, rowIndex, visible: false, left: 0, width: 0, start: null, end: null, top, goalColor };
        }

        const barStart = start ?? end!;
        const barEnd = end ?? start!;
        const startDay = differenceInDays(startOfDay(barStart), startOfDay(viewStart));
        const duration = Math.max(1, differenceInDays(startOfDay(barEnd), startOfDay(barStart)) + 1);

        let left = startDay * effectiveDayWidth;
        let width = duration * effectiveDayWidth;

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
          width = Math.max(effectiveDayWidth, width);
        }

        return { task, rowIndex, visible: true, left, width, start: barStart, end: barEnd, top, goalColor };
      })
      .filter(Boolean) as {
        task: Task; rowIndex: number; visible: boolean;
        left: number; width: number; start: Date | null; end: Date | null;
        top: number; goalColor: GoalColor;
      }[];
  }, [rows, rowPositions, viewStart, effectiveDayWidth, dragState, dragDelta]);

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
        const fromY = depBar.top + ROW_HEIGHT / 2;
        const toX = bar.left;
        const toY = bar.top + ROW_HEIGHT / 2;

        arrows.push({ fromX, fromY, toX, toY, taskId: bar.task.id, depId });
      }
    }
    return arrows;
  }, [taskBars]);

  const todayOffset = useMemo(() => {
    return differenceInDays(startOfDay(new Date()), startOfDay(viewStart)) * effectiveDayWidth;
  }, [viewStart, effectiveDayWidth]);

  // Sync sidebar scroll with timeline scroll
  const handleTimelineScroll = useCallback(() => {
    if (scrollContainerRef.current && sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = scrollContainerRef.current.scrollTop;
    }
  }, []);

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

        <Button
          variant={ganttScale === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => setGanttScale(s => s === "day" ? "week" : "day")}
        >
          {ganttScale === "week" ? "יומי" : "שבועי"}
        </Button>

        {ganttScale === "day" && (
          <div className="flex items-center gap-1 mr-2">
            <Button variant="outline" size="sm" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
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

        <Select value={selectedGoal} onValueChange={setSelectedGoal}>
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder="כל המטרות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המטרות</SelectItem>
            {allMilestones.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
            <SelectItem value="__none__">ללא מטרה</SelectItem>
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

        <Button variant="outline" size="sm" onClick={() => setShowGoalsDialog(true)}>
          ניהול מטרות
        </Button>

        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 ml-1" />
          משימה חדשה
        </Button>
      </div>

      {/* Gantt Area */}
      <div className="flex-1 border rounded-lg overflow-hidden bg-white flex flex-row-reverse">
        {/* Sidebar - Task list */}
        <div
          className="border-l bg-gray-50 flex-shrink-0 overflow-hidden flex flex-col"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Sidebar header */}
          <div
            className="border-b bg-gray-100 flex items-center px-3 font-semibold text-sm text-gray-600 flex-shrink-0"
            style={{ height: TOTAL_HEADER_HEIGHT }}
          >
            משימות ({filteredTasks.length})
          </div>
          {/* Sidebar rows */}
          <div
            ref={sidebarScrollRef}
            className="overflow-hidden flex-1"
          >
            <div style={{ height: totalHeight }}>
              {rows.map((row, i) => {
                const pos = rowPositions[i];
                if (row.type === "group-header") {
                  const isCollapsed = collapsedGoals.has(row.goalName);
                  const displayName = row.goalName === "__אחר__" ? "אחר" : row.goalName;
                  return (
                    <div
                      key={`group-${row.goalName}`}
                      className="flex items-center gap-2 px-2 cursor-pointer select-none"
                      style={{
                        height: pos.height,
                        background: row.color.bg,
                        color: row.color.headerText,
                      }}
                      onClick={() => toggleCollapse(row.goalName)}
                    >
                      {isCollapsed
                        ? <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                        : <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      }
                      <span className="text-sm font-bold truncate flex-1">{displayName}</span>
                      <span className="text-xs opacity-80">{row.taskCount}</span>
                    </div>
                  );
                }

                // Task row
                const { task, goalColor } = row;
                return (
                  <div
                    key={task.id}
                    className="flex items-center px-2 gap-2 border-b border-gray-100 cursor-pointer hover:bg-gray-100/70 transition-colors"
                    style={{
                      height: pos.height,
                      borderRight: `4px solid ${goalColor.bg}`,
                    }}
                    onClick={() => setSelectedTask(task)}
                  >
                    <span className="text-xs flex-shrink-0 opacity-60" title={task.status}>
                      {STATUS_ICONS[task.status] || "○"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate font-medium leading-tight">{task.title}</div>
                      {task.assignee_name && (
                        <div className="text-[11px] text-gray-400 truncate leading-tight">{task.assignee_name}</div>
                      )}
                    </div>
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
        </div>

        {/* Timeline */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto relative"
          style={{ direction: "ltr" }}
          onScroll={handleTimelineScroll}
        >
          <div style={{ width: totalWidth, minHeight: TOTAL_HEADER_HEIGHT + totalHeight }}>
            {/* Date headers */}
            <div className="sticky top-0 z-20 bg-white border-b" style={{ height: TOTAL_HEADER_HEIGHT }}>
              {/* Month row */}
              <div className="relative border-b" style={{ height: MONTH_HEADER_HEIGHT }}>
                {monthHeaders.map((mh, i) => (
                  <div
                    key={i}
                    className="absolute top-0 text-center text-xs font-semibold text-gray-700 bg-gray-50 border-r flex items-center justify-center"
                    style={{
                      left: mh.startCol * effectiveDayWidth,
                      width: mh.span * effectiveDayWidth,
                      height: MONTH_HEADER_HEIGHT,
                    }}
                  >
                    {mh.label}
                  </div>
                ))}
              </div>
              {/* Day / Week row */}
              <div className="relative" style={{ height: HEADER_HEIGHT }}>
                {ganttScale === "day" ? (
                  days.map((day, i) => {
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
                            : "text-gray-500"
                        }`}
                        style={{
                          left: i * dayWidth,
                          width: dayWidth,
                          height: HEADER_HEIGHT,
                        }}
                      >
                        <div className="text-[9px] mt-0.5">{format(day, "EEE", { locale: he })}</div>
                        <div className="text-[11px]">{format(day, "d")}</div>
                      </div>
                    );
                  })
                ) : (
                  weekColumns.map((wc, i) => {
                    const isCurrentWeek = isSameWeek(new Date(), wc.weekStart, { locale: he });
                    const weekEnd = addDays(wc.weekStart, 6);
                    const label = `${format(wc.weekStart, "d/M")} – ${format(weekEnd, "d/M")}`;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 border-r text-center select-none ${
                          isCurrentWeek ? "bg-blue-50 font-bold text-blue-600" : "text-gray-500"
                        }`}
                        style={{
                          left: i * WEEK_COL_WIDTH,
                          width: WEEK_COL_WIDTH,
                          height: HEADER_HEIGHT,
                        }}
                      >
                        <div className="text-[9px] mt-1 text-gray-400">שבוע {wc.weekIndex + 1}</div>
                        <div className="text-[10px] mt-0.5">{label}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Grid + Bars area */}
            <div className="relative" style={{ height: totalHeight }}>
              {/* Grid lines */}
              {ganttScale === "day" ? (
                days.map((day, i) => {
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
                })
              ) : (
                weekColumns.map((wc, i) => {
                  const isCurrentWeek = isSameWeek(new Date(), wc.weekStart, { locale: he });
                  return (
                    <div
                      key={i}
                      className={`absolute top-0 border-r ${isCurrentWeek ? "bg-blue-50/30" : ""}`}
                      style={{
                        left: i * WEEK_COL_WIDTH,
                        width: WEEK_COL_WIDTH,
                        height: totalHeight,
                      }}
                    />
                  );
                })
              )}

              {/* Group header backgrounds + row separators */}
              {rows.map((row, i) => {
                const pos = rowPositions[i];
                if (row.type === "group-header") {
                  return (
                    <div
                      key={`ghbg-${row.goalName}`}
                      className="absolute w-full"
                      style={{
                        top: pos.top,
                        height: pos.height,
                        backgroundColor: row.color.light,
                        borderBottom: `1px solid ${row.color.border}`,
                      }}
                    />
                  );
                }
                return (
                  <div
                    key={`sep-${row.task.id}`}
                    className="absolute w-full border-b border-gray-100"
                    style={{ top: pos.top + pos.height }}
                  />
                );
              })}

              {/* Today line */}
              {todayOffset >= 0 && todayOffset <= totalWidth && (
                <div
                  className="absolute top-0 w-0.5 bg-red-400 z-10"
                  style={{ left: todayOffset + effectiveDayWidth / 2, height: totalHeight }}
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
                  return (
                    <div
                      key={bar.task.id}
                      className="absolute flex items-center justify-center"
                      style={{
                        top: bar.top + BAR_TOP_OFFSET,
                        left: 10,
                        height: BAR_HEIGHT,
                      }}
                    >
                      <span className="text-xs text-gray-400 italic">אין תאריכים</span>
                    </div>
                  );
                }

                const isDragging = dragState?.taskId === bar.task.id;
                const isLinking = linkingState !== null;
                const isLinkSource = linkingState?.fromTaskId === bar.task.id;
                const hasDeps = (bar.task.depends_on ?? []).length > 0;
                const isDone = bar.task.status === "DONE";

                return (
                  <TooltipProvider key={bar.task.id}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div
                          className={`absolute group rounded-md border
                            ${isDragging ? "opacity-80 shadow-lg z-30" : "z-10 hover:shadow-md"}
                            ${isLinking && !isLinkSource ? "ring-2 ring-indigo-400 cursor-crosshair" : ""}
                            ${isLinkSource ? "ring-2 ring-indigo-600 ring-offset-1" : ""}
                            ${isDone ? "opacity-70" : ""}
                            transition-shadow select-none cursor-default`}
                          style={{
                            top: bar.top + BAR_TOP_OFFSET,
                            left: bar.left,
                            width: Math.max(effectiveDayWidth, bar.width),
                            height: BAR_HEIGHT,
                            backgroundColor: bar.goalColor.bg,
                            borderColor: bar.goalColor.border,
                            color: bar.goalColor.headerText,
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
                            className="absolute top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 rounded-l"
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
                            <span className="text-[11px] font-medium truncate drop-shadow-sm">
                              {bar.width > effectiveDayWidth * 2 ? bar.task.title : ""}
                            </span>
                            {hasDeps && (
                              <Link2 className="h-3 w-3 flex-shrink-0 opacity-60 mr-auto" />
                            )}
                          </div>

                          {/* Resize handle - end (right) */}
                          <div
                            className="absolute top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 rounded-r"
                            style={{ right: 0 }}
                            onMouseDown={(e) =>
                              handleDragStart(e, bar.task.id, "resize-end", bar.start!, bar.end!)
                            }
                          />

                          {/* Done strikethrough effect */}
                          {isDone && (
                            <div className="absolute inset-0 bg-white/20 rounded-md" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-right max-w-xs" dir="rtl">
                        <div className="font-semibold text-sm">{bar.task.title}</div>
                        {bar.task.milestone && (
                          <div className="text-xs text-gray-400">{bar.task.milestone}</div>
                        )}
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

      {/* Goals management dialog */}
      <GoalsManageDialog open={showGoalsDialog} onOpenChange={setShowGoalsDialog} />
    </div>
  );
}
