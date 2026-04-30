import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth, useData, roleLabel, type Role, type RoleDefinition } from "@/contexts/AppContext";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Lock, Pencil, User, Settings, Users, Shield, Bell, Check, X,
} from "lucide-react";
import RolePermissionsManager from "@/components/settings/RolePermissionsManager";
import RoleDefinitionManager from "@/components/settings/RoleDefinitionManager";
import UserManagementTable from "@/components/settings/UserManagementTable";
import NotificationSettings from "@/components/settings/NotificationSettings";
import AlertsContent from "@/components/settings/AlertsContent";
import { passwordChangeSchema } from "@/lib/schemas/passwordSchema";
import { employeeCreateSchema, employeeUpdateSchema } from "@/lib/schemas/employeeSchema";

type TabKey = "account" | "users" | "roles" | "notifications";
const VALID_TABS: TabKey[] = ["account", "users", "roles", "notifications"];

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { profiles, products, updateProfile, createEmployee, refreshProfiles, roleDefinitions, addRoleDefinition, updateRoleDefinition, deleteRoleDefinition } = useData();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = (VALID_TABS as string[]).includes(tabParam ?? "") ? (tabParam as TabKey) : "account";
  const setActiveTab = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next, { replace: true });
  };

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Employee form
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empRoleDefId, setEmpRoleDefId] = useState<string>("");
  const [empAllowedProductIds, setEmpAllowedProductIds] = useState<string[]>([]);
  const [empDivision, setEmpDivision] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Manager profile inline edit
  const [managerEditing, setManagerEditing] = useState(false);
  const [managerName, setManagerName] = useState(currentUser?.name || "");
  const [savingManager, setSavingManager] = useState(false);

  // Role definitions management
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [roleDeleteConfirm, setRoleDeleteConfirm] = useState<string | null>(null);

  const isManager = currentUser?.role === "MANAGER";
  const employees = profiles.filter(p => p.role !== "MANAGER");
  const managerProfile = profiles.find(p => p.role === "MANAGER");

  const dynamicRoleLabel: Record<string, string> = { MANAGER: "מנהל" };
  roleDefinitions.forEach(rd => {
    if (rd.system_key) dynamicRoleLabel[rd.system_key] = rd.name;
  });
  const getRoleLabel = (role: string) => dynamicRoleLabel[role] || roleLabel[role] || role;

  const nonManagerRoleDefinitions = roleDefinitions.filter(rd => rd.system_key !== "MANAGER");

  const handleChangePassword = async () => {
    const validation = passwordChangeSchema.safeParse({ newPassword, confirmPassword });
    if (!validation.success) { toast.error(validation.error.errors[0].message); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast.error(error.message); } else { toast.success("הסיסמה שונתה בהצלחה"); setNewPassword(""); setConfirmPassword(""); }
  };

  const resetEmpForm = () => { setEmpName(""); setEmpEmail(""); setEmpPassword(""); setEmpRoleDefId(""); setEmpAllowedProductIds([]); setEmpDivision(""); setEditingId(null); };

  const handleEmpSubmit = async () => {
    if (editingId) {
      const validation = employeeUpdateSchema.safeParse({ name: empName, password: empPassword, role_definition_id: empRoleDefId || undefined });
      if (!validation.success) { toast.error(validation.error.errors[0].message); return; }
    } else {
      const validation = employeeCreateSchema.safeParse({ name: empName, email: empEmail, password: empPassword, role_definition_id: empRoleDefId || undefined });
      if (!validation.success) { toast.error(validation.error.errors[0].message); return; }
    }

    const selectedRd = nonManagerRoleDefinitions.find(rd => rd.id === empRoleDefId);
    // Custom role_definitions may carry a non-enum system_key (e.g. "DIVISION_MANAGER").
    // Whitelist against the actual app_role enum so the backend never rejects it; the
    // custom role's identity is still preserved via role_definition_id.
    const VALID_BASE_ROLES = ["MANAGER", "WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER"] as const;
    const sysKey = selectedRd?.system_key;
    const resolvedRole: Role = (VALID_BASE_ROLES as readonly string[]).includes(sysKey ?? "")
      ? (sysKey as Role)
      : "DRIVER";

    setSubmitting(true);
    if (editingId) {
      try {
        const sess = await supabase.auth.getSession();
        const body: Record<string, unknown> = {
          action: "update",
          employee_id: editingId,
          name: empName.trim(),
          role: resolvedRole,
          role_definition_id: selectedRd?.id ?? null,
          allowed_product_ids: empAllowedProductIds.length > 0 ? empAllowedProductIds : null,
          division: empDivision || null,
        };
        if (empPassword.trim().length >= 6) body.password = empPassword.trim();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-employee`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${sess.data.session?.access_token}`,
          },
          body: JSON.stringify(body),
        });
        const result = await res.json();
        if (!res.ok) toast.error(result.error || "שגיאה בעדכון");
        else { toast.success("המשתמש עודכן"); await refreshProfiles(); }
      } catch (err) {
        console.error("Error updating employee:", err);
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        toast.error(errorMsg || "שגיאה בחיבור לשרת");
      }
    } else {
      const error = await createEmployee({
        name: empName.trim(),
        role: resolvedRole,
        email: empEmail.trim(),
        password: empPassword,
        role_definition_id: selectedRd?.id,
        allowed_product_ids: empAllowedProductIds.length > 0 ? empAllowedProductIds : undefined,
        division: empDivision || undefined,
      });
      if (error) toast.error(error);
      else toast.success(`${empName} נוסף בהצלחה`);
    }
    setSubmitting(false);
    resetEmpForm();
    setEmployeeOpen(false);
  };

  const handleEmpEdit = (profile: { id: string; name: string; role: Role; role_definition_id?: string | null; allowed_product_ids?: string[] | null; division?: string | null }) => {
    setEditingId(profile.id);
    setEmpName(profile.name);
    const matchingRd = nonManagerRoleDefinitions.find(rd => rd.id === profile.role_definition_id)
      ?? nonManagerRoleDefinitions.find(rd => rd.system_key === profile.role);
    setEmpRoleDefId(matchingRd?.id ?? "");
    setEmpAllowedProductIds(profile.allowed_product_ids ?? []);
    setEmpDivision(profile.division ?? "");
    setEmpPassword("");
    setEmpEmail("");
    setEmployeeOpen(true);
  };

  const handleEmpDelete = async (id: string) => {
    setSubmitting(true);
    try {
      const sess = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-employee`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${sess.data.session?.access_token}`,
        },
        body: JSON.stringify({ action: "delete", employee_id: id }),
      });
      const result = await res.json();
      if (!res.ok) toast.error(result.error || "שגיאה במחיקה");
      else { toast.success("העובד נמחק"); await refreshProfiles(); }
    } catch (err) {
      console.error("Error deleting employee:", err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      toast.error(errorMsg || "שגיאה בחיבור לשרת");
    }
    setSubmitting(false);
  };

  const startManagerEdit = () => {
    if (!managerProfile) return;
    setManagerName(managerProfile.name);
    setManagerEditing(true);
  };

  const handleSaveManagerName = async () => {
    if (!managerProfile || !managerName.trim()) return;
    setSavingManager(true);
    await updateProfile(managerProfile.id, { name: managerName.trim() });
    setSavingManager(false);
    setManagerEditing(false);
    toast.success("הפרופיל עודכן");
  };

  const resetRoleForm = () => { setRoleName(""); setEditingRoleId(null); };

  const handleRoleSubmit = async () => {
    if (!roleName.trim()) return;
    setRoleSubmitting(true);
    try {
      if (editingRoleId) {
        await updateRoleDefinition(editingRoleId, roleName.trim());
        toast.success("התפקיד עודכן");
      } else {
        await addRoleDefinition(roleName.trim());
        toast.success("תפקיד חדש נוסף");
      }
    } catch { toast.error("שגיאה בשמירה"); }
    setRoleSubmitting(false);
    resetRoleForm();
    setRoleDialogOpen(false);
  };

  const handleRoleEdit = (rd: RoleDefinition) => {
    setEditingRoleId(rd.id);
    setRoleName(rd.name);
    setRoleDialogOpen(true);
  };

  const handleRoleDelete = async (id: string) => {
    setRoleSubmitting(true);
    try {
      await deleteRoleDefinition(id);
      toast.success("התפקיד נמחק");
    } catch { toast.error("שגיאה במחיקה"); }
    setRoleSubmitting(false);
    setRoleDeleteConfirm(null);
  };

  return (
    <div className="space-y-6 max-w-6xl" dir="rtl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            חשבון
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              משתמשים
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              תפקידים והרשאות
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              התראות
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          {managerProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-lg"><User className="h-5 w-5" />פרופיל מנהל</div>
                  {!managerEditing && (
                    <Button variant="outline" size="sm" onClick={startManagerEdit}>
                      <Pencil className="h-3.5 w-3.5 ml-1" />עריכה
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {managerEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <div className="space-y-2">
                      <Label>שם</Label>
                      <Input value={managerName} onChange={e => setManagerName(e.target.value)} autoFocus />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveManagerName} disabled={savingManager || !managerName.trim()} size="sm">
                        <Check className="h-4 w-4 ml-1" />{savingManager ? "שומר..." : "שמור"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setManagerEditing(false)} disabled={savingManager}>
                        <X className="h-4 w-4 ml-1" />ביטול
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-muted-foreground mb-1">שם</p><p className="text-sm font-medium text-foreground">{managerProfile.name}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-1">תפקיד</p><p className="text-sm font-medium text-foreground">{getRoleLabel(managerProfile.role)}</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Lock className="h-5 w-5" />שינוי סיסמה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2"><Label>סיסמה חדשה</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="לפחות 6 תווים" /></div>
              <div className="space-y-2"><Label>אימות סיסמה</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="הזן שוב" /></div>
              <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword}>{changingPassword ? "משנה..." : "שנה סיסמה"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {isManager && (
          <TabsContent value="users" className="space-y-6">
            <UserManagementTable
              employees={employees}
              nonManagerRoleDefinitions={nonManagerRoleDefinitions}
              getRoleLabel={getRoleLabel}
              submitting={submitting}
              employeeOpen={employeeOpen}
              setEmployeeOpen={setEmployeeOpen}
              editingId={editingId}
              empName={empName}
              setEmpName={setEmpName}
              empEmail={empEmail}
              setEmpEmail={setEmpEmail}
              empPassword={empPassword}
              setEmpPassword={setEmpPassword}
              empRoleDefId={empRoleDefId}
              setEmpRoleDefId={setEmpRoleDefId}
              empAllowedProductIds={empAllowedProductIds}
              setEmpAllowedProductIds={setEmpAllowedProductIds}
              empDivision={empDivision}
              setEmpDivision={setEmpDivision}
              products={products}
              onEmpSubmit={handleEmpSubmit}
              onEmpReset={resetEmpForm}
              onEmpEdit={handleEmpEdit}
              onEmpDelete={handleEmpDelete}
            />
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="roles" className="space-y-6">
            <RoleDefinitionManager
              roleDefinitions={roleDefinitions}
              roleDialogOpen={roleDialogOpen}
              setRoleDialogOpen={setRoleDialogOpen}
              editingRoleId={editingRoleId}
              roleName={roleName}
              setRoleName={setRoleName}
              roleSubmitting={roleSubmitting}
              roleDeleteConfirm={roleDeleteConfirm}
              setRoleDeleteConfirm={setRoleDeleteConfirm}
              onRoleSubmit={handleRoleSubmit}
              onRoleEdit={handleRoleEdit}
              onRoleDelete={handleRoleDelete}
              onRoleFormReset={resetRoleForm}
            />
            <RolePermissionsManager />
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="notifications" className="space-y-6">
            <AlertsContent />
            <div className="border-t pt-6">
              <NotificationSettings />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
