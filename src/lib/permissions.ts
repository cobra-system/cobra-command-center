export type PermissionLevel = "none" | "view" | "edit";
export type RolePermissions = Record<string, PermissionLevel>;

export interface ModuleDefinition {
  key: string;
  label: string;
  route: string;
}

export const MODULES: ModuleDefinition[] = [
  { key: "dashboard", label: "דשבורד", route: "/dashboard" },
  { key: "products", label: "מוצרים", route: "/products" },
  { key: "orders", label: "הזמנות", route: "/orders" },
  { key: "tasks", label: "משימות", route: "/tasks" },
  { key: "inventory", label: "מלאי", route: "/inventory" },
  { key: "documents", label: "מסמכים", route: "/documents" },
  { key: "suppliers", label: "ספקים", route: "/suppliers" },
  { key: "issues", label: "תקלות", route: "/issues" },
  { key: "reorder", label: "תכנון רכש", route: "/reorder" },
  { key: "reports", label: "דוחות", route: "/reports" },
  { key: "waste", label: "ניהול בלאי", route: "/waste-management" },
  { key: "equipment", label: "הצטיידויות ובלאי", route: "/equipment" },
];

export function canView(permissions: RolePermissions, moduleKey: string): boolean {
  const level = permissions[moduleKey];
  return level === "view" || level === "edit";
}

export function canEdit(permissions: RolePermissions, moduleKey: string): boolean {
  return permissions[moduleKey] === "edit";
}

export function getModuleKeyFromRoute(pathname: string): string | null {
  // Extract the first path segment: "/products/123" -> "/products"
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  const mod = MODULES.find((m) => m.route === base);
  return mod?.key ?? null;
}

export function getFullPermissionsForManager(): RolePermissions {
  return Object.fromEntries(MODULES.map((m) => [m.key, "edit" as PermissionLevel]));
}
