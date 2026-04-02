import * as Sentry from "@sentry/react";
import { registerSentryHooks } from "./logger";

let initialized = false;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.2,
  });

  initialized = true;

  // Wire Sentry into the structured logger
  registerSentryHooks({
    captureException(error, extra) {
      Sentry.captureException(error, { extra });
    },
    addBreadcrumb(level, message, data) {
      Sentry.addBreadcrumb({
        category: "log",
        message,
        level: level === "warn" ? "warning" : level,
        data,
      });
    },
  });
}

export function getSentry(): typeof Sentry | null {
  return initialized ? Sentry : null;
}
