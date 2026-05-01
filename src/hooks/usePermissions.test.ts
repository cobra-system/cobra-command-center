import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const ctx = vi.hoisted(() => ({
  currentUser: null as { role: string } | null,
  currentUserPermissions: {} as Record<string, "none" | "view" | "edit">,
}));

vi.mock("@/contexts/AppContext", () => ({
  useAuth: () => ({ currentUser: ctx.currentUser }),
  useData: () => ({ currentUserPermissions: ctx.currentUserPermissions }),
}));

import * as permissions from "@/lib/permissions";
import { usePermissions } from "./usePermissions";

beforeEach(() => {
  ctx.currentUser = null;
  ctx.currentUserPermissions = {};
  vi.restoreAllMocks();
});

describe("usePermissions", () => {
  it("MANAGER role short-circuits both permissions to true without consulting permissions table", () => {
    const canViewSpy = vi.spyOn(permissions, "canView");
    const canEditSpy = vi.spyOn(permissions, "canEdit");
    ctx.currentUser = { role: "MANAGER" };
    ctx.currentUserPermissions = {}; // empty — would otherwise deny everything

    const { result } = renderHook(() => usePermissions("orders"));

    expect(result.current).toEqual({ hasView: true, hasEdit: true, isManager: true });
    expect(canViewSpy).not.toHaveBeenCalled();
    expect(canEditSpy).not.toHaveBeenCalled();
  });

  it("non-manager with view-only permission has view but not edit", () => {
    ctx.currentUser = { role: "WAREHOUSE_MANAGER" };
    ctx.currentUserPermissions = { orders: "view" };

    const { result } = renderHook(() => usePermissions("orders"));

    expect(result.current).toEqual({ hasView: true, hasEdit: false, isManager: false });
  });

  it("non-manager with edit permission has both view and edit", () => {
    ctx.currentUser = { role: "WAREHOUSE_MANAGER" };
    ctx.currentUserPermissions = { orders: "edit" };

    const { result } = renderHook(() => usePermissions("orders"));

    expect(result.current).toEqual({ hasView: true, hasEdit: true, isManager: false });
  });

  it("non-manager with no permission entry gets neither view nor edit", () => {
    ctx.currentUser = { role: "WAREHOUSE_MANAGER" };
    ctx.currentUserPermissions = { products: "view" };

    const { result } = renderHook(() => usePermissions("orders"));

    expect(result.current).toEqual({ hasView: false, hasEdit: false, isManager: false });
  });

  it("forwards moduleKey through to canView/canEdit", () => {
    const canViewSpy = vi.spyOn(permissions, "canView");
    const canEditSpy = vi.spyOn(permissions, "canEdit");
    ctx.currentUser = { role: "DRIVER" };
    ctx.currentUserPermissions = { suppliers: "edit" };

    renderHook(() => usePermissions("suppliers"));

    expect(canViewSpy).toHaveBeenCalledWith({ suppliers: "edit" }, "suppliers");
    expect(canEditSpy).toHaveBeenCalledWith({ suppliers: "edit" }, "suppliers");
  });

  it("null currentUser falls through to canView/canEdit (not a manager)", () => {
    ctx.currentUser = null;
    ctx.currentUserPermissions = { orders: "edit" };

    const { result } = renderHook(() => usePermissions("orders"));

    expect(result.current.isManager).toBe(false);
    expect(result.current.hasView).toBe(true);
    expect(result.current.hasEdit).toBe(true);
  });
});
