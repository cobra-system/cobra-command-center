import { describe, it, expect, beforeEach, vi } from "vitest";

const supa = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
}));

const log = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: supa.getUser },
    from: (_table: string) => ({ insert: supa.insert }),
  },
}));

vi.mock("@/lib/logger", () => ({ logger: log }));

import { logActivity } from "./activityLogger";

beforeEach(() => {
  supa.getUser.mockReset();
  supa.insert.mockReset();
  log.warn.mockReset();
});

describe("logActivity", () => {
  it("inserts an audit row when authenticated, with the expected payload", async () => {
    supa.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    supa.insert.mockResolvedValue({ error: null });

    await logActivity({
      action: "ORDER_CREATED",
      entityType: "order",
      entityId: "o-1",
      details: { foo: "bar" },
    });

    expect(supa.insert).toHaveBeenCalledTimes(1);
    expect(supa.insert).toHaveBeenCalledWith({
      user_id: "u-1",
      action: "ORDER_CREATED",
      entity_type: "order",
      entity_id: "o-1",
      details: { foo: "bar" },
    });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("defaults entity_id to null and details to {} when omitted", async () => {
    supa.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    supa.insert.mockResolvedValue({ error: null });

    await logActivity({ action: "PING", entityType: "system" });

    expect(supa.insert).toHaveBeenCalledWith({
      user_id: "u-1",
      action: "PING",
      entity_type: "system",
      entity_id: null,
      details: {},
    });
  });

  it("returns silently and does not insert when there is no authenticated user", async () => {
    supa.getUser.mockResolvedValue({ data: { user: null } });

    await expect(
      logActivity({ action: "PING", entityType: "system" }),
    ).resolves.toBeUndefined();

    expect(supa.insert).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("does not throw when insert returns an error — logs a warning instead", async () => {
    supa.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    supa.insert.mockResolvedValue({ error: { message: "RLS violated" } });

    await expect(
      logActivity({ action: "PING", entityType: "system" }),
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      "Failed to log activity",
      expect.objectContaining({ error: "RLS violated", action: "PING" }),
    );
  });

  it("does not throw when getUser rejects — outer catch logs a warning", async () => {
    supa.getUser.mockRejectedValue(new Error("network down"));

    await expect(
      logActivity({ action: "PING", entityType: "system" }),
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      "Activity logging error",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(supa.insert).not.toHaveBeenCalled();
  });

  it("does not throw when getUser returns a malformed { data: null } result", async () => {
    // Real-world regression: the destructure `const { data: { user } } = ...`
    // throws synchronously when data is null. Must hit the outer catch.
    supa.getUser.mockResolvedValue({ data: null });

    await expect(
      logActivity({ action: "PING", entityType: "system" }),
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      "Activity logging error",
      expect.any(Object),
    );
    expect(supa.insert).not.toHaveBeenCalled();
  });

  it("does not throw when insert itself rejects", async () => {
    supa.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    supa.insert.mockRejectedValue(new Error("conn reset"));

    await expect(
      logActivity({ action: "PING", entityType: "system" }),
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      "Activity logging error",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});
