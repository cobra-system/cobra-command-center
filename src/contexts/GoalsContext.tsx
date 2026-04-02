import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { logger } from "@/lib/logger";
import type { Goal } from "@/contexts/types";

interface GoalsState {
  goals: Goal[];
  refreshGoals: () => Promise<void>;
  addGoal: (goal: Omit<Goal, "id">) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

const GoalsContext = createContext<GoalsState | null>(null);

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals must be within GoalsProvider");
  return ctx;
}

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);

  const refreshGoals = useCallback(async () => {
    const { data, error } = await supabase.from("goals").select("*").order("sort_order");
    if (error) {
      if (error.message?.includes("schema cache") || error.code === "42P01") {
        logger.warn("goals table missing — run migration via Supabase SQL Editor");
      }
      return;
    }
    if (data) setGoals(data as Goal[]);
  }, []);

  const addGoal = useCallback(async (goal: Omit<Goal, "id">) => {
    const { error } = await supabase.from("goals").insert(goal);
    if (error) {
      if (error.message?.includes("schema cache") || error.code === "42P01") {
        handleError(error, "טבלת מטרות-על לא נמצאה. יש להריץ את המיגרציה דרך Supabase SQL Editor — ראה קונסול לפרטים.");
      } else {
        handleError(error, "שגיאה ביצירת מטרה: " + (error.message || "נסה שוב"));
      }
      return;
    }
    await refreshGoals();
    toast.success("מטרה נוספה");
  }, [refreshGoals]);

  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    const prev = goals;
    setGoals(g => g.map(item => item.id === id ? { ...item, ...updates } : item));
    const { error } = await supabase.from("goals").update(updates).eq("id", id);
    if (error) {
      setGoals(prev);
      handleError(error, "שגיאה בעדכון מטרה: " + (error.message || "נסה שוב"));
    }
  }, [goals]);

  const deleteGoal = useCallback(async (id: string) => {
    const prev = goals;
    setGoals(g => g.filter(item => item.id !== id));
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) {
      setGoals(prev);
      handleError(error, "שגיאה במחיקת מטרה: " + (error.message || "נסה שוב"));
    }
  }, [goals]);

  return (
    <GoalsContext.Provider value={{ goals, refreshGoals, addGoal, updateGoal, deleteGoal }}>
      {children}
    </GoalsContext.Provider>
  );
}
