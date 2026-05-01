import { describe, it, expect } from "vitest";
import { taskSchema } from "./taskSchema";

describe("taskSchema", () => {
  it("accepts a minimal valid task and applies defaults", () => {
    const r = taskSchema.safeParse({ title: "Do thing" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.priority).toBe("בינוני");
      expect(r.data.status).toBe("TODO");
    }
  });

  it("rejects empty title", () => {
    expect(taskSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("accepts every valid status", () => {
    for (const status of ["TODO", "IN_PROGRESS", "DONE", "TEMPLATE"] as const) {
      expect(taskSchema.safeParse({ title: "x", status }).success).toBe(true);
    }
  });

  it("rejects an invalid status", () => {
    expect(
      taskSchema.safeParse({ title: "x", status: "BLOCKED" as never }).success
    ).toBe(false);
  });

  it("rejects an invalid priority", () => {
    expect(
      taskSchema.safeParse({ title: "x", priority: "low" as never }).success
    ).toBe(false);
  });
});
