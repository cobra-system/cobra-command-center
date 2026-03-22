import { useAuth, useData } from "@/contexts/AppContext";
import { canView, canEdit } from "@/lib/permissions";

export function usePermissions(moduleKey: string) {
  const { currentUser } = useAuth();
  const { currentUserPermissions } = useData();

  const isManager = currentUser?.role === "MANAGER";
  const hasView = isManager || canView(currentUserPermissions, moduleKey);
  const hasEdit = isManager || canEdit(currentUserPermissions, moduleKey);

  return { hasView, hasEdit, isManager };
}
