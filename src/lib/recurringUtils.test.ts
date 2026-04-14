import { describe, it, expect } from "vitest";
import { recurringMatchesDay, getNextOccurrenceDate } from "./recurringUtils";
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
    it("matches in January on correct day when no month_of_year set", () => {
      const rt = makeTemplate({ frequency: "annual", day_of_month: 1 });
      expect(recurringMatchesDay(rt, new Date("2024-01-01"))).toBe(true);
    });

    it("does not match in other months when no month_of_year set", () => {
      const rt = makeTemplate({ frequency: "annual", day_of_month: 1 });
      expect(recurringMatchesDay(rt, new Date("2024-06-01"))).toBe(false);
    });

    it("matches in configured month_of_year", () => {
      const rt = makeTemplate({ frequency: "annual", day_of_month: 15, month_of_year: 3 }); // April
      expect(recurringMatchesDay(rt, new Date("2024-04-15"))).toBe(true);
    });

    it("does not match in wrong month when month_of_year set", () => {
      const rt = makeTemplate({ frequency: "annual", day_of_month: 15, month_of_year: 3 }); // April
      expect(recurringMatchesDay(rt, new Date("2024-01-15"))).toBe(false);
    });
  });

  describe("unknown frequency", () => {
    it("returns false", () => {
      const rt = makeTemplate({ frequency: "unknown" as unknown as string });
      expect(recurringMatchesDay(rt, new Date("2024-06-10"))).toBe(false);
    });
  });
});

describe("getNextOccurrenceDate", () => {
  describe("monthly", () => {
    it("advances by one month", () => {
      const rt = makeTemplate({ frequency: "monthly", day_of_month: 15 });
      const next = getNextOccurrenceDate(rt, new Date("2024-06-15"));
      expect(next.getMonth()).toBe(6); // July
      expect(next.getDate()).toBe(15);
    });

    it("clamps to last day of month when day_of_month exceeds month length", () => {
      const rt = makeTemplate({ frequency: "monthly", day_of_month: 31 });
      const next = getNextOccurrenceDate(rt, new Date("2024-01-31"));
      // Feb 2024 has 29 days (leap year)
      expect(next.getFullYear()).toBe(2024);
      expect(next.getMonth()).toBe(1); // February
      expect(next.getDate()).toBe(29);
    });
  });

  describe("quarterly", () => {
    it("advances by three months", () => {
      const rt = makeTemplate({ frequency: "quarterly", day_of_month: 1 });
      const next = getNextOccurrenceDate(rt, new Date("2024-01-01"));
      expect(next.getMonth()).toBe(3); // April
      expect(next.getDate()).toBe(1);
    });

    it("clamps day when target month is shorter (Jan 31 → Apr 30)", () => {
      const rt = makeTemplate({ frequency: "quarterly", day_of_month: 31 });
      const next = getNextOccurrenceDate(rt, new Date("2024-01-31"));
      expect(next.getMonth()).toBe(3); // April
      expect(next.getDate()).toBe(30); // April has 30 days
    });
  });

  describe("biannual", () => {
    it("advances by six months", () => {
      const rt = makeTemplate({ frequency: "biannual", day_of_month: 10 });
      const next = getNextOccurrenceDate(rt, new Date("2024-01-10"));
      expect(next.getMonth()).toBe(6); // July
      expect(next.getDate()).toBe(10);
    });

    it("clamps day when target month is shorter", () => {
      const rt = makeTemplate({ frequency: "biannual", day_of_month: 31 });
      const next = getNextOccurrenceDate(rt, new Date("2024-07-31"));
      // Jan 2025 has 31 days — no clamping
      expect(next.getMonth()).toBe(0);
      expect(next.getDate()).toBe(31);
    });
  });

  describe("annual", () => {
    it("advances by one year", () => {
      const rt = makeTemplate({ frequency: "annual", day_of_month: 15 });
      const next = getNextOccurrenceDate(rt, new Date("2024-01-15"));
      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(0);
      expect(next.getDate()).toBe(15);
    });

    it("clamps Feb 29 in leap year to Feb 28 in non-leap year", () => {
      const rt = makeTemplate({ frequency: "annual", day_of_month: 29 });
      const next = getNextOccurrenceDate(rt, new Date("2024-02-29")); // leap year
      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(1); // February
      expect(next.getDate()).toBe(28); // 2025 is not a leap year
    });
  });
});
