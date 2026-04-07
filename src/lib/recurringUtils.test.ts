import { describe, it, expect } from "vitest";
import { recurringMatchesDay } from "./recurringUtils";
import type { Task } from "@/contexts/AppContext";

const makeTemplate = (overrides: Partial<Task> = {}): Task =>
  ({
    id: "rt1",
    title: "Recurring",
    status: "TEMPLATE",
    frequency: "daily",
    day_of_week: null,
    day_of_month: null,
    ...overrides,
  }) as Task;

describe("recurringMatchesDay", () => {
  describe("daily", () => {
    it("always matches", () => {
      const rt = makeTemplate({ frequency: "daily" });
      expect(recurringMatchesDay(rt, new Date("2024-06-10"))).toBe(true);
      expect(recurringMatchesDay(rt, new Date("2024-12-25"))).toBe(true);
    });
  });

  describe("weekly", () => {
    it("matches when day_of_week matches", () => {
      // 2024-06-10 is a Monday (day 1)
      const rt = makeTemplate({ frequency: "weekly", day_of_week: 1 });
      expect(recurringMatchesDay(rt, new Date("2024-06-10"))).toBe(true);
    });

    it("does not match on wrong day", () => {
      const rt = makeTemplate({ frequency: "weekly", day_of_week: 3 }); // Wednesday
      expect(recurringMatchesDay(rt, new Date("2024-06-10"))).toBe(false); // Monday
    });
  });

  describe("biweekly", () => {
    it("matches on correct day_of_week in even weeks", () => {
      const rt = makeTemplate({ frequency: "biweekly", day_of_week: 1 });
      // Test two consecutive Mondays — one should match, one shouldn't
      const mon1 = new Date("2024-06-10"); // Monday
      const mon2 = new Date("2024-06-17"); // next Monday
      const results = [
        recurringMatchesDay(rt, mon1),
        recurringMatchesDay(rt, mon2),
      ];
      // Exactly one should be true
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("does not match on wrong day_of_week", () => {
      const rt = makeTemplate({ frequency: "biweekly", day_of_week: 3 });
      expect(recurringMatchesDay(rt, new Date("2024-06-10"))).toBe(false); // Monday
    });
  });

  describe("monthly", () => {
    it("matches when day_of_month matches", () => {
      const rt = makeTemplate({ frequency: "monthly", day_of_month: 15 });
      expect(recurringMatchesDay(rt, new Date("2024-06-15"))).toBe(true);
      expect(recurringMatchesDay(rt, new Date("2024-07-15"))).toBe(true);
    });

    it("does not match on wrong day", () => {
      const rt = makeTemplate({ frequency: "monthly", day_of_month: 15 });
      expect(recurringMatchesDay(rt, new Date("2024-06-10"))).toBe(false);
    });
  });

  describe("quarterly", () => {
    it("matches on correct day in quarter-start months (Jan, Apr, Jul, Oct)", () => {
      const rt = makeTemplate({ frequency: "quarterly", day_of_month: 1 });
      expect(recurringMatchesDay(rt, new Date("2024-01-01"))).toBe(true); // Jan
      expect(recurringMatchesDay(rt, new Date("2024-04-01"))).toBe(true); // Apr
      expect(recurringMatchesDay(rt, new Date("2024-07-01"))).toBe(true); // Jul
      expect(recurringMatchesDay(rt, new Date("2024-10-01"))).toBe(true); // Oct
    });

    it("does not match in non-quarter months", () => {
      const rt = makeTemplate({ frequency: "quarterly", day_of_month: 1 });
      expect(recurringMatchesDay(rt, new Date("2024-02-01"))).toBe(false);
      expect(recurringMatchesDay(rt, new Date("2024-06-01"))).toBe(false);
    });
  });

  describe("biannual", () => {
    it("matches in January and July on correct day", () => {
      const rt = makeTemplate({ frequency: "biannual", day_of_month: 10 });
      expect(recurringMatchesDay(rt, new Date("2024-01-10"))).toBe(true);
      expect(recurringMatchesDay(rt, new Date("2024-07-10"))).toBe(true);
    });

    it("does not match in other months", () => {
      const rt = makeTemplate({ frequency: "biannual", day_of_month: 10 });
      expect(recurringMatchesDay(rt, new Date("2024-06-10"))).toBe(false);
    });
  });

  describe("annual", () => {
    it("matches in January on correct day", () => {
      const rt = makeTemplate({ frequency: "annual", day_of_month: 1 });
      expect(recurringMatchesDay(rt, new Date("2024-01-01"))).toBe(true);
    });

    it("does not match in other months", () => {
      const rt = makeTemplate({ frequency: "annual", day_of_month: 1 });
      expect(recurringMatchesDay(rt, new Date("2024-06-01"))).toBe(false);
    });
  });

  describe("unknown frequency", () => {
    it("returns false", () => {
      const rt = makeTemplate({ frequency: "unknown" as any });
      expect(recurringMatchesDay(rt, new Date("2024-06-10"))).toBe(false);
    });
  });
});
