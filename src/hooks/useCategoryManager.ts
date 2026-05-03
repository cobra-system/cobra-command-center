/**
 * Thin adapter so CategorySelect can call add/rename/delete without knowing
 * whether the backing store is localStorage or the DB.
 *
 * Now delegates entirely to CategoriesContext (DB-backed).
 * The `custom` array is the subset of categories where is_default = false.
 */
import { useCallback } from "react";
import { useProductCategories } from "@/contexts/CategoriesContext";

export function useCategoryManager() {
  const { categories, addCategory: dbAdd, renameCategory: dbRename, deleteCategory: dbDelete } = useProductCategories();

  const allCategories = categories.map(c => c.name);
  const custom = categories.filter(c => !c.is_default).map(c => c.name);

  const findId = useCallback(
    (name: string) => categories.find(c => c.name === name)?.id ?? null,
    [categories]
  );

  const addCategory = useCallback(async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed || allCategories.includes(trimmed)) return false;
    await dbAdd(trimmed);
    return true;
  }, [allCategories, dbAdd]);

  const removeCategory = useCallback(async (name: string) => {
    const id = findId(name);
    const cat = categories.find(c => c.name === name);
    if (!id || cat?.is_default) return;
    await dbDelete(id);
  }, [findId, categories, dbDelete]);

  const renameCategory = useCallback(async (oldName: string, newName: string): Promise<boolean> => {
    const trimmed = newName.trim();
    const id = findId(oldName);
    const cat = categories.find(c => c.name === oldName);
    if (!id || cat?.is_default || !trimmed || allCategories.includes(trimmed)) return false;
    await dbRename(id, trimmed);
    return true;
  }, [findId, categories, allCategories, dbRename]);

  return { allCategories, custom, addCategory, removeCategory, renameCategory };
}
