import { useState } from "react";
import { useData } from "@/contexts/AppContext";
import { MODULES, type PermissionLevel } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ChevronLeft, ChevronDown } from "lucide-react";

const permissionLabels: Record<PermissionLevel, string> = {
  none: "ללא",
  view: "צפייה",
  edit: "עריכה",
};

const categoryLabels: Record<string, string> = {
  Core: "פעולות ליבה",
  Tasks: "משימות ותכנון",
  Documents: "מסמכים ובעיות",
  Warehouse: "ניהול מחסן",
};

export default function RolePermissionsManager() {
  const { rolePermissions, upsertRolePermission, roleDefinitions } = useData();
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const displayRoles = roleDefinitions.filter((rd) => rd.system_key !== "MANAGER");

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

  const toggleCategory = (catKey: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return next;
    });
  };

  const groupedModules = Object.groupBy(MODULES, (mod) => mod.category);

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          הרשאות תפקידים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          הגדר עבור כל תפקיד אילו דפים נגישים ומה ניתן לעשות בהם
        </p>

        <div className="space-y-4">
          {displayRoles.map((rd) => {
            const roleKey = getRoleKey(rd.id);
            return (
              <Card key={rd.id} className="border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-foreground">{rd.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(groupedModules).map(([category, modules]) => {
                    const catKey = `${rd.id}:${category}`;
                    const isCollapsed = collapsedCategories.has(catKey);
                    return (
                      <div key={category} className="space-y-2">
                        <button
                          onClick={() => toggleCategory(catKey)}
                          className="flex items-center gap-2 pb-2 w-full text-start hover:opacity-70 transition-opacity"
                        >
                          {isCollapsed
                            ? <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          }
                          <h4 className="text-sm font-semibold text-foreground">
                            {categoryLabels[category] || category}
                          </h4>
                        </button>

                        {!isCollapsed && (
                          <div className="ms-6 space-y-2">
                            {modules?.map((mod) => (
                              <div
                                key={mod.key}
                                className="flex items-center justify-between rounded px-3 py-2 hover:bg-muted/50 transition-colors"
                              >
                                <label className="text-sm font-medium text-foreground cursor-pointer flex-1">
                                  {mod.label}
                                </label>
                                <Select
                                  value={getPermission(roleKey, mod.key)}
                                  onValueChange={(val) => handleChange(roleKey, mod.key, val as PermissionLevel)}
                                >
                                  <SelectTrigger className="h-8 text-xs w-[100px]" dir="rtl">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent dir="rtl">
                                    <SelectItem value="none">{permissionLabels.none}</SelectItem>
                                    <SelectItem value="view">{permissionLabels.view}</SelectItem>
                                    <SelectItem value="edit">{permissionLabels.edit}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
