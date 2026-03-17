import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AppContext"
import { supabase } from "@/lib/supabase"
import type { SortDir } from "@/lib/sortUtils"

export interface TablePreferences {
  sortField: string | null
  sortDir: SortDir | null
  filters: Record<string, any>
}

/**
 * Hook for managing table sort and filter preferences
 * Persists preferences to database per user per page
 * Falls back to localStorage if user not authenticated
 */
export function useTablePreferences(
  pageName: string,
  defaultPreferences?: Partial<TablePreferences>
) {
  const { session } = useAuth()
  const [preferences, setPreferences] = useState<TablePreferences>({
    sortField: defaultPreferences?.sortField || null,
    sortDir: defaultPreferences?.sortDir || null,
    filters: defaultPreferences?.filters || {},
  })
  const [loading, setLoading] = useState(false)

  // Load preferences on mount or when session changes
  useEffect(() => {
    loadPreferences()
  }, [session, pageName])

  /**
   * Load preferences from database (if authenticated) or localStorage
   */
  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true)

      if (session?.user) {
        // Load from database - user_preferences table may not be in generated types
        const { data, error } = await (supabase as any)
          .from("user_preferences")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("page_name", pageName)
          .single()

        if (error && error.code !== "PGRST116") {
          // PGRST116 = no rows found, which is fine
          console.error("Error loading preferences:", error)
        }

        if (data) {
          setPreferences({
            sortField: data.sort_field,
            sortDir: (data.sort_dir as SortDir) || null,
            filters: (typeof data.filters === 'object' && data.filters !== null && !Array.isArray(data.filters) ? data.filters : {}) as Record<string, any>,
          })
          return
        }
      }

      // Fall back to localStorage
      const localKey = `tablePreferences:${pageName}`
      const stored = localStorage.getItem(localKey)
      if (stored) {
        try {
          setPreferences(JSON.parse(stored))
        } catch (e) {
          console.error("Error parsing stored preferences:", e)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [session, pageName])

  /**
   * Save preferences to database (if authenticated) and localStorage
   */
  const savePreferences = useCallback(
    async (newPreferences: Partial<TablePreferences>) => {
      const updated = {
        ...preferences,
        ...newPreferences,
      }

      setPreferences(updated)

      // Always save to localStorage as fallback
      const localKey = `tablePreferences:${pageName}`
      localStorage.setItem(localKey, JSON.stringify(updated))

      // Save to database if authenticated
      if (session?.user) {
        try {
          const { error } = await (supabase as any).from("user_preferences").upsert({
            user_id: session.user.id,
            page_name: pageName,
            sort_field: updated.sortField,
            sort_dir: updated.sortDir,
            filters: updated.filters,
          })

          if (error) {
            console.error("Error saving preferences:", error)
          }
        } catch (e) {
          console.error("Error saving preferences:", e)
        }
      }
    },
    [session, pageName, preferences]
  )

  /**
   * Set sort field and direction with 3-state toggle logic
   * none → asc → desc → none
   */
  const toggleSort = useCallback(
    (field: string) => {
      if (preferences.sortField === field) {
        if (preferences.sortDir === "asc") {
          savePreferences({ sortDir: "desc" })
        } else {
          savePreferences({ sortField: null, sortDir: null })
        }
      } else {
        savePreferences({ sortField: field, sortDir: "asc" })
      }
    },
    [preferences.sortField, preferences.sortDir, savePreferences]
  )

  /**
   * Clear all sorting and filtering
   */
  const clearPreferences = useCallback(() => {
    savePreferences({
      sortField: null,
      sortDir: null,
      filters: {},
    })
  }, [savePreferences])

  /**
   * Update filter value
   */
  const setFilter = useCallback(
    (filterKey: string, value: any) => {
      savePreferences({
        filters: {
          ...preferences.filters,
          [filterKey]: value,
        },
      })
    },
    [preferences.filters, savePreferences]
  )

  /**
   * Clear specific filter
   */
  const clearFilter = useCallback(
    (filterKey: string) => {
      const { [filterKey]: _, ...remaining } = preferences.filters
      savePreferences({ filters: remaining })
    },
    [preferences.filters, savePreferences]
  )

  return {
    ...preferences,
    loading,
    toggleSort,
    setFilter,
    clearFilter,
    clearPreferences,
    savePreferences,
  }
}
