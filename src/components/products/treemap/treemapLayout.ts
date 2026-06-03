export interface TreemapItem {
  id: string;
  name: string;
  sku: string;
  value: number;
  ratio: number;
  category: string;
  supplier?: string;
  supplierId?: string;
  stockQty: number;
  consumption: number;
  incomingQty?: number;
  purchasePrice?: number;
  leadTimeDays?: number;
  productType?: string;
  openIssues?: number;
  lastOrderDate?: string;
}

export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  item: TreemapItem;
}

export interface CategoryRect {
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: TreemapRect[];
}

function squarify(
  items: { id: string; value: number }[],
  x: number,
  y: number,
  width: number,
  height: number,
): { id: string; x: number; y: number; w: number; h: number }[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ id: items[0].id, x, y, w: width, h: height }];
  }

  const totalValue = items.reduce((s, i) => s + i.value, 0);
  if (totalValue <= 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const results: { id: string; x: number; y: number; w: number; h: number }[] = [];

  let cx = x, cy = y, cw = width, ch = height;
  let remaining = [...sorted];
  let remainingValue = totalValue;

  while (remaining.length > 0) {
    const isHorizontal = cw >= ch;
    const side = isHorizontal ? ch : cw;

    let row: typeof remaining = [];
    let rowValue = 0;
    let bestAspect = Infinity;

    for (const item of remaining) {
      const testRow = [...row, item];
      const testValue = rowValue + item.value;
      const rowFraction = testValue / remainingValue;
      const rowSize = isHorizontal ? cw * rowFraction : ch * rowFraction;

      let worstAspect = 0;
      for (const r of testRow) {
        const cellFraction = r.value / testValue;
        const cellSize = side * cellFraction;
        const aspect = Math.max(rowSize / cellSize, cellSize / rowSize);
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect) {
        row = testRow;
        rowValue = testValue;
        bestAspect = worstAspect;
      } else {
        break;
      }
    }

    if (row.length === 0) break;

    const rowFraction = rowValue / remainingValue;
    const rowSize = isHorizontal ? cw * rowFraction : ch * rowFraction;

    let offset = 0;
    for (const item of row) {
      const cellFraction = item.value / rowValue;
      const cellSize = side * cellFraction;

      if (isHorizontal) {
        results.push({ id: item.id, x: cx, y: cy + offset, w: rowSize, h: cellSize });
      } else {
        results.push({ id: item.id, x: cx + offset, y: cy, w: cellSize, h: rowSize });
      }
      offset += cellSize;
    }

    if (isHorizontal) {
      cx += rowSize;
      cw -= rowSize;
    } else {
      cy += rowSize;
      ch -= rowSize;
    }

    remaining = remaining.slice(row.length);
    remainingValue -= rowValue;
  }

  return results;
}

export function layoutTreemap(
  items: TreemapItem[],
  width: number,
  height: number,
  headerHeight: number,
): CategoryRect[] {
  if (width <= 0 || height <= 0 || items.length === 0) return [];

  const byCategory = new Map<string, TreemapItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const categoryEntries = [...byCategory.entries()].map(([category, catItems]) => ({
    id: category,
    value: catItems.reduce((s, i) => s + i.value, 0),
    items: catItems,
  }));

  const catRects = squarify(
    categoryEntries.map(c => ({ id: c.id, value: c.value })),
    0, 0, width, height,
  );

  const result: CategoryRect[] = [];
  for (const cr of catRects) {
    const entry = categoryEntries.find(c => c.id === cr.id)!;
    const innerY = cr.y + headerHeight;
    const innerH = cr.h - headerHeight;

    let children: TreemapRect[] = [];
    if (innerH > 0 && cr.w > 0) {
      const childRects = squarify(
        entry.items.map(i => ({ id: i.id, value: i.value })),
        cr.x, innerY, cr.w, innerH,
      );
      children = childRects.map(r => ({
        x: r.x,
        y: r.y,
        width: r.w,
        height: r.h,
        item: entry.items.find(i => i.id === r.id)!,
      }));
    }

    result.push({
      category: cr.id,
      x: cr.x,
      y: cr.y,
      width: cr.w,
      height: cr.h,
      children,
    });
  }

  return result;
}
