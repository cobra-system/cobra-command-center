import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getOverdueTasksToAdvance,
  advanceTaskToToday,
  formatAdvancementSummary,
} from "./advanceOverdueTasksUtils";
import type { Task } from "@/contexts/AppContext";

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: "t1",
    title: "Test task",
    status: "TODO",
    priority: "בינוני",
    due_date: null,
    ...overrides,
  }) as Task;

describe("getOverdueTasksToAdvance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns tasks with past due dates", () => {
    const tasks = [makeTask({ due_date: "2024-06-10" })];
    expect(getOverdueTasksToAdvance(tasks)).toHaveLength(1);
  });

  it("excludes tasks without due_date", () => {
    const tasks = [makeTask({ due_date: null })];
    expect(getOverdueTasksToAdvance(tasks)).toHaveLength(0);
  });

  it("excludes tasks with DONE status", () => {
    const tasks = [makeTask({ due_date: "2024-06-10", status: "DONE" })];
    expect(getOverdueTasksToAdvance(tasks)).toHaveLength(0);
  });

  it("excludes tasks due today", () => {
    const tasks = [makeTask({ due_date: "2024-06-15" })];
    expect(getOverdueTasksToAdvance(tasks)).toHaveLength(0);
  });

  it("excludes tasks with future due dates", () => {
    const tasks = [makeTask({ due_date: "2024-06-20" })];
    expect(getOverdueTasksToAdvance(tasks)).toHaveLength(0);
  });

  it("handles mixed tasks correctly", () => {
    const tasks = [
      makeTask({ id: "1", due_date: "2024-06-10", status: "TODO" }),
      makeTask({ id: "2", due_date: "2024-06-15", status: "TODO" }), // today
      makeTask({ id: "3", due_date: "2024-06-20", status: "TODO" }), // future
      makeTask({ id: "4", due_date: "2024-06-01", status: "DONE" }), // done
      makeTask({ id: "5", due_date: null, status: "TODO" }), // no date
      makeTask({ id: "6", due_date: "2024-05-01", status: "IN_PROGRESS" }), // overdue
    ];
    const result = getOverdueTasksToAdvance(tasks);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["1", "6"]);
  });
});

describe("advanceTaskToToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns due_date set to start of today", () => {
    const task = makeTask({ due_date: "2024-06-10" });
    const update = advanceTaskToToday(task);
    expect(update.due_date).toBeDefined();
    const date = new Date(update.due_date!);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(5); // June = 5
    expect(date.getDate()).toBe(15);
  });
});

describe("formatAdvancementSummary", () => {
  it("handles zero tasks", () => {
    expect(formatAdvancementSummary(0)).toContain("No overdue");
  });

  it("handles single task", () => {
    expect(formatAdvancementSummary(1)).toContain("1 overdue task");
  });

  it("handles multiple tasks", () => {
    const msg = formatAdvancementSummary(5);
    expect(msg).toContain("5");
    expect(msg).toContain("overdue tasks");
  });
});
