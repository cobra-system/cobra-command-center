import { describe, it, expect, beforeEach, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  enabled: false,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("./sentry", () => ({
  getSentry: () => (sentry.enabled ? { captureException: sentry.captureException } : null),
}));

vi.mock("./logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { handleError } from "./errorHandler";
import { toast } from "sonner";

describe("handleError", () => {
  beforeEach(() => {
    sentry.captureException.mockReset();
    sentry.enabled = false;
    (toast.error as ReturnType<typeof vi.fn>).mockReset();
  });

  it("shows Error.message via toast", () => {
    handleError(new Error("Something broke"));
    expect(toast.error).toHaveBeenCalledWith("Something broke");
  });

  it("shows string errors directly", () => {
    handleError("Network failure");
    expect(toast.error).toHaveBeenCalledWith("Network failure");
  });

  it("extracts .message from plain objects", () => {
    handleError({ message: "Bad request" });
    expect(toast.error).toHaveBeenCalledWith("Bad request");
  });

  it("extracts .error from plain objects", () => {
    handleError({ error: "Unauthorized" });
    expect(toast.error).toHaveBeenCalledWith("Unauthorized");
  });

  it("extracts .error_description from plain objects", () => {
    handleError({ error_description: "Token expired" });
    expect(toast.error).toHaveBeenCalledWith("Token expired");
  });

  it("falls back to Hebrew message for unknown types", () => {
    handleError(42);
    expect(toast.error).toHaveBeenCalledWith("שגיאה לא צפויה");
  });

  it("falls back to Hebrew message for null", () => {
    handleError(null);
    expect(toast.error).toHaveBeenCalledWith("שגיאה לא צפויה");
  });

  it("uses userMessage override when provided", () => {
    handleError(new Error("technical"), "שגיאה בשמירה");
    expect(toast.error).toHaveBeenCalledWith("שגיאה בשמירה");
  });
});

describe("handleError — Sentry capture path", () => {
  beforeEach(() => {
    sentry.captureException.mockReset();
    sentry.enabled = true;
    (toast.error as ReturnType<typeof vi.fn>).mockReset();
  });

  it("forwards an Error instance to Sentry verbatim", () => {
    const err = new Error("kaboom");
    handleError(err);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("wraps non-Error values in a fresh Error with the resolved message", () => {
    handleError("plain string failure", "שגיאה בשמירה");
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const arg = sentry.captureException.mock.calls[0][0];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe("שגיאה בשמירה");
  });
});
