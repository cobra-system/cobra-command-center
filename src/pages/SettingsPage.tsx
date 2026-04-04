import { useState } from "react";
import { useAuth, useData, roleLabel, type Role, type RoleDefinition } from "@/contexts/AppContext";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Lock, Users, Plus, Pencil, Trash2, User, Settings,
  Tag,
} from "lucide-react";
import RolePermissionsManager from "@/components/settings/RolePermissionsManager";

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { profiles, updateProfile, createEmployee, refreshProfiles, roleDefinitions, addRoleDefinition, updateRoleDefinition, deleteRoleDefinition } = useData();

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
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    if (newPassword.length < 6) { toast.error("הסיסמה חייבת להכיל לפחות 6 תווים"); return; }
    if (newPassword !== confirmPassword) { toast.error("הסיסמאות אינן תואמות"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast.error(error.message); } else { toast.success("הסיסמה שונתה בהצלחה"); setNewPassword(""); setConfirmPassword(""); }
  };

  const resetEmpForm = () => { setEmpName(""); setEmpEmail(""); setEmpPassword(""); setEmpRoleDefId(""); setEditingId(null); };

  const handleEmpSubmit = async () => {
    if (!empName.trim()) return;
    if (!editingId && (!empEmail.trim() || empPassword.length < 6)) return;

    const selectedRd = nonManagerRoleDefinitions.find(rd => rd.id === empRoleDefId);
    const resolvedRole: Role = (selectedRd?.system_key as Role) || "DRIVER";

    setSubmitting(true);
    if (editingId) {
      try {
        const sess = await supabase.auth.getSession();
        const body: Record<string, any> = {
          action: "update",
          employee_id: editingId,
          name: empName.trim(),
          role: resolvedRole,
          role_definition_id: selectedRd?.id ?? null,
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
      } catch { toast.error("שגיאה בחיבור לשרת"); }
    } else {
      const error = await createEmployee({
        name: empName.trim(),
        role: resolvedRole,
        email: empEmail.trim(),
        password: empPassword,
        role_definition_id: selectedRd?.id,
      });
      if (error) toast.error(error);
      else toast.success(`${empName} נוסף בהצלחה`);
    }
    setSubmitting(false);
    resetEmpForm();
    setEmployeeOpen(false);
  };

  const handleEmpEdit = (profile: { id: string; name: string; role: Role; role_definition_id?: string | null }) => {
    setEditingId(profile.id);
    setEmpName(profile.name);
    const matchingRd = nonManagerRoleDefinitions.find(rd => rd.id === profile.role_definition_id)
      ?? nonManagerRoleDefinitions.find(rd => rd.system_key === profile.role);
    setEmpRoleDefId(matchingRd?.id ?? "");
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
    } catch { toast.error("שגיאה בחיבור לשרת"); }
    setSubmitting(false);
    setDeleteConfirm(null);
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg"><Tag className="h-5 w-5" />ניהול תפקידים</div>
              <Dialog open={roleDialogOpen} onOpenChange={(v) => { setRoleDialogOpen(v); if (!v) resetRoleForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 ml-1" />תפקיד חדש</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader><DialogTitle>{editingRoleId ? "עריכת תפקיד" : "הוספת תפקיד חדש"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>שם התפקיד *</Label><Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="לדוגמה: קניין, טכנאי..." /></div>
                    <Button onClick={handleRoleSubmit} disabled={!roleName.trim() || roleSubmitting} className="w-full">
                      {roleSubmitting ? "שומר..." : editingRoleId ? "עדכן" : "הוסף תפקיד"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {roleDefinitions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">אין תפקידים מוגדרים</p>
              ) : roleDefinitions.map(rd => (
                <div key={rd.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{rd.name}</span>
                    {rd.system_key && <span className="text-xs text-muted-foreground">(מערכת)</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleRoleEdit(rd)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {roleDeleteConfirm === rd.id ? (
                      <div className="flex items-center gap-1">
                        <Button variant="destructive" size="sm" onClick={() => handleRoleDelete(rd.id)} disabled={roleSubmitting}>
                          {roleSubmitting ? "מוחק..." : "אישור"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRoleDeleteConfirm(null)}>ביטול</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRoleDeleteConfirm(rd.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Permissions Management */}
      {isManager && <RolePermissionsManager />}

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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" />ניהול משתמשים</div>
              <Dialog open={employeeOpen} onOpenChange={(v) => { setEmployeeOpen(v); if (!v) resetEmpForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 ml-1" />משתמש חדש</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>{editingId ? "עריכת משתמש" : "הוספת משתמש חדש"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>שם *</Label>
                      <Input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="שם המשתמש" />
                    </div>
                    {!editingId && (
                      <div className="space-y-2">
                        <Label>אימייל *</Label>
                        <Input type="email" value={empEmail} onChange={e => setEmpEmail(e.target.value)} placeholder="user@example.com" dir="ltr" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>תפקיד</Label>
                      <Select value={empRoleDefId} onValueChange={v => setEmpRoleDefId(v)}>
                        <SelectTrigger><SelectValue placeholder="בחר תפקיד" /></SelectTrigger>
                        <SelectContent>
                          {nonManagerRoleDefinitions.map(rd => (
                            <SelectItem key={rd.id} value={rd.id}>{rd.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{editingId ? "סיסמה חדשה (אופציונלי)" : "סיסמה ראשונית *"}</Label>
                      <Input type="password" value={empPassword} onChange={e => setEmpPassword(e.target.value)} placeholder={editingId ? "השאר ריק לאי-שינוי" : "לפחות 6 תווים"} dir="ltr" />
                    </div>
                    <Button
                      onClick={handleEmpSubmit}
                      disabled={!empName.trim() || (!editingId && (!empEmail.trim() || empPassword.length < 6)) || submitting}
                      className="w-full"
                    >
                      {submitting ? "שומר..." : editingId ? "עדכן משתמש" : "הוסף משתמש"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-semibold text-foreground">שם</th>
                    <th className="text-right p-3 font-semibold text-foreground">תפקיד</th>
                    <th className="text-right p-3 font-semibold text-foreground">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.length === 0 ? (
                    <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">אין משתמשים</td></tr>
                  ) : employees.map(u => {
                    const rd = nonManagerRoleDefinitions.find(r => r.id === u.role_definition_id)
                      ?? nonManagerRoleDefinitions.find(r => r.system_key === u.role);
                    const roleName = rd?.name ?? getRoleLabel(u.role);
                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-foreground">{u.name}</td>
                        <td className="p-3 text-muted-foreground">{roleName}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEmpEdit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {deleteConfirm === u.id ? (
                              <div className="flex items-center gap-1">
                                <Button variant="destructive" size="sm" onClick={() => handleEmpDelete(u.id)} disabled={submitting}>
                                  {submitting ? "מוחק..." : "אישור"}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>ביטול</Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(u.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
