import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The orders table renders its header from COLUMN_DEFS but writes each body
 * cell out by hand, so the two are only aligned by the order they appear in.
 * Insert, move or drop a column on one side alone and every cell after it
 * lands under the wrong heading — a quantity read as a price, a date read as a
 * quantity. Nothing throws; the table simply lies.
 *
 * This locks the two sequences together by reading the source, which is the
 * only place the invariant exists. If it fails, a column was moved on one side
 * only — move it on the other too.
 */
describe("OrderTable column order", () => {
  const source = readFileSync(join(__dirname, "OrderTable.tsx"), "utf8");

  const defsBlock = source.slice(
    source.indexOf("const COLUMN_DEFS"),
    source.indexOf("];", source.indexOf("const COLUMN_DEFS")),
  );
  const headerIds = [...defsBlock.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map(m => m[1]);

  // The header itself calls isVisible(col.id), not a literal, so only the body
  // cells match this.
  const cellIds = [...source.slice(defsBlock.length).matchAll(/isVisible\("([^"]+)"\)/g)].map(m => m[1]);

  it("defines at least one column", () => {
    expect(headerIds.length).toBeGreaterThan(0);
  });

  it("has no duplicate column ids", () => {
    expect(new Set(headerIds).size).toBe(headerIds.length);
  });

  it("renders the body cells in the order the headers are declared", () => {
    expect(cellIds).toEqual(headerIds);
  });
});
