export interface ForecastPoint {
  month: string;
  forecastQty: number;
  forecastLow: number;
  forecastBand: number; // forecastHigh - forecastLow, for recharts stacking
}

/** Weighted moving average forecast (last 3 months, newest has highest weight). */
export function forecastConsumption(
  data: { month: string; quantity: number }[],
  horizonMonths = 5,
): ForecastPoint[] {
  if (data.length < 2) return [];
  const last = data.slice(-Math.min(3, data.length));
  const weights = last.length >= 3 ? [0.5, 0.3, 0.2] : last.length === 2 ? [0.6, 0.4] : [1.0];
  const weightedAvg = last.reduce((s, d, i) => s + d.quantity * (weights[i] ?? 0), 0);
  const mean = last.reduce((s, d) => s + d.quantity, 0) / last.length;
  const stdDev = Math.sqrt(last.reduce((s, d) => s + (d.quantity - mean) ** 2, 0) / last.length);

  const result: ForecastPoint[] = [];
  const lastDate = new Date(data[data.length - 1].month + "-01");
  for (let i = 1; i <= horizonMonths; i++) {
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + i);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const low = Math.max(0, weightedAvg - stdDev);
    const high = weightedAvg + stdDev;
    result.push({
      month,
      forecastQty: Math.max(0, Math.round(weightedAvg * 10) / 10),
      forecastLow: Math.round(low * 10) / 10,
      forecastBand: Math.round(Math.max(0, high - low) * 10) / 10,
    });
  }
  return result;
}

/**
 * Returns the label (YYYY-MM) of the first forecast month where cumulative
 * consumption exceeds stockQty, or null if stock outlasts the horizon.
 */
export function projectStockout(
  forecastPoints: ForecastPoint[],
  stockQty: number,
): string | null {
  if (stockQty <= 0) return null;
  let remaining = stockQty;
  for (const f of forecastPoints) {
    remaining -= f.forecastQty;
    if (remaining <= 0) return f.month;
  }
  return null;
}
