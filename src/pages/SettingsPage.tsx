import { useState } from "react";
import { useAuth, useData, roleLabel, type Role, type RoleDefinition } from "@/contexts/AppContext";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Lock, Pencil, User, Settings,
} from "lucide-react";
import RolePermissionsManager from "@/components/settings/RolePermissionsManager";
import RoleDefinitionManager from "@/components/settings/RoleDefinitionManager";
import UserManagementTable from "@/components/settings/UserManagementTable";
import NotificationSettings from "@/components/settings/NotificationSettings";
import { passwordChangeSchema } from "@/lib/schemas/passwordSchema";
import { employeeCreateSchema, employeeUpdateSchema } from "@/lib/schemas/employeeSchema";

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { profiles, products, updateProfile, createEmployee, refreshProfiles, roleDefinitions, addRoleDefinition, updateRoleDefinition, deleteRoleDefinition } = useData();

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

  // Manager profile edit
  const [managerEditOpen, setManagerEditOpen] = useState(false);
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
    const resolvedRole: Role = (selectedRd?.system_key as Role) || "DRIVER";

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

  const handleSaveManagerName = async () => {
    if (!managerProfile || !managerName.trim()) return;
    setSavingManager(true);
    await updateProfile(managerProfile.id, { name: managerName.trim() });
    setSavingManager(false);
    setManagerEditOpen(false);
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
      </div>

      <div className="space-y-6 max-w-4xl">

      {/* Manager Profile */}
      {managerProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg"><User className="h-5 w-5" />פרופיל מנהל</div>
              <Button variant="outline" size="sm" onClick={() => { setManagerName(managerProfile.name); setManagerEditOpen(true); }}>
                <Pencil className="h-3.5 w-3.5 ml-1" />עריכה
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground mb-1">שם</p><p className="text-sm font-medium text-foreground">{managerProfile.name}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">תפקיד</p><p className="text-sm font-medium text-foreground">{getRoleLabel(managerProfile.role)}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Definitions Management */}
      {isManager && (
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
      )}

      {/* Role Permissions Management */}
      {isManager && <RolePermissionsManager />}

      {/* Notification Settings */}
      {isManager && <NotificationSettings />}

      {/* Change Password */}
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

      </div>{/* end max-w-4xl */}

      {/* Users Management */}
      {isManager && (
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
      )}

      {/* Manager Edit Dialog */}
      <Dialog open={managerEditOpen} onOpenChange={setManagerEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>עריכת פרופיל מנהל</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>שם</Label><Input value={managerName} onChange={e => setManagerName(e.target.value)} /></div>
            <Button onClick={handleSaveManagerName} disabled={savingManager || !managerName.trim()} className="w-full">
              {savingManager ? "שומר..." : "שמור"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
