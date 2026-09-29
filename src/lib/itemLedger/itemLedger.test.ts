import { describe, it, expect } from "vitest";
import { parseLedgerRows, parseLedgerDate, parseLedgerNumber, textToRows, fileBytesToRows } from "./parse";
import { analyzeLedger, classifyDoc, computePlan, buildNotes, weekStart } from "./analyze";

const HEADER = "תאריך אסמכתא\tמסמך\tשורה במסמך\tמחסן\tקוד ח-ן/כרטיס\tשם ח-ן/כרטיס\tיחידת מידה של מלאי\tכמות\tמחיר לאחר הנחה\tיתרה\t";

function row(date: string, doc: string, wh: string, acc: string, name: string, qty: number, bal: number) {
  return `${date}\t${doc}\t1\t${wh}\t${acc}\t${name}\t\t${qty}\t0.00\t${bal}\t`;
}

const SAMPLE = [
  HEADER,
  "AAA\t\t\t\t\tפריט א\t\t\t\t10\t",
  row("04/01/26", "תמ 1", "011", "1", "לקוח גדול", -2, 8),
  row("05/01/26", "תמ 2", "011", "1", "לקוח גדול", -3, 5),
  row("06/01/26", "הח 3", "011", "1", "לקוח גדול", 1, 6),
  row("07/01/26", "מח 4", "001", "", "", -4, 2),
  row("07/01/26", "מח 4", "011", "", "", 4, 6),
  row("11/01/26", "קנ 5", "001", "9", "ספק", 20, 26),
  row("12/01/26", "תמ 6", "011", "2", "לקוח קטן", -1, 25),
  row("17/01/26", "תמ 7", "011", "1", "לקוח גדול", -5, 20),
  "\t\t\t\t\t\t\t\t\t20\t",
  "BBB\t\t\t\t\tפריט ב\t\t\t\t0\t",
  "\t\t\t\t\t\t\t\t\t0\t",
].join("\r\n");

describe("parse", () => {
  it("parses dates and numbers", () => {
    expect(parseLedgerDate("01/09/26")).toBe("2026-09-01");
    expect(parseLedgerDate("1/9/2026")).toBe("2026-09-01");
    expect(parseLedgerDate("ATNJ")).toBeNull();
    expect(parseLedgerNumber("1,001")).toBe(1001);
    expect(parseLedgerNumber("6-")).toBe(-6);
    expect(parseLedgerNumber("")).toBeNull();
  });

  it("splits a multi-item export into blocks", () => {
    const p = parseLedgerRows(textToRows(SAMPLE));
    expect(p.items.map(i => i.sku)).toEqual(["AAA", "BBB"]);
    const a = p.items[0];
    expect(a.item_name).toBe("פריט א");
    expect(a.opening_balance).toBe(10);
    expect(a.closing_balance).toBe(20);
    expect(a.movements).toHaveLength(8);
    expect(a.movements[0]).toMatchObject({ movement_date: "2026-01-04", doc_type: "תמ", doc_number: "1", warehouse_code: "011", quantity: -2 });
    expect(p.period_start).toBe("2026-01-04");
    expect(p.period_end).toBe("2026-01-17");
    expect(p.movement_count).toBe(8);
  });

  it("decodes the UTF-16LE text the ERP saves as .xls", () => {
    const body = "﻿" + SAMPLE;
    const buf = new Uint8Array(body.length * 2);
    for (let i = 0; i < body.length; i++) { const c = body.charCodeAt(i); buf[i * 2] = c & 0xff; buf[i * 2 + 1] = c >> 8; }
    const rows = fileBytesToRows(buf.buffer);
    expect(parseLedgerRows(rows).items[0].closing_balance).toBe(20);
  });
});

describe("analyze", () => {
  const p = parseLedgerRows(textToRows(SAMPLE));
  const it0 = p.items[0];
  const a = analyzeLedger({ ...it0, period_start: "2026-01-04", period_end: "2026-01-17" });

  it("classifies documents", () => {
    expect(classifyDoc("תמ")).toBe("sale");
    expect(classifyDoc("חז")).toBe("customer_return");
    expect(classifyDoc("מח")).toBe("transfer");
    expect(classifyDoc("כמ")).toBe("adjustment");
  });

  it("counts only customer movements as consumption", () => {
    expect(a.shipped).toBe(11);
    expect(a.returned).toBe(1);
    expect(a.netConsumption).toBe(10);
    expect(a.topCustomer).toMatchObject({ name: "לקוח גדול", units: 9 });
  });

  it("buckets Sunday-start weeks with running balance", () => {
    expect(weekStart("2026-01-07")).toBe("2026-01-04");
    expect(a.weeks.map(w => w.demand)).toEqual([4, 6]);
    expect(a.weeks.map(w => w.balance)).toEqual([6, 20]);
    expect(a.weeks.every(w => w.full)).toBe(true);
    expect(a.weeklyMean).toBe(5);
    expect(a.receipts).toEqual([{ date: "2026-01-11", quantity: 20, doc_type: "קנ", account_name: "ספק" }]);
  });

  it("ignores transfer out/in ordering for the low point", () => {
    expect(a.minBalance).toEqual({ value: 5, date: "2026-01-05" });
    expect(a.warehouses.find(w => w.code === "001")?.net).toBe(16);
  });

  it("computes the reorder plan", () => {
    const r = computePlan({ rate: 10, sd: 2, leadWeeks: 4, reviewWeeks: 4, z: 1.65, stock: 100 });
    expect(r.reorderPoint).toBe(Math.round(40 + 1.65 * 2 * 2));
    expect(r.orderUpTo).toBe(80 + r.safetyStock);
    expect(r.weeksToReorder).toBeCloseTo((100 - r.reorderPoint) / 10);
  });

  it("flags stale data and stock gaps", () => {
    const notes = buildNotes(a, { periodEnd: "2026-01-17", today: "2026-03-30", systemStock: 3, warehouseName: c => c });
    const titles = notes.map(n => n.title);
    expect(titles).toContain("הכרטסת לא מעודכנת");
    expect(titles).toContain("פער מול המלאי בקוברה");
  });
});
