import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import type { RoleDefinition } from "@/contexts/AppContext";

interface RoleDefinitionManagerProps {
  roleDefinitions: RoleDefinition[];
  roleDialogOpen: boolean;
  setRoleDialogOpen: (v: boolean) => void;
  editingRoleId: string | null;
  roleName: string;
  setRoleName: (v: string) => void;
  roleSubmitting: boolean;
  roleDeleteConfirm: string | null;
  setRoleDeleteConfirm: (v: string | null) => void;
  onRoleSubmit: () => void;
  onRoleEdit: (rd: RoleDefinition) => void;
  onRoleDelete: (id: string) => void;
  onRoleFormReset: () => void;
}

export default function RoleDefinitionManager({
  roleDefinitions,
  roleDialogOpen,
  setRoleDialogOpen,
  editingRoleId,
  roleName,
  setRoleName,
  roleSubmitting,
  roleDeleteConfirm,
  setRoleDeleteConfirm,
  onRoleSubmit,
  onRoleEdit,
  onRoleDelete,
  onRoleFormReset,
}: RoleDefinitionManagerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg"><Tag className="h-5 w-5" />ניהול תפקידים</div>
          <Dialog open={roleDialogOpen} onOpenChange={(v) => { setRoleDialogOpen(v); if (!v) onRoleFormReset(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 ml-1" />תפקיד חדש</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>{editingRoleId ? "עריכת תפקיד" : "הוספת תפקיד חדש"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2"><Label>שם התפקיד *</Label><Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="לדוגמה: קניין, טכנאי..." /></div>
                <Button onClick={onRoleSubmit} disabled={!roleName.trim() || roleSubmitting} className="w-full">
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
                <Button variant="ghost" size="sm" onClick={() => onRoleEdit(rd)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {roleDeleteConfirm === rd.id ? (
                  <div className="flex items-center gap-1">
                    <Button variant="destructive" size="sm" onClick={() => onRoleDelete(rd.id)} disabled={roleSubmitting}>
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
  );
}
