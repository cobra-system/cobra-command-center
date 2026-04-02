import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const ownMutationIds = useRef<Set<string>>(new Set());

  const refreshTasks = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").neq("status", "TEMPLATE").order("created_at", { ascending: false }).limit(500);
    if (data) setTasks(data as Task[]);
  }, []);

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

            setTasks(prev => prev.map(t => t.id === newTask.id ? newTask : t));

            // Show notification for status changes
            if (oldTask.status && oldTask.status !== newTask.status) {
              const statusText = taskStatusLabel[newTask.status] || newTask.status;
              toast.info(`📋 "${newTask.title}" → ${statusText}`, {
                description: newTask.assignee_name ? `עודכן ע״י ${newTask.assignee_name}` : undefined,
              });
            }
          } else if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task;
            setTasks(prev => [newTask, ...prev]);
            toast.info(`📋 משימה חדשה: "${newTask.title}"`);
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Record<string, unknown>).id as string;
            setTasks(prev => prev.filter(t => t.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    ownMutationIds.current.add(taskId);
    const prevTasks = tasks;
    const completedAt = status === "DONE" ? new Date().toISOString() : null;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, completed_at: completedAt } : t));
    const { error } = await supabase.from("tasks").update({ status, completed_at: completedAt }).eq("id", taskId);
    if (error) {
      setTasks(prevTasks);
      handleError(error, "שגיאה בעדכון משימה: " + (error.message || "נסה שוב"));
    }
  }, [tasks]);

  const addTaskNote = useCallback(async (taskId: string, note: string) => {
    ownMutationIds.current.add(taskId);
    const prevTasks = tasks;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: note } : t));
    const { error } = await supabase.from("tasks").update({ notes: note }).eq("id", taskId);
    if (error) {
      setTasks(prevTasks);
      handleError(error, "שגיאה בשמירת הערה: " + (error.message || "נסה שוב"));
    }
  }, [tasks]);

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
    const prevTasks = tasks;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) {
      setTasks(prevTasks);
      handleError(error, "שגיאה בעדכון משימה: " + (error.message || "נסה שוב"));
    } else {
      logActivity({ action: "task.update", entityType: "task", entityId: id });
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    ownMutationIds.current.add(id);
    const prevTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      setTasks(prevTasks);
      handleError(error, "שגיאה במחיקת משימה: " + (error.message || "נסה שוב"));
      throw error;
    }
    logActivity({ action: "task.delete", entityType: "task", entityId: id });
  }, [tasks]);

  const resetDailyTasks = useCallback(async () => {
    const dailyTasks = tasks.filter(t => t.is_daily && t.status !== "TODO");
    setTasks(prev => prev.map(t => t.is_daily ? { ...t, status: "TODO" } : t));
    for (const t of dailyTasks) {
      ownMutationIds.current.add(t.id);
      await supabase.from("tasks").update({ status: "TODO" }).eq("id", t.id);
    }
  }, [tasks]);

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
