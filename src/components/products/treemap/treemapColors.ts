export interface HealthInfo {
  color: string;
  label: string;
}

const THRESHOLDS: { min: number; color: string; label: string }[] = [
  { min: 6, color: "#052e16", label: "מצוין+" },
  { min: 5, color: "#14532d", label: "מצוין" },
  { min: 4, color: "#1a6b3a", label: "גבוה" },
  { min: 3.5, color: "#2d7a48", label: "תקין+" },
  { min: 3, color: "#3f7d4f", label: "תקין" },
  { min: 2.5, color: "#5a8a62", label: "סביר+" },
  { min: 2, color: "#6b7280", label: "סביר" },
  { min: 1.5, color: "#8b6b6b", label: "נמוך+" },
  { min: 1, color: "#b45454", label: "נמוך" },
  { min: 0.5, color: "#a33e3e", label: "קריטי+" },
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
  { color: "#a33e3e", label: "קריטי+" },
  { color: "#b45454", label: "נמוך" },
  { color: "#8b6b6b", label: "נמוך+" },
  { color: "#6b7280", label: "סביר" },
  { color: "#5a8a62", label: "סביר+" },
  { color: "#3f7d4f", label: "תקין" },
  { color: "#2d7a48", label: "תקין+" },
  { color: "#1a6b3a", label: "גבוה" },
  { color: "#14532d", label: "מצוין" },
  { color: "#052e16", label: "מצוין+" },
];
