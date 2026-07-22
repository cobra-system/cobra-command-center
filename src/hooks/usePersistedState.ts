import { useState, useEffect, Dispatch, SetStateAction } from "react";

/**
 * useState clone that mirrors the value to localStorage so it survives
 * page reloads. Use for filters, sort prefs, view-mode toggles — anything
 * the user expects to find unchanged when they come back.
 *
 * NOT for: search input (noisy), session-bound selections.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  options?: { serialize?: (v: T) => string; deserialize?: (s: string) => T }
): [T, Dispatch<SetStateAction<T>>] {
  const serialize = options?.serialize ?? JSON.stringify;
  const deserialize = options?.deserialize ?? (JSON.parse as (s: string) => T);

  const [value, setValue] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      if (s !== null) return deserialize(s);
    } catch {
      /* ignore — corrupt entry, fall through to initial */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(value));
    } catch {
      /* ignore — quota / private mode */
    }
  }, [key, value, serialize]);

  return [value, setValue];
}
