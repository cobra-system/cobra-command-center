import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { MODULES, getFullPermissionsForManager, type PermissionLevel, type RolePermissions } from "@/lib/permissions";
import type { Profile, Role, RoleDefinition, RolePermissionRecord } from "@/contexts/types";

interface RolesState {
  profiles: Profile[];
  roleDefinitions: RoleDefinition[];
  rolePermissions: RolePermissionRecord[];
  currentUserPermissions: RolePermissions;
  refreshProfiles: () => Promise<void>;
  refreshRoleDefinitions: () => Promise<void>;
  refreshRolePermissions: () => Promise<void>;
  addProfile: (profile: { email: string; name: string; role: Role }) => Promise<void>;
  updateProfile: (id: string, updates: Partial<Profile>) => Promise<void>;
  createEmployee: (data: { name: string; role: Role; email: string; password: string; role_definition_id?: string }) => Promise<string | null>;
  addRoleDefinition: (name: string) => Promise<void>;
  updateRoleDefinition: (id: string, name: string) => Promise<void>;
  deleteRoleDefinition: (id: string) => Promise<void>;
  upsertRolePermission: (role: string, moduleKey: string, level: PermissionLevel) => Promise<void>;
}

const RolesContext = createContext<RolesState | null>(null);

export function useRoles() {
  const ctx = useContext(RolesContext);
  if (!ctx) throw new Error("useRoles must be within RolesProvider");
  return ctx;
}

export function RolesProvider({ currentUser, children }: { currentUser: Profile | null; children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRecord[]>([]);

  const refreshProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setProfiles(data as Profile[]);
  }, []);

  const refreshRoleDefinitions = useCallback(async () => {
    const { data } = await supabase.from("role_definitions").select("*").order("created_at");
    if (data) setRoleDefinitions(data as RoleDefinition[]);
  }, []);

  const refreshRolePermissions = useCallback(async () => {
    const { data } = await supabase.from("role_permissions").select("*");
    if (data) setRolePermissions(data as RolePermissionRecord[]);
  }, []);

  const upsertRolePermission = useCallback(async (role: string, moduleKey: string, level: PermissionLevel) => {
    try {
      const { error } = await supabase.from("role_permissions").upsert(
        { role, module_key: moduleKey, permission_level: level } as any,
        { onConflict: "role,module_key" }
      );
      if (error) throw error;
      await refreshRolePermissions();
    } catch (err) {
      handleError(err, "שגיאה בעדכון הרשאות: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshRolePermissions]);

  const addProfile = useCallback(async (profile: { email: string; name: string; role: Role }) => {
    try {
      const res = await supabase.functions.invoke("create-employee", {
        body: { email: profile.email, name: profile.name, role: profile.role },
      });
      if (res.error) throw new Error(res.error.message);
      await refreshProfiles();
      toast.success("עובד נוסף בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בהוספת עובד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshProfiles]);

  const updateProfile = useCallback(async (id: string, updates: Partial<Profile>) => {
    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
      await refreshProfiles();
      toast.success("פרופיל עודכן בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בעדכון פרופיל: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshProfiles]);

  const createEmployee = useCallback(async (data: { name: string; role: Role; email: string; password: string; role_definition_id?: string }): Promise<string | null> => {
    try {
      const url = `${SUPABASE_URL}/functions/v1/create-employee`;
      const sess = await supabase.auth.getSession();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${sess.data.session?.access_token}`,
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) return result.error || "שגיאה ביצירת עובד";
      await refreshProfiles();
      return null;
    } catch {
      return "שגיאה בחיבור לשרת";
    }
  }, [refreshProfiles]);

  const addRoleDefinition = useCallback(async (name: string) => {
    try {
      const { error } = await supabase.from("role_definitions").insert({ name } as any);
      if (error) throw error;
      await refreshRoleDefinitions();
      toast.success("תפקיד נוסף בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בהוספת תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshRoleDefinitions]);

  const updateRoleDefinition = useCallback(async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("role_definitions").update({ name } as any).eq("id", id);
      if (error) throw error;
      await refreshRoleDefinitions();
      toast.success("תפקיד עודכן בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בעדכון תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshRoleDefinitions]);

  const deleteRoleDefinition = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("role_definitions").delete().eq("id", id);
      if (error) throw error;
      await refreshRoleDefinitions();
      toast.success("תפקיד נמחק בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה במחיקת תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [refreshRoleDefinitions]);

  const currentUserPermissions: RolePermissions = useMemo(() => {
    if (!currentUser || currentUser.role === "MANAGER") {
      return getFullPermissionsForManager();
    }
    // Determine the permission lookup key:
    // - If the user has a role_definition_id, find that definition and use system_key (for system roles)
    //   or the UUID (for custom roles) as the key stored in role_permissions.role
    // - Otherwise fall back to the profile's app_role value
    let effectiveRoleKey: string = currentUser.role;
    if (currentUser.role_definition_id) {
      const rd = roleDefinitions.find((r) => r.id === currentUser.role_definition_id);
      if (rd) effectiveRoleKey = rd.system_key ?? rd.id;
    }
    const perms: RolePermissions = {};
    for (const mod of MODULES) {
      const record = rolePermissions.find(
        (rp) => rp.role === effectiveRoleKey && rp.module_key === mod.key
      );
      perms[mod.key] = record?.permission_level ?? "none";
    }
    return perms;
  }, [currentUser, rolePermissions, roleDefinitions]);

  return (
    <RolesContext.Provider value={{
      profiles,
      roleDefinitions,
      rolePermissions,
      currentUserPermissions,
      refreshProfiles,
      refreshRoleDefinitions,
      refreshRolePermissions,
      addProfile,
      updateProfile,
      createEmployee,
      addRoleDefinition,
      updateRoleDefinition,
      deleteRoleDefinition,
      upsertRolePermission,
    }}>
      {children}
    </RolesContext.Provider>
  );
}
