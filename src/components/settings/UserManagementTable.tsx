import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Package } from "lucide-react";
import type { Role } from "@/contexts/AppContext";
import type { Product } from "@/contexts/types";
import EmployeeFormDialog from "./EmployeeFormDialog";

interface Employee {
  id: string;
  name: string;
  role: Role;
  role_definition_id?: string | null;
  allowed_product_ids?: string[] | null;
  division?: string | null;
}

interface UserManagementTableProps {
  employees: Employee[];
  nonManagerRoleDefinitions: Array<{ id: string; name: string; system_key?: string }>;
  getRoleLabel: (role: string) => string;
  submitting: boolean;
  employeeOpen: boolean;
  setEmployeeOpen: (v: boolean) => void;
  editingId: string | null;
  empName: string;
  setEmpName: (v: string) => void;
  empEmail: string;
  setEmpEmail: (v: string) => void;
  empPassword: string;
  setEmpPassword: (v: string) => void;
  empRoleDefId: string;
  setEmpRoleDefId: (v: string) => void;
  empAllowedProductIds: string[];
  setEmpAllowedProductIds: (v: string[]) => void;
  empDivision: string;
  setEmpDivision: (v: string) => void;
  products: Product[];
  onEmpSubmit: () => void;
  onEmpReset: () => void;
  onEmpEdit: (profile: Employee) => void;
  /** Resolves when the delete operation is complete (success or failure). */
  onEmpDelete: (id: string) => Promise<void>;
}

export default function UserManagementTable({
  employees,
  nonManagerRoleDefinitions,
  getRoleLabel,
  submitting,
  employeeOpen,
  setEmployeeOpen,
  editingId,
  empName,
  setEmpName,
  empEmail,
  setEmpEmail,
  empPassword,
  setEmpPassword,
  empRoleDefId,
  setEmpRoleDefId,
  empAllowedProductIds,
  setEmpAllowedProductIds,
  empDivision,
  setEmpDivision,
  products,
  onEmpSubmit,
  onEmpReset,
  onEmpEdit,
  onEmpDelete,
}: UserManagementTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" />ניהול משתמשים</div>
          <Button size="sm" onClick={() => setEmployeeOpen(true)}>
            <Plus className="h-4 w-4 ml-1" />משתמש חדש
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">שם</th>
                <th className="text-right p-3 font-semibold text-foreground">תפקיד</th>
                <th className="text-right p-3 font-semibold text-foreground">חטיבה</th>
                <th className="text-right p-3 font-semibold text-foreground">גישה למוצרים</th>
                <th className="text-right p-3 font-semibold text-foreground">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">אין משתמשים</td></tr>
              ) : employees.map(u => {
                const rd = nonManagerRoleDefinitions.find(r => r.id === u.role_definition_id)
                  ?? nonManagerRoleDefinitions.find(r => r.system_key === u.role);
                const displayRole = rd?.name ?? getRoleLabel(u.role);
                return (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">{u.name}</td>
                    <td className="p-3 text-muted-foreground">{displayRole}</td>
                    <td className="p-3 text-muted-foreground">{u.division ?? "—"}</td>
                    <td className="p-3">
                      {u.allowed_product_ids && u.allowed_product_ids.length > 0 ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Package className="h-3 w-3" />
                          {u.allowed_product_ids.length} מוצרים
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">הכל</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onEmpEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {deleteConfirm === u.id ? (
                          <div className="flex items-center gap-1">
                            <Button variant="destructive" size="sm" onClick={() => onEmpDelete(u.id).then(() => setDeleteConfirm(null))} disabled={submitting}>
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

      <EmployeeFormDialog
        open={employeeOpen}
        onOpenChange={setEmployeeOpen}
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
        nonManagerRoleDefinitions={nonManagerRoleDefinitions}
        products={products}
        submitting={submitting}
        onSubmit={onEmpSubmit}
        onReset={onEmpReset}
      />
    </Card>
  );
}
