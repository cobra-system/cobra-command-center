import { toast } from "sonner";
import { logger } from "./logger";
import { getSentry } from "./sentry";

/**
 * Extracts a human-readable error message from various error types.
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
    if (typeof e.error_description === "string") return e.error_description;
  }
  return "שגיאה לא צפויה";
}

/**
 * Centralized error handler.
 * Shows a toast notification and logs the error in development.
 *
 * @param error - The caught error (any type)
 * @param userMessage - Optional user-facing message override (Hebrew)
 */
export function handleError(error: unknown, userMessage?: string): void {
  const message = userMessage || extractMessage(error);

  logger.error("[handleError]", error);
  getSentry()?.captureException(
    error instanceof Error ? error : new Error(message),
  );

  toast.error(message);
}
