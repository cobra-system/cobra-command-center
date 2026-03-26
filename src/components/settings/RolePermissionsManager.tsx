import { useData } from "@/contexts/AppContext";
import { MODULES, type PermissionLevel } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

const permissionLabels: Record<PermissionLevel, string> = {
  none: "ללא",
  view: "צפייה",
  edit: "עריכה",
};

export default function RolePermissionsManager() {
  const { rolePermissions, upsertRolePermission, roleDefinitions } = useData();

  // Show all non-manager roles (system and custom)
  const displayRoles = roleDefinitions.filter((rd) => rd.system_key !== "MANAGER");

  // Role key: system_key for system roles, id for custom roles
  const getRoleKey = (rdId: string): string => {
    const rd = roleDefinitions.find((r) => r.id === rdId);
    return rd ? (rd.system_key ?? rd.id) : rdId;
  };

  const getPermission = (roleKey: string, moduleKey: string): PermissionLevel => {
    const record = rolePermissions.find(
      (rp) => rp.role === roleKey && rp.module_key === moduleKey
    );
    return (record?.permission_level as PermissionLevel) ?? "none";
  };

  const handleChange = (roleKey: string, moduleKey: string, level: PermissionLevel) => {
    upsertRolePermission(roleKey, moduleKey, level);
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
              {displayRoles.map((rd) => {
                const roleKey = getRoleKey(rd.id);
                return (
                  <tr key={rd.id} className="border-b last:border-0">
                    <td className="py-3 px-2 font-medium">{rd.name}</td>
                    {MODULES.map((mod) => (
                      <td key={mod.key} className="py-2 px-1 text-center">
                        <Select
                          value={getPermission(roleKey, mod.key)}
                          onValueChange={(val) => handleChange(roleKey, mod.key, val as PermissionLevel)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
