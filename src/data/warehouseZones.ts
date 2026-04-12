export type ZoneType = "shelving" | "storage" | "product" | "utility" | "entrance";

export interface WarehouseZone {
  id: string;
  name: string;
  color: string;
  textColor: string;
  gridRow: string;
  gridColumn: string;
  zoneType: ZoneType;
  icon?: string;
  isNonProduct?: boolean;
  capacity?: number; // max units, for utilization bar
  notes?: string;
}

// ──────────────────────────────────────────────────────────
// Warehouse floor plan zones matching the logistics center sketch.
//
// Grid: 24 columns × 20 rows (RTL — column 1 is rightmost).
//
// Right side = shelving rack (salmon/peach/brown rows)
// Top = smartphone stands (brown) + multimedia systems (green)
// Center-left = ID (red) + E.R.M (yellow)
// Center-right = product-specific colored zones (R8, KS400, S400, Z4K)
// Far left = trunk lifter + spare parts (purple)
// Bottom = E.R.M, safe, work desk, entrance
// ──────────────────────────────────────────────────────────

export const WAREHOUSE_ZONES: WarehouseZone[] = [
  // ── RIGHT SIDE — Shelving rack (top to bottom) ──────────
  {
    id: "light-buttons",
    name: "כפתור לייט",
    color: "#4a4a4a",
    textColor: "#ffffff",
    gridRow: "1 / 3",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "lcd-g4-buttons",
    name: "כפתור LCD + G4",
    color: "#4a4a4a",
    textColor: "#ffffff",
    gridRow: "3 / 5",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "phone-stands",
    name: "מעמדי טלפון\nחישבי בדורם",
    color: "#4a4a4a",
    textColor: "#ffffff",
    gridRow: "5 / 7",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "head-mounts",
    name: "תושבת ראש\nמרכז בלוק",
    color: "#4a4a4a",
    textColor: "#ffffff",
    gridRow: "7 / 9",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "cobratv-screens-1",
    name: "CobraTv + מסכים",
    color: "#F4A89A",
    textColor: "#1a1a1a",
    gridRow: "9 / 11",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "cobratv-screens-2",
    name: "CobraTv + מסכים",
    color: "#F4A89A",
    textColor: "#1a1a1a",
    gridRow: "11 / 13",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "g4-android-screens-1",
    name: "G4 מסכי אנדרויד",
    color: "#b87333",
    textColor: "#ffffff",
    gridRow: "13 / 15",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "g4-android-screens-2",
    name: "G4 מסכי אנדרויד",
    color: "#b87333",
    textColor: "#ffffff",
    gridRow: "15 / 17",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "g5-android-screens-1",
    name: "G5 מסכי אנדרויד",
    color: "#b87333",
    textColor: "#ffffff",
    gridRow: "17 / 19",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },
  {
    id: "g5-android-screens-2",
    name: "G5 מסכי אנדרויד",
    color: "#b87333",
    textColor: "#ffffff",
    gridRow: "19 / 21",
    gridColumn: "1 / 5",
    zoneType: "shelving",
  },

  // ── TOP AREA — Smartphone stands + Multimedia systems ──
  {
    id: "smartphone-stands",
    name: "מעמדים מעודרים לסמארטפון",
    color: "#c4956a",
    textColor: "#ffffff",
    gridRow: "1 / 3",
    gridColumn: "5 / 10",
    zoneType: "storage",
  },
  {
    id: "multimedia-systems",
    name: "מערכות מולטימדיה שונות",
    color: "#8BC34A",
    textColor: "#1a1a1a",
    gridRow: "1 / 3",
    gridColumn: "10 / 19",
    zoneType: "storage",
  },

  // ── CENTER LEFT — ID (red) zones ──────────────────────
  {
    id: "id-storage-1",
    name: "ID",
    color: "#8B1A1A",
    textColor: "#ffffff",
    gridRow: "5 / 8",
    gridColumn: "5 / 8",
    zoneType: "storage",
  },
  {
    id: "id-storage-2",
    name: "ID",
    color: "#8B1A1A",
    textColor: "#ffffff",
    gridRow: "5 / 8",
    gridColumn: "8 / 10",
    zoneType: "storage",
  },
  {
    id: "id-storage-3",
    name: "ID",
    color: "#8B1A1A",
    textColor: "#ffffff",
    gridRow: "5 / 8",
    gridColumn: "10 / 12",
    zoneType: "storage",
  },

  // ── CENTER — E.R.M (yellow) zones ─────────────────────
  {
    id: "erm-1",
    name: "E.R.M",
    color: "#FFD600",
    textColor: "#1a1a1a",
    gridRow: "8 / 11",
    gridColumn: "5 / 8",
    zoneType: "product",
  },
  {
    id: "erm-2",
    name: "E.R.M",
    color: "#FFD600",
    textColor: "#1a1a1a",
    gridRow: "8 / 11",
    gridColumn: "8 / 11",
    zoneType: "product",
  },
  {
    id: "erm-3",
    name: "E.R.M",
    color: "#FFD600",
    textColor: "#1a1a1a",
    gridRow: "8 / 11",
    gridColumn: "11 / 14",
    zoneType: "product",
  },

  // ── CENTER RIGHT — Gray storage ────────────────────────
  {
    id: "gray-storage-1",
    name: "אחסון",
    color: "#9E9E9E",
    textColor: "#ffffff",
    gridRow: "3 / 8",
    gridColumn: "12 / 15",
    zoneType: "storage",
  },
  {
    id: "gray-storage-2",
    name: "אחסון",
    color: "#78909C",
    textColor: "#ffffff",
    gridRow: "3 / 8",
    gridColumn: "15 / 19",
    zoneType: "storage",
  },

  // ── CENTER — Product-specific colored zones ────────────
  {
    id: "r8",
    name: "R8\nבליינד ספורט",
    color: "#3b5fe6",
    textColor: "#ffffff",
    gridRow: "8 / 11",
    gridColumn: "14 / 17",
    zoneType: "product",
  },
  {
    id: "ks400",
    name: "KS400",
    color: "#22c55e",
    textColor: "#ffffff",
    gridRow: "8 / 11",
    gridColumn: "17 / 19",
    zoneType: "product",
  },
  {
    id: "s400",
    name: "S400",
    color: "#f97316",
    textColor: "#ffffff",
    gridRow: "8 / 11",
    gridColumn: "19 / 21",
    zoneType: "product",
  },
  {
    id: "z4k",
    name: "Z4K",
    color: "#06b6d4",
    textColor: "#ffffff",
    gridRow: "8 / 11",
    gridColumn: "21 / 23",
    zoneType: "product",
  },

  // ── FAR LEFT — Trunk lifter + spare parts (purple) ─────
  {
    id: "trunk-spare-parts",
    name: "מרימר תא מטען\nחשמלי\n+\nחלקי חילוף",
    color: "#9C27B0",
    textColor: "#ffffff",
    gridRow: "1 / 15",
    gridColumn: "21 / 25",
    zoneType: "storage",
  },

  // ── BOTTOM LEFT — E.R.M + Safe ─────────────────────────
  {
    id: "erm-bottom",
    name: "E.R.M",
    color: "#FFD600",
    textColor: "#1a1a1a",
    gridRow: "17 / 21",
    gridColumn: "5 / 8",
    zoneType: "product",
  },
  {
    id: "safe",
    name: "כספת",
    color: "#3f51b5",
    textColor: "#ffffff",
    gridRow: "17 / 21",
    gridColumn: "8 / 10",
    zoneType: "utility",
    icon: "Lock",
    isNonProduct: true,
  },

  // ── BOTTOM CENTER — Work desk ──────────────────────────
  {
    id: "work-desk",
    name: "שולחן עבודה",
    color: "#757575",
    textColor: "#ffffff",
    gridRow: "17 / 21",
    gridColumn: "10 / 15",
    zoneType: "utility",
    isNonProduct: true,
  },

  // ── BOTTOM RIGHT — Entrance ────────────────────────────
  {
    id: "entrance",
    name: "כניסה למחסן\nלוגיסטר קוברה ת״א",
    color: "#BDBDBD",
    textColor: "#424242",
    gridRow: "13 / 21",
    gridColumn: "15 / 25",
    zoneType: "entrance",
    icon: "DoorOpen",
    isNonProduct: true,
  },
];

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  shelving: "מדפים",
  storage: "אחסון",
  product: "מוצר ספציפי",
  utility: "שירות",
  entrance: "כניסה",
};

export const ZONE_TYPE_COLORS: Record<ZoneType, string> = {
  shelving: "#F4A89A",
  storage: "#9E9E9E",
  product: "#FFD600",
  utility: "#757575",
  entrance: "#BDBDBD",
};
