import { useState } from "react";
import { useAuth, useData, roleLabel, type Role, type RoleDefinition } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";


export default function TeamPage() {
  const { currentUser } = useAuth();
  const { profiles, createEmployee, refreshProfiles, roleDefinitions } = useData();

  // Build dynamic role label map
  const dynamicRoleLabel: Record<string, string> = { MANAGER: "מנהל" };
  roleDefinitions.forEach(rd => { if (rd.system_key) dynamicRoleLabel[rd.system_key] = rd.name; });
  const getRoleLabel = (role: string) => dynamicRoleLabel[role] || roleLabel[role] || role;

  // Use role definitions for dropdown
  const roleOptions = roleDefinitions.length > 0
    ? roleDefinitions.map(rd => ({ value: (rd.system_key || rd.id) as Role, label: rd.name }))
    : [
        { value: "WAREHOUSE_MANAGER" as Role, label: "מנהל מחסן" },
        { value: "LOGISTICS" as Role, label: "לוגיסטיקה" },
        { value: "DRIVER" as Role, label: "נהג" },
      ];
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("DRIVER");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isManager = currentUser?.role === "MANAGER";

  const resetForm = () => { setName(""); setRole("DRIVER"); setPin(""); setEditingId(null); };

  const handleSubmit = async () => {
    if (!name.trim() || (!editingId && (!pin || pin.length !== 4))) return;
    setSubmitting(true);

    if (editingId) {
      // Update via edge function
      try {
        const sess = await supabase.auth.getSession();
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/manage-employee`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${sess.data.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "update",
            employee_id: editingId,
            name: name.trim(),
            role,
            pin: pin.length === 4 ? pin : undefined,
          }),
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
      const error = await createEmployee({ name: name.trim(), role, pin });
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

  const handleEdit = (profile: { id: string; name: string; role: Role; pin?: string | null }) => {
    setEditingId(profile.id);
    setName(profile.name);
    setRole(profile.role);
    setPin("");
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      const sess = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/manage-employee`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
                  <Select value={role} onValueChange={v => setRole(v as Role)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{editingId ? "קוד PIN חדש (אופציונלי)" : "קוד PIN (4 ספרות) *"}</Label>
                  <Input value={pin} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); }} placeholder="1234" dir="ltr" maxLength={4} />
                </div>
                <Button onClick={handleSubmit} disabled={!name.trim() || (!editingId && pin.length !== 4) || submitting} className="w-full">
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
            <th className="text-right p-3 font-semibold text-foreground">שם</th>
            <th className="text-right p-3 font-semibold text-foreground">תפקיד</th>
            <th className="text-right p-3 font-semibold text-foreground">PIN</th>
            {isManager && <th className="text-right p-3 font-semibold text-foreground">פעולות</th>}
          </tr></thead>
          <tbody className="divide-y">
            {profiles.map(u => (
              <tr key={u.id}>
                <td className="p-3 font-medium text-foreground">{u.name}</td>
                <td className="p-3 text-muted-foreground">{getRoleLabel(u.role)}</td>
                <td className="p-3 font-mono text-muted-foreground" dir="ltr">{isManager ? (u.pin || "—") : "••••"}</td>
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
