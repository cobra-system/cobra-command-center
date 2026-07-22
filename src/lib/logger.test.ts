import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger, setLogContext, resetLogContext, registerSentryHooks } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset persistent context
    resetLogContext();
    // Reset Sentry hooks with no-op to clear previous registration
    registerSentryHooks({
      captureException: () => {},
      addBreadcrumb: () => {},
    });
  });

  it("logger.info calls console.info with structured prefix", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test message");
    expect(spy).toHaveBeenCalledOnce();
    const args = spy.mock.calls[0];
    expect(args[0]).toMatch(/\[INFO\] \[\d{4}-/);
    expect(args[1]).toBe("test message");
  });

  it("logger.warn calls console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("warning");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toMatch(/\[WARN\]/);
  });

  it("logger.error calls console.error with error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    logger.error("failed", err);
    expect(spy).toHaveBeenCalledOnce();
    const args = spy.mock.calls[0];
    expect(args[0]).toMatch(/\[ERROR\]/);
    expect(args[1]).toBe("failed");
    expect(args[2]).toBe(err);
  });

  it("logger.error works without error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("simple error");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][1]).toBe("simple error");
  });

  it("includes context in log output", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("with context", { module: "orders", action: "create" });
    const args = spy.mock.calls[0];
    expect(args[2]).toEqual({ module: "orders", action: "create" });
  });

  it("merges persistent context via setLogContext", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    setLogContext({ userId: "abc", role: "MANAGER" });
    logger.info("msg", { extra: true });
    const args = spy.mock.calls[0];
    expect(args[2]).toEqual({ userId: "abc", role: "MANAGER", extra: true });
  });

  it("persistent context accumulates across setLogContext calls", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    setLogContext({ userId: "abc" });
    setLogContext({ role: "MANAGER" });
    logger.info("msg");
    const args = spy.mock.calls[0];
    expect(args[2]).toEqual({ userId: "abc", role: "MANAGER" });
  });

  it("omits context object when empty", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("no context");
    expect(spy.mock.calls[0]).toHaveLength(2); // prefix + message only
  });

  it("logger.debug calls console.debug in dev mode", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.debug("debug msg");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toMatch(/\[DEBUG\]/);
  });

  describe("Sentry integration", () => {
    it("calls captureException when registered and logger.error is called", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const capture = vi.fn();
      registerSentryHooks({ captureException: capture, addBreadcrumb: () => {} });
      const err = new Error("test");
      logger.error("oops", err, { module: "orders" });
      expect(capture).toHaveBeenCalledWith(err, { module: "orders" });
    });

    it("creates Error from message when error arg is not Error instance", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const capture = vi.fn();
      registerSentryHooks({ captureException: capture, addBreadcrumb: () => {} });
      logger.error("string error");
      expect(capture).toHaveBeenCalledOnce();
      expect(capture.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(capture.mock.calls[0][0].message).toBe("string error");
    });

    it("calls addBreadcrumb for info/warn logs", () => {
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const breadcrumb = vi.fn();
      registerSentryHooks({ captureException: () => {}, addBreadcrumb: breadcrumb });
      logger.info("info msg", { x: 1 });
      logger.warn("warn msg");
      expect(breadcrumb).toHaveBeenCalledTimes(2);
      expect(breadcrumb.mock.calls[0][0]).toBe("info");
      expect(breadcrumb.mock.calls[1][0]).toBe("warn");
    });
  });
});
