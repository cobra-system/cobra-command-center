import React, { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { resolveCurrentUserPermissions, type PermissionLevel, type RolePermissions } from "@/lib/permissions";
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
  createEmployee: (data: { name: string; role: Role; email: string; password: string; role_definition_id?: string; allowed_product_ids?: string[]; division?: string }) => Promise<string | null>;
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
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return (data as Profile[]) ?? [];
    },
  });

  const { data: roleDefinitions = [] } = useQuery({
    queryKey: ["roleDefinitions"],
    queryFn: async () => {
      const { data } = await supabase.from("role_definitions").select("*").order("created_at");
      return (data as RoleDefinition[]) ?? [];
    },
  });

  const { data: rolePermissions = [] } = useQuery({
    queryKey: ["rolePermissions"],
    queryFn: async () => {
      const { data } = await supabase.from("role_permissions").select("*");
      return (data as RolePermissionRecord[]) ?? [];
    },
  });

  const refreshProfiles = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
  }, [queryClient]);

  const refreshRoleDefinitions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["roleDefinitions"] });
  }, [queryClient]);

  const refreshRolePermissions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["rolePermissions"] });
  }, [queryClient]);

  const upsertRolePermission = useCallback(async (role: string, moduleKey: string, level: PermissionLevel) => {
    try {
      const { error } = await supabase.from("role_permissions").upsert(
        { role, module_key: moduleKey, permission_level: level } as Record<string, unknown>,
        { onConflict: "role,module_key" }
      );
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["rolePermissions"] });
    } catch (err) {
      handleError(err, "שגיאה בעדכון הרשאות: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const addProfile = useCallback(async (profile: { email: string; name: string; role: Role }) => {
    try {
      const res = await supabase.functions.invoke("create-employee", {
        body: { email: profile.email, name: profile.name, role: profile.role },
      });
      if (res.error) throw new Error(res.error.message);
      await queryClient.refetchQueries({ queryKey: ["profiles"] });
      toast.success("עובד נוסף בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בהוספת עובד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const updateProfile = useCallback(async (id: string, updates: Partial<Profile>) => {
    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["profiles"] });
      toast.success("פרופיל עודכן בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בעדכון פרופיל: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const createEmployee = useCallback(async (data: { name: string; role: Role; email: string; password: string; role_definition_id?: string; allowed_product_ids?: string[]; division?: string }): Promise<string | null> => {
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
      await queryClient.refetchQueries({ queryKey: ["profiles"] });
      return null;
    } catch (err) {
      console.error("Error creating employee:", err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      return errorMsg || "שגיאה בחיבור לשרת";
    }
  }, [queryClient]);

  const addRoleDefinition = useCallback(async (name: string) => {
    try {
      const { error } = await supabase.from("role_definitions").insert({ name } as Record<string, unknown>);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["roleDefinitions"] });
      toast.success("תפקיד נוסף בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בהוספת תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const updateRoleDefinition = useCallback(async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("role_definitions").update({ name } as Record<string, unknown>).eq("id", id);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["roleDefinitions"] });
      toast.success("תפקיד עודכן בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה בעדכון תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const deleteRoleDefinition = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("role_definitions").delete().eq("id", id);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["roleDefinitions"] });
      toast.success("תפקיד נמחק בהצלחה");
    } catch (err) {
      handleError(err, "שגיאה במחיקת תפקיד: " + (err instanceof Error ? err.message : "נסה שוב"));
    }
  }, [queryClient]);

  const currentUserPermissions: RolePermissions = useMemo(
    () => resolveCurrentUserPermissions(currentUser, roleDefinitions, rolePermissions),
    [currentUser, rolePermissions, roleDefinitions],
  );

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
