export interface HealthInfo {
  color: string;
  label: string;
}

const THRESHOLDS: { min: number; color: string; label: string }[] = [
  { min: 4, color: "#14532d", label: "מצוין" },
  { min: 3, color: "#3f7d4f", label: "תקין" },
  { min: 2, color: "#6b7280", label: "סביר" },
  { min: 1, color: "#b45454", label: "נמוך" },
  { min: 0.01, color: "#9b2d2d", label: "קריטי" },
];

const NO_STOCK: HealthInfo = { color: "#7f1d1d", label: "אזל" };
const NO_DATA: HealthInfo = { color: "#374151", label: "אין נתונים" };

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
  { color: "#9b2d2d", label: "קריטי" },
  { color: "#b45454", label: "נמוך" },
  { color: "#6b7280", label: "סביר" },
  { color: "#3f7d4f", label: "תקין" },
  { color: "#14532d", label: "מצוין" },
];
