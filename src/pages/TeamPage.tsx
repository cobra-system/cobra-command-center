import { useState } from "react";
import { useAuth, useData, roleLabel, type Role } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const roleOptions: { value: Role; label: string }[] = [
  { value: "WAREHOUSE_MANAGER", label: "מנהל מחסן" },
  { value: "LOGISTICS", label: "לוגיסטיקה" },
  { value: "DRIVER", label: "נהג" },
];

export default function TeamPage() {
  const { currentUser } = useAuth();
  const { profiles, createEmployee } = useData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("DRIVER");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => { setName(""); setRole("DRIVER"); setPin(""); };

  const handleSubmit = async () => {
    if (!name.trim() || !pin || pin.length !== 4) return;
    setSubmitting(true);
    const error = await createEmployee({ name: name.trim(), role, pin });
    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success(`${name} נוסף בהצלחה`);
      resetForm();
      setOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">צוות</h1>
        {currentUser?.role === "MANAGER" && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 ml-2" />עובד חדש</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>הוספת עובד חדש</DialogTitle></DialogHeader>
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
                  <Label>קוד PIN (4 ספרות) *</Label>
                  <Input value={pin} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); }} placeholder="1234" dir="ltr" maxLength={4} />
                </div>
                <Button onClick={handleSubmit} disabled={!name.trim() || pin.length !== 4 || submitting} className="w-full">
                  {submitting ? "יוצר..." : "הוסף עובד"}
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
          </tr></thead>
          <tbody className="divide-y">
            {profiles.map(u => (
              <tr key={u.id}>
                <td className="p-3 font-medium text-foreground">{u.name}</td>
                <td className="p-3 text-muted-foreground">{roleLabel[u.role] || u.role}</td>
                <td className="p-3 font-mono text-muted-foreground" dir="ltr">{currentUser?.role === "MANAGER" ? (u.pin || "—") : "••••"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
