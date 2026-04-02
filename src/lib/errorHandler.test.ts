import { describe, it, expect, vi } from "vitest";
import { handleError } from "./errorHandler";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("handleError", () => {
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
