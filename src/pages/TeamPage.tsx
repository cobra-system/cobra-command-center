import { useState, useMemo } from "react";
import { useAuth, useData, roleLabel, type Role } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { toast } from "sonner";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

type SortKey = "name" | "role";


export default function TeamPage() {
  const { currentUser } = useAuth();
  const { profiles, createEmployee, refreshProfiles, roleDefinitions } = useData();

  const prefs = useTablePreferences("TeamPage", {
    sortField: "name",
  });

  const sortKey = prefs.sortField as SortKey | null;
  const sortDir = prefs.sortDir;

  // Build dynamic role label map (for display of existing profiles)
  const dynamicRoleLabel: Record<string, string> = { MANAGER: "מנהל" };
  roleDefinitions.forEach(rd => { if (rd.system_key) dynamicRoleLabel[rd.system_key] = rd.name; });
  const getRoleLabel = (role: string) => dynamicRoleLabel[role] || roleLabel[role] || role;

  // All non-manager role definitions (system + custom) for the dropdown
  const employeeRoleOptions = roleDefinitions.filter(rd => rd.system_key !== "MANAGER");
  const defaultRoleDefId = employeeRoleOptions[0]?.id ?? "";

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roleDefId, setRoleDefId] = useState<string>(defaultRoleDefId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isManager = currentUser?.role === "MANAGER";

  const sortedProfiles = useMemo(() => {
    let result = [...profiles];
    if (sortKey && sortDir) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "name":
            cmp = a.name.localeCompare(b.name, "he");
            break;
          case "role":
            cmp = getRoleLabel(a.role).localeCompare(getRoleLabel(b.role), "he");
            break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    } else {
      // Default sort by name
      result.sort((a, b) => a.name.localeCompare(b.name, "he"));
    }
    return result;
  }, [profiles, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const resetForm = () => { setName(""); setRoleDefId(defaultRoleDefId); setEmail(""); setPassword(""); setEditingId(null); };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (!editingId && (!email.trim() || password.length < 6)) return;
    setSubmitting(true);

    // Derive base app_role from selected role definition's system_key (or fallback to DRIVER)
    const selectedRoleDef = roleDefinitions.find(rd => rd.id === roleDefId);
    const baseRole: Role = (selectedRoleDef?.system_key as Role) ?? "DRIVER";

    if (editingId) {
      // Update via edge function
      try {
        const sess = await supabase.auth.getSession();
        const body: Record<string, any> = {
          action: "update",
          employee_id: editingId,
          name: name.trim(),
          role: baseRole,
          role_definition_id: roleDefId || null,
        };
        if (password.length >= 6) body.password = password;
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
        if (!res.ok) {
          toast.error(result.error || "שגיאה בעדכון");
        } else {
          toast.success("העובד עודכן בהצלחה");
          await refreshProfiles();
        }
      } catch {
        toast.error("שגיאה בחיבור לשרת");
      }
    } else {
      const error = await createEmployee({
        name: name.trim(),
        role: baseRole,
        email: email.trim(),
        password,
        role_definition_id: roleDefId || undefined,
      });
      if (error) {
        toast.error(error);
      } else {
        toast.success(`${name} נוסף בהצלחה`);
      }
    }

    setSubmitting(false);
    resetForm();
    setOpen(false);
  };

  const handleEdit = (profile: { id: string; name: string; role: Role; role_definition_id?: string | null }) => {
    setEditingId(profile.id);
    setName(profile.name);
    // Use role_definition_id if available, otherwise find the matching definition by system_key
    const defId = profile.role_definition_id
      || roleDefinitions.find(rd => rd.system_key === profile.role)?.id
      || defaultRoleDefId;
    setRoleDefId(defId);
    setEmail("");
    setPassword("");
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
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
      if (!res.ok) {
        toast.error(result.error || "שגיאה במחיקה");
      } else {
        toast.success("העובד נמחק");
        await refreshProfiles();
      }
    } catch {
      toast.error("שגיאה בחיבור לשרת");
    }
    setSubmitting(false);
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">צוות</h1>
        {isManager && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 ml-2" />עובד חדש</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "עריכת עובד" : "הוספת עובד חדש"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>שם *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="שם העובד" />
                </div>
                <div className="space-y-2">
                  <Label>תפקיד</Label>
                  <Select value={roleDefId} onValueChange={setRoleDefId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {employeeRoleOptions.map(rd => <SelectItem key={rd.id} value={rd.id}>{rd.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {!editingId && (
                  <div className="space-y-2">
                    <Label>אימייל *</Label>
                    <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@example.com" type="email" dir="ltr" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{editingId ? "סיסמה חדשה (אופציונלי)" : "סיסמה (לפחות 6 תווים) *"}</Label>
                  <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" type="password" dir="ltr" />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!name.trim() || (!editingId && (!email.trim() || password.length < 6)) || submitting}
                  className="w-full"
                >
                  {submitting ? "שומר..." : editingId ? "עדכן עובד" : "הוסף עובד"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("name")}>
              <span className="flex items-center gap-1">שם <SortIcon col="name" /></span>
            </th>
            <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("role")}>
              <span className="flex items-center gap-1">תפקיד <SortIcon col="role" /></span>
            </th>
            {isManager && <th className="text-right p-3 font-semibold text-foreground">פעולות</th>}
          </tr></thead>
          <tbody className="divide-y">
            {sortedProfiles.map(u => (
              <tr key={u.id}>
                <td className="p-3 font-medium text-foreground">{u.name}</td>
                <td className="p-3 text-muted-foreground">
                  {u.role_definition_id
                    ? (roleDefinitions.find(rd => rd.id === u.role_definition_id)?.name ?? getRoleLabel(u.role))
                    : getRoleLabel(u.role)}
                </td>
                {isManager && (
                  <td className="p-3">
                    <div className="flex gap-1">
                      {u.role !== "MANAGER" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {deleteConfirm === u.id ? (
                            <div className="flex items-center gap-1">
                              <Button variant="destructive" size="sm" onClick={() => handleDelete(u.id)} disabled={submitting}>
                                {submitting ? "מוחק..." : "אישור"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>ביטול</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(u.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
