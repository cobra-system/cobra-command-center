import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingId: string | null;
  empName: string;
  setEmpName: (v: string) => void;
  empEmail: string;
  setEmpEmail: (v: string) => void;
  empPassword: string;
  setEmpPassword: (v: string) => void;
  empRoleDefId: string;
  setEmpRoleDefId: (v: string) => void;
  nonManagerRoleDefinitions: Array<{ id: string; name: string; system_key?: string }>;
  submitting: boolean;
  onSubmit: () => void;
  onReset: () => void;
}

export default function EmployeeFormDialog({
  open,
  onOpenChange,
  editingId,
  empName,
  setEmpName,
  empEmail,
  setEmpEmail,
  empPassword,
  setEmpPassword,
  empRoleDefId,
  setEmpRoleDefId,
  nonManagerRoleDefinitions,
  submitting,
  onSubmit,
  onReset,
}: EmployeeFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) onReset(); }}>
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
            <Input
              type="password"
              value={empPassword}
              onChange={e => setEmpPassword(e.target.value)}
              placeholder={editingId ? "השאר ריק לאי-שינוי" : "לפחות 6 תווים"}
              dir="ltr"
            />
          </div>
          <Button
            onClick={onSubmit}
            disabled={!empName.trim() || (!editingId && (!empEmail.trim() || empPassword.length < 6)) || submitting}
            className="w-full"
          >
            {submitting ? "שומר..." : editingId ? "עדכן משתמש" : "הוסף משתמש"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
