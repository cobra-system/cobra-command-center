/**
 * Utility functions for sorting table data
 */

export type SortType = "string" | "number" | "date"
export type SortDir = "asc" | "desc"

/**
 * Compare two values for sorting
 * Handles different data types and locales (Hebrew support)
 */
export function compareValues(
  a: any,
  b: any,
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
      const dateA = new Date(a).getTime()
      const dateB = new Date(b).getTime()
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
export function createComparator<T extends Record<string, any>>(
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
export function sortArray<T extends Record<string, any>>(
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
export function filterArray<T extends Record<string, any>>(
  items: T[],
  filters: Record<string, any>
): T[] {
  return items.filter((item) => {
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === "all") {
        continue
      }

      if (Array.isArray(value)) {
        if (!value.includes(item[key])) {
          return false
        }
      } else if (item[key] !== value) {
        return false
      }
    }
    return true
  })
}
