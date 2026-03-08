import { useState } from "react";
import { useAuth, useData, roleLabel, type Role } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Users } from "lucide-react";

const roleOptions: { value: Role; label: string }[] = [
  { value: "MANAGER", label: "מנהל" },
  { value: "WAREHOUSE_MANAGER", label: "מנהל מחסן" },
  { value: "LOGISTICS", label: "לוגיסטיקה" },
  { value: "DRIVER", label: "נהג" },
];

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { profiles, updateProfile } = useData();

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("הסיסמאות אינן תואמות");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("הסיסמה שונתה בהצלחה");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  // Role management
  const employees = profiles.filter(p => p.id !== currentUser?.id);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdatingId(userId);
    await updateProfile(userId, { role: newRole });
    setUpdatingId(null);
    toast.success("התפקיד עודכן");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" />שינוי סיסמה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>סיסמה חדשה</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="לפחות 6 תווים" />
          </div>
          <div className="space-y-2">
            <Label>אימות סיסמה</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="הזן שוב" />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword}>
            {changingPassword ? "משנה..." : "שנה סיסמה"}
          </Button>
        </CardContent>
      </Card>

      {/* Manage Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />ניהול הרשאות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold text-foreground">שם</th>
                  <th className="text-right p-3 font-semibold text-foreground">תפקיד נוכחי</th>
                  <th className="text-right p-3 font-semibold text-foreground">שנה תפקיד</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map(u => (
                  <tr key={u.id}>
                    <td className="p-3 font-medium text-foreground">{u.name}</td>
                    <td className="p-3 text-muted-foreground">{roleLabel[u.role] || u.role}</td>
                    <td className="p-3">
                      <Select
                        value={u.role}
                        onValueChange={v => handleRoleChange(u.id, v as Role)}
                        disabled={updatingId === u.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
