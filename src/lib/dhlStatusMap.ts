// Hebrew translations for DHL Express status codes and normalized status levels.
// Used by DhlTrackingWidget, TrackingBadge, and the order table to render
// human-readable status text and a 5-stage progress indicator.

export type TrackingStage = "received" | "pickup" | "transit" | "out-for-delivery" | "delivered" | "exception";

export type TrackingLevel = "pre-transit" | "transit" | "delivered" | "failure" | "unknown";

export interface DhlEventCode {
  he: string;
  stage: TrackingStage;
}

// DHL Express common numeric event codes. Where a code isn't listed we fall
// back to the raw description from the DHL API.
export const DHL_EVENT_CODES: Record<string, DhlEventCode> = {
  "100": { he: "מידע נקלט במערכת", stage: "received" },
  "101": { he: "מידע נקלט במערכת", stage: "received" },
  "102": { he: "עדכון סטטוס מכס", stage: "transit" },
  "103": { he: "שוחרר ממכס", stage: "transit" },
  "104": { he: "מעוכב במכס", stage: "exception" },
  "105": { he: "ממתין לטיפול במכס", stage: "transit" },
  "110": { he: "נאסף מהשולח", stage: "pickup" },
  "111": { he: "המשלוח התקבל בסניף DHL", stage: "pickup" },
  "120": { he: "עובר במרכז מיון", stage: "transit" },
  "121": { he: "יצא ממרכז מיון", stage: "transit" },
  "125": { he: "המשלוח עלה לטיסה", stage: "transit" },
  "126": { he: "המשלוח הגיע ליעד הביניים", stage: "transit" },
  "130": { he: "בדרכו ליעד", stage: "transit" },
  "131": { he: "הגיע למדינת היעד", stage: "transit" },
  "132": { he: "הגיע למרכז ההפצה", stage: "transit" },
  "140": { he: "עם השליח לחלוקה", stage: "out-for-delivery" },
  "141": { he: "ניסיון מסירה — הנמען לא נמצא", stage: "exception" },
  "150": { he: "נמסר", stage: "delivered" },
  "160": { he: "ניסיון מסירה נכשל — תיאום מחדש", stage: "exception" },
  "170": { he: "תקלה במסירה", stage: "exception" },
  "171": { he: "מתעכב — תקלה במשלוח", stage: "exception" },
  "180": { he: "ניסיון מסירה נכשל", stage: "exception" },
  "190": { he: "מוחזר לשולח", stage: "exception" },
  "191": { he: "המשלוח אבד", stage: "exception" },
};

export interface TrackingLevelMeta {
  he: string;
  /** Tailwind background+text color classes for badges. */
  badgeClass: string;
  /** Tailwind text color for inline status. */
  textClass: string;
  /** Stage index 0..4 along the progress bar. -1 means error/off-track. */
  stageIndex: number;
}

export const DHL_LEVELS: Record<TrackingLevel, TrackingLevelMeta> = {
  "pre-transit": { he: "ממתין לאיסוף", badgeClass: "bg-muted text-muted-foreground", textClass: "text-muted-foreground", stageIndex: 0 },
  "transit":     { he: "בדרך",          badgeClass: "bg-blue-100 text-blue-700", textClass: "text-blue-700", stageIndex: 2 },
  "delivered":   { he: "נמסר",          badgeClass: "bg-green-100 text-green-700", textClass: "text-green-700", stageIndex: 4 },
  "failure":     { he: "תקלה",          badgeClass: "bg-red-100 text-red-700",   textClass: "text-red-700",  stageIndex: -1 },
  "unknown":     { he: "לא ידוע",       badgeClass: "bg-muted text-muted-foreground", textClass: "text-muted-foreground", stageIndex: 0 },
};

export const DHL_PROGRESS_STAGES: { key: TrackingStage; he: string }[] = [
  { key: "received",          he: "נקלט" },
  { key: "pickup",            he: "נאסף" },
  { key: "transit",           he: "במעבר" },
  { key: "out-for-delivery",  he: "במשלוח" },
  { key: "delivered",         he: "נמסר" },
];

export function normalizeLevel(code?: string | null): TrackingLevel {
  if (!code) return "unknown";
  const lc = code.toLowerCase().trim();
  if (lc === "pre-transit" || lc === "transit" || lc === "delivered" || lc === "failure" || lc === "unknown") {
    return lc;
  }
  return "unknown";
}

/** Hebrew description for a single event, falling back to the raw description. */
export function describeEvent(code: string | null | undefined, fallback: string | null | undefined): string {
  if (code && DHL_EVENT_CODES[code]) return DHL_EVENT_CODES[code].he;
  return fallback?.trim() || "—";
}

/** Hebrew label for the overall status. Uses level description first, then event-code map, then raw description. */
export function describeStatus(level: TrackingLevel, rawCode: string | null | undefined, description: string | null | undefined): string {
  if (level === "delivered") return DHL_LEVELS.delivered.he;
  if (rawCode && DHL_EVENT_CODES[rawCode]) return DHL_EVENT_CODES[rawCode].he;
  if (description?.trim()) return description.trim();
  return DHL_LEVELS[level].he;
}

const STAGE_ORDER: TrackingStage[] = ["received", "pickup", "transit", "out-for-delivery", "delivered"];

/** Index 0..4 along the progress bar based on event code, or -1 for exception. */
export function stageIndexForEvent(eventCode: string | null | undefined, level: TrackingLevel): number {
  if (level === "delivered") return 4;
  if (level === "failure") return -1;
  if (eventCode && DHL_EVENT_CODES[eventCode]) {
    const stage = DHL_EVENT_CODES[eventCode].stage;
    if (stage === "exception") return -1;
    return STAGE_ORDER.indexOf(stage);
  }
  return DHL_LEVELS[level].stageIndex;
}
