// Color palette for "מטרת-על" (high-level goal) groups in the Gantt view.
// Each goal is assigned a color by its index in the unique-goals list.

export interface GoalColor {
  /** Solid background for the group header / bar fill */
  bg: string;
  /** Light tint for the row background when the group header is shown */
  light: string;
  /** Border / accent shade */
  border: string;
  /** Text color on the solid bg header */
  headerText: string;
  /** Tailwind-compatible classes for the task bar */
  barBg: string;
  barBorder: string;
  barText: string;
}

export const GOAL_PALETTE: GoalColor[] = [
  {
    bg: "#0e7490",
    light: "#ecfeff",
    border: "#06b6d4",
    headerText: "#ffffff",
    barBg: "bg-cyan-600/80",
    barBorder: "border-cyan-700",
    barText: "text-white",
  },
  {
    bg: "#ea580c",
    light: "#fff7ed",
    border: "#f97316",
    headerText: "#ffffff",
    barBg: "bg-orange-500/80",
    barBorder: "border-orange-600",
    barText: "text-white",
  },
  {
    bg: "#ca8a04",
    light: "#fefce8",
    border: "#eab308",
    headerText: "#ffffff",
    barBg: "bg-yellow-500/80",
    barBorder: "border-yellow-600",
    barText: "text-white",
  },
  {
    bg: "#dc2626",
    light: "#fef2f2",
    border: "#f87171",
    headerText: "#ffffff",
    barBg: "bg-red-500/80",
    barBorder: "border-red-600",
    barText: "text-white",
  },
  {
    bg: "#7c3aed",
    light: "#f5f3ff",
    border: "#8b5cf6",
    headerText: "#ffffff",
    barBg: "bg-violet-500/80",
    barBorder: "border-violet-600",
    barText: "text-white",
  },
  {
    bg: "#16a34a",
    light: "#f0fdf4",
    border: "#22c55e",
    headerText: "#ffffff",
    barBg: "bg-green-500/80",
    barBorder: "border-green-600",
    barText: "text-white",
  },
  {
    bg: "#2563eb",
    light: "#eff6ff",
    border: "#3b82f6",
    headerText: "#ffffff",
    barBg: "bg-blue-500/80",
    barBorder: "border-blue-600",
    barText: "text-white",
  },
  {
    bg: "#db2777",
    light: "#fdf2f8",
    border: "#ec4899",
    headerText: "#ffffff",
    barBg: "bg-pink-500/80",
    barBorder: "border-pink-600",
    barText: "text-white",
  },
];

export function getGoalColor(index: number): GoalColor {
  return GOAL_PALETTE[index % GOAL_PALETTE.length];
}
