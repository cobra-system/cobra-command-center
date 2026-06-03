export interface HealthInfo {
  color: string;
  label: string;
}

const THRESHOLDS: { min: number; color: string; label: string }[] = [
  { min: 4, color: "#16a34a", label: "מצוין" },
  { min: 3, color: "#4ade80", label: "תקין" },
  { min: 2, color: "#eab308", label: "סביר" },
  { min: 1, color: "#f97316", label: "נמוך" },
  { min: 0.01, color: "#ef4444", label: "קריטי" },
];

const NO_STOCK: HealthInfo = { color: "#dc2626", label: "אזל" };
const NO_DATA: HealthInfo = { color: "#6b7280", label: "אין נתונים" };

export function getHealthInfo(stockQty: number, consumption: number): HealthInfo {
  if (consumption <= 0) return NO_DATA;
  if (stockQty <= 0) return NO_STOCK;

  const months = stockQty / consumption;
  for (const t of THRESHOLDS) {
    if (months >= t.min) return { color: t.color, label: t.label };
  }
  return NO_STOCK;
}

export function getHealthColor(stockQty: number, consumption: number): string {
  return getHealthInfo(stockQty, consumption).color;
}

export function getHealthLabel(stockQty: number, consumption: number): string {
  return getHealthInfo(stockQty, consumption).label;
}

export const LEGEND_ITEMS: { color: string; label: string }[] = [
  NO_STOCK,
  { color: "#ef4444", label: "קריטי" },
  { color: "#f97316", label: "נמוך" },
  { color: "#eab308", label: "סביר" },
  { color: "#4ade80", label: "תקין" },
  { color: "#16a34a", label: "מצוין" },
];
