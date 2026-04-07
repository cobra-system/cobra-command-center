import React, { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { logActivity } from "@/lib/activityLogger";
import type { Session } from "@supabase/supabase-js";
import type { Task, TaskStatus } from "@/contexts/types";

const taskStatusLabel: Record<string, string> = { TODO: "לביצוע", IN_PROGRESS: "בביצוע", DONE: "הושלם", BLOCKED: "חסום" };

interface TasksState {
  tasks: Task[];
  refreshTasks: () => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  addTaskNote: (taskId: string, note: string) => Promise<void>;
  addTask: (task: Omit<Task, "id">) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  resetDailyTasks: () => Promise<void>;
}

const TasksContext = createContext<TasksState | null>(null);

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be within TasksProvider");
  return ctx;
}

export function TasksProvider({ session, children }: { session: Session | null; children: ReactNode }) {
  const queryClient = useQueryClient();
  const ownMutationIds = useRef<Set<string>>(new Set());

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").neq("status", "TEMPLATE").order("created_at", { ascending: false }).limit(500);
      return (data as Task[]) ?? [];
    },
  });

  const refreshTasks = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }, [queryClient]);

  // Realtime subscription for tasks
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          const taskId = (payload.new as Record<string, unknown>)?.id || (payload.old as Record<string, unknown>)?.id;

          // Skip notifications for own mutations
          if (ownMutationIds.current.has(taskId)) {
            ownMutationIds.current.delete(taskId);
            return;
          }

          if (payload.eventType === 'UPDATE') {
            const newTask = payload.new as Task;
            const oldTask = payload.old as Record<string, unknown>;

            queryClient.setQueryData(["tasks"], (prev: Task[]) => prev.map(t => t.id === newTask.id ? newTask : t));

            // Show notification for status changes
            if (oldTask.status && oldTask.status !== newTask.status) {
              const statusText = taskStatusLabel[newTask.status] || newTask.status;
              toast.info(`📋 "${newTask.title}" → ${statusText}`, {
                description: newTask.assignee_name ? `עודכן ע״י ${newTask.assignee_name}` : undefined,
              });
            }
          } else if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task;
            queryClient.setQueryData(["tasks"], (prev: Task[]) => [newTask, ...prev]);
            toast.info(`📋 משימה חדשה: "${newTask.title}"`);
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Record<string, unknown>).id as string;
            queryClient.setQueryData(["tasks"], (prev: Task[]) => prev.filter(t => t.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, queryClient]);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    ownMutationIds.current.add(taskId);
    const prevTasks = queryClient.getQueryData<Task[]>(["tasks"]);
    const completedAt = status === "DONE" ? new Date().toISOString() : null;
    queryClient.setQueryData(["tasks"], (prev: Task[]) => prev.map(t => t.id === taskId ? { ...t, status, completed_at: completedAt } : t));
    const { error } = await supabase.from("tasks").update({ status, completed_at: completedAt }).eq("id", taskId);
    if (error) {
      queryClient.setQueryData(["tasks"], prevTasks);
      handleError(error, "שגיאה בעדכון משימה: " + (error.message || "נסה שוב"));
    }
  }, [queryClient]);

  const addTaskNote = useCallback(async (taskId: string, note: string) => {
    ownMutationIds.current.add(taskId);
    const prevTasks = queryClient.getQueryData<Task[]>(["tasks"]);
    queryClient.setQueryData(["tasks"], (prev: Task[]) => prev.map(t => t.id === taskId ? { ...t, notes: note } : t));
    const { error } = await supabase.from("tasks").update({ notes: note }).eq("id", taskId);
    if (error) {
      queryClient.setQueryData(["tasks"], prevTasks);
      handleError(error, "שגיאה בשמירת הערה: " + (error.message || "נסה שוב"));
    }
  }, [queryClient]);

  const addTask = useCallback(async (task: Omit<Task, "id">) => {
    try {
      const { error } = await supabase.from("tasks").insert(task);
      if (error) throw error;
      await refreshTasks();
      toast.success("משימה נוצרה בהצלחה");
      logActivity({ action: "task.create", entityType: "task", details: { title: task.title } });
    } catch (err) {
      handleError(err, "שגיאה ביצירת משימה: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshTasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    ownMutationIds.current.add(id);
    const prevTasks = queryClient.getQueryData<Task[]>(["tasks"]);
    queryClient.setQueryData(["tasks"], (prev: Task[]) => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) {
      queryClient.setQueryData(["tasks"], prevTasks);
      handleError(error, "שגיאה בעדכון משימה: " + (error.message || "נסה שוב"));
    } else {
      logActivity({ action: "task.update", entityType: "task", entityId: id });
    }
  }, [queryClient]);

  const deleteTask = useCallback(async (id: string) => {
    ownMutationIds.current.add(id);
    const prevTasks = queryClient.getQueryData<Task[]>(["tasks"]);
    queryClient.setQueryData(["tasks"], (prev: Task[]) => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      queryClient.setQueryData(["tasks"], prevTasks);
      handleError(error, "שגיאה במחיקת משימה: " + (error.message || "נסה שוב"));
      throw error;
    }
    logActivity({ action: "task.delete", entityType: "task", entityId: id });
  }, [queryClient]);

  const resetDailyTasks = useCallback(async () => {
    const currentTasks = queryClient.getQueryData<Task[]>(["tasks"]) ?? [];
    const dailyTasks = currentTasks.filter(t => t.is_daily && t.status !== "TODO");
    queryClient.setQueryData(["tasks"], (prev: Task[]) => prev.map(t => t.is_daily ? { ...t, status: "TODO" } : t));
    for (const t of dailyTasks) {
      ownMutationIds.current.add(t.id);
      await supabase.from("tasks").update({ status: "TODO" }).eq("id", t.id);
    }
  }, [queryClient]);

  return (
    <TasksContext.Provider value={{
      tasks,
      refreshTasks,
      updateTaskStatus,
      addTaskNote,
      addTask,
      updateTask,
      deleteTask,
      resetDailyTasks,
    }}>
      {children}
    </TasksContext.Provider>
  );
}
