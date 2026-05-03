import { useState, useCallback } from "react";
import { categories as defaultCats } from "@/contexts/AppContext";

const STORAGE_KEY = "product-categories:custom";
const BASE_CATEGORIES = defaultCats.filter(c => c !== "הכל");

function loadCustom(): string[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

export function useCategoryManager() {
  const [custom, setCustom] = useState<string[]>(loadCustom);
  const allCategories = [...BASE_CATEGORIES, ...custom.filter(c => !BASE_CATEGORIES.includes(c))];

  const save = (updated: string[]) => {
    setCustom(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addCategory = useCallback((name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed || allCategories.includes(trimmed)) return false;
    save([...custom, trimmed]);
    return true;
     
  }, [custom, allCategories]);

  const removeCategory = useCallback((name: string) => {
    if (BASE_CATEGORIES.includes(name)) return;
    save(custom.filter(c => c !== name));
     
  }, [custom]);

  const renameCategory = useCallback((oldName: string, newName: string): boolean => {
    const trimmed = newName.trim();
    if (!trimmed || allCategories.includes(trimmed) || BASE_CATEGORIES.includes(oldName)) return false;
    save(custom.map(c => (c === oldName ? trimmed : c)));
    return true;
     
  }, [custom, allCategories]);

  return { allCategories, custom, addCategory, removeCategory, renameCategory };
}
