import { useData, roleLabel, type Role } from "@/contexts/AppContext";
import { MODULES, type PermissionLevel } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

const NON_MANAGER_ROLES: Role[] = ["WAREHOUSE_MANAGER", "LOGISTICS", "DRIVER"];

const permissionLabels: Record<PermissionLevel, string> = {
  none: "ללא",
  view: "צפייה",
  edit: "עריכה",
};

export default function RolePermissionsManager() {
  const { rolePermissions, upsertRolePermission, roleDefinitions } = useData();

  const getRoleDisplayName = (role: Role): string => {
    const def = roleDefinitions.find((rd) => rd.system_key === role);
    return def?.name || roleLabel[role] || role;
  };

  const getPermission = (role: Role, moduleKey: string): PermissionLevel => {
    const record = rolePermissions.find(
      (rp) => rp.role === role && rp.module_key === moduleKey
    );
    return (record?.permission_level as PermissionLevel) ?? "none";
  };

  const handleChange = (role: Role, moduleKey: string, level: PermissionLevel) => {
    upsertRolePermission(role, moduleKey, level);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          הרשאות תפקידים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          הגדר עבור כל תפקיד אילו דפים נגישים ומה ניתן לעשות בהם
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right py-2 px-2 font-medium text-muted-foreground min-w-[120px]">
                  תפקיד / מודול
                </th>
                {MODULES.map((mod) => (
                  <th
                    key={mod.key}
                    className="text-center py-2 px-1 font-medium text-muted-foreground min-w-[90px]"
                  >
                    {mod.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NON_MANAGER_ROLES.map((role) => (
                <tr key={role} className="border-b last:border-0">
                  <td className="py-3 px-2 font-medium">{getRoleDisplayName(role)}</td>
                  {MODULES.map((mod) => (
                    <td key={mod.key} className="py-2 px-1 text-center">
                      <Select
                        value={getPermission(role, mod.key)}
                        onValueChange={(val) => handleChange(role, mod.key, val as PermissionLevel)}
                      >
                        <SelectTrigger className="h-8 text-xs w-[80px] mx-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{permissionLabels.none}</SelectItem>
                          <SelectItem value="view">{permissionLabels.view}</SelectItem>
                          <SelectItem value="edit">{permissionLabels.edit}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
