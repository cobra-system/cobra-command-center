/**
 * Utility functions for sorting table data
 */

export type SortType = "string" | "number" | "date"
export type SortDir = "asc" | "desc"

/**
 * Read a dynamically-named field off a typed row.
 * Interfaces have no index signature, so `row[field]` needs a cast; doing it
 * here keeps the `as unknown as Record<...>` dance out of the call sites.
 */
export function getField(row: unknown, field: string): unknown {
  return (row as Record<string, unknown>)[field]
}

/**
 * Compare two values for sorting
 * Handles different data types and locales (Hebrew support)
 */
export function compareValues(
  a: unknown,
  b: unknown,
  type: SortType = "string"
): number {
  // Handle null/undefined values
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  switch (type) {
    case "number": {
      const numA = Number(a) || 0
      const numB = Number(b) || 0
      return numA - numB
    }

    case "date": {
      const dateA = new Date(a as string | number | Date).getTime()
      const dateB = new Date(b as string | number | Date).getTime()
      return dateA - dateB
    }

    case "string":
    default: {
      const strA = String(a || "")
      const strB = String(b || "")
      // Hebrew locale-aware comparison
      return strA.localeCompare(strB, "he")
    }
  }
}

/**
 * Create a comparator function for a specific field and sort type
 */
export function createComparator<T extends object>(
  field: keyof T,
  type: SortType = "string"
) {
  return (a: T, b: T) => {
    return compareValues(a[field], b[field], type)
  }
}

/**
 * Sort an array of items by a specific field
 */
export function sortArray<T extends object>(
  items: T[],
  field: keyof T,
  direction: SortDir = "asc",
  type: SortType = "string"
): T[] {
  const sorted = [...items].sort(createComparator(field, type))
  return direction === "desc" ? sorted.reverse() : sorted
}

/**
 * Filter an array based on filter criteria
 */
export function filterArray<T extends object>(
  items: T[],
  filters: Record<string, unknown>
): T[] {
  return items.filter((item) => {
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === "all") {
        continue
      }

      if (Array.isArray(value)) {
        if (!value.includes(getField(item, key))) {
          return false
        }
      } else if (getField(item, key) !== value) {
        return false
      }
    }
    return true
  })
}
