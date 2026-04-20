export const DIVISIONS = [
  "AWACS",
  "כפתור",
  "DOORE",
  "דלק מוטורס",
  "פריזבי קרסו",
  "לובינסקי",
] as const;

export type Division = (typeof DIVISIONS)[number];

export const DIVISION_COLORS: Record<string, string> = {
  AWACS: "bg-blue-100 text-blue-700 border-blue-200",
  כפתור: "bg-amber-100 text-amber-700 border-amber-200",
  DOORE: "bg-green-100 text-green-700 border-green-200",
  "דלק מוטורס": "bg-red-100 text-red-700 border-red-200",
  "פריזבי קרסו": "bg-purple-100 text-purple-700 border-purple-200",
  לובינסקי: "bg-teal-100 text-teal-700 border-teal-200",
};

export const BONDED_DIVISIONS = new Set(["דלק מוטורס", "פריזבי קרסו", "לובינסקי"]);

export const SALES_DIVISIONS = new Set(["AWACS", "כפתור", "DOORE"]);
