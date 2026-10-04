import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemLedgerAnalysis } from "./ItemLedgerAnalysis";

const movements = [
  { movement_date: "2026-01-04", line_no: 1, doc_type: "תמ", warehouse_code: "011", account_code: "1", account_name: "לקוח גדול", quantity: -3 },
  { movement_date: "2026-01-06", line_no: 2, doc_type: "קנ", warehouse_code: "001", account_code: "9", account_name: "ספק", quantity: 40 },
  { movement_date: "2026-01-12", line_no: 3, doc_type: "תמ", warehouse_code: "011", account_code: "1", account_name: "לקוח גדול", quantity: -5 },
  { movement_date: "2026-01-13", line_no: 4, doc_type: "הח", warehouse_code: "011", account_code: "1", account_name: "לקוח גדול", quantity: 1 },
  { movement_date: "2026-01-20", line_no: 5, doc_type: "תמ", warehouse_code: "011", account_code: "2", account_name: "לקוח קטן", quantity: -2 },
];

vi.mock("@/hooks/useItemLedger", () => ({
  useItemLedger: () => ({
    isLoading: false,
    data: {
      item: { sku: "AAA", item_name: "פריט", period_start: "2026-01-04", period_end: "2026-01-24", opening_balance: 10, closing_balance: 41, updated_at: "2026-01-25T00:00:00Z" },
      movements,
    },
  }),
  useWarehouseNames: () => (c: string) => `מחסן ${c}`,
}));

beforeAll(() => {
  global.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

describe("ItemLedgerAnalysis", () => {
  it("renders KPIs, tables, calculator and notes", () => {
    render(<ItemLedgerAnalysis sku="AAA" systemStock={5} leadTimeDays={14} canEdit onSavePlan={async () => {}} />);
    expect(screen.getByText(/ניתוח כרטסת פריט/)).toBeInTheDocument();
    expect(screen.getByText("צריכה נטו בתקופה")).toBeInTheDocument();
    expect(screen.getByText("כמה להזמין")).toBeInTheDocument();
    expect(screen.getByText("2 שב׳")).toBeInTheDocument(); // lead time from product (14 days)
    expect(screen.getByText("פער מול המלאי בקוברה")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /שמור נקודת הזמנה/ })).toBeInTheDocument();
  });
});
