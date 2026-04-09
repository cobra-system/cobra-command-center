/**
 * folderStore — localStorage-backed store for document folders, folder
 * assignments, and starred documents.
 *
 * Used as a fallback when the Supabase `document_folders` table / columns
 * don't yet exist in the target environment.  A custom DOM event
 * ("cobra:folders-updated") is dispatched after every mutation so that any
 * mounted component can react synchronously.
 */
import type { DocumentFolder } from "@/components/documents/types";

const FOLDERS_KEY = "cobra_doc_folders";
const ASSIGN_KEY  = "cobra_folder_assign";   // { [docId]: folderId }
const STARS_KEY   = "cobra_doc_stars";        // string[]  (starred docIds)

function notify() {
  window.dispatchEvent(new CustomEvent("cobra:folders-updated"));
}

// ── Folders ───────────────────────────────────────────────────────────────────

export function getLocalFolders(): DocumentFolder[] {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]"); }
  catch { return []; }
}

export function upsertLocalFolder(folder: DocumentFolder): void {
  const list = getLocalFolders().filter(f => f.id !== folder.id);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify([...list, folder]));
  notify();
}

export function removeLocalFolder(id: string): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(getLocalFolders().filter(f => f.id !== id)));
  // Clear any document assignments pointing to this folder
  const assigns = getLocalAssignments();
  let changed = false;
  Object.keys(assigns).forEach(docId => {
    if (assigns[docId] === id) { delete assigns[docId]; changed = true; }
  });
  if (changed) localStorage.setItem(ASSIGN_KEY, JSON.stringify(assigns));
  notify();
}

// ── Document → Folder assignments ─────────────────────────────────────────────

export function getLocalAssignments(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(ASSIGN_KEY) || "{}"); }
  catch { return {}; }
}

export function setLocalAssignment(docId: string, folderId: string | null): void {
  const assigns = getLocalAssignments();
  if (folderId === null) delete assigns[docId];
  else assigns[docId] = folderId;
  localStorage.setItem(ASSIGN_KEY, JSON.stringify(assigns));
  notify();
}

// ── Stars ─────────────────────────────────────────────────────────────────────

export function getLocalStarred(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STARS_KEY) || "[]")); }
  catch { return new Set(); }
}

export function toggleLocalStar(docId: string): boolean {
  const stars = getLocalStarred();
  const next  = !stars.has(docId);
  if (next) stars.add(docId); else stars.delete(docId);
  localStorage.setItem(STARS_KEY, JSON.stringify([...stars]));
  notify();
  return next;
}
