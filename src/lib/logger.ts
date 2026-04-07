type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const THRESHOLD: number = import.meta.env.DEV ? LEVELS.debug : LEVELS.info;

let persistentContext: LogContext = {};

// Sentry hooks — set by src/lib/sentry.ts after initialization
let _captureException: ((error: unknown, extra?: LogContext) => void) | null = null;
let _addBreadcrumb: ((level: LogLevel, message: string, data?: LogContext) => void) | null = null;

export function setLogContext(ctx: LogContext): void {
  persistentContext = { ...persistentContext, ...ctx };
}

export function resetLogContext(): void {
  persistentContext = {};
}

export function registerSentryHooks(hooks: {
  captureException: (error: unknown, extra?: LogContext) => void;
  addBreadcrumb: (level: LogLevel, message: string, data?: LogContext) => void;
}): void {
  _captureException = hooks.captureException;
  _addBreadcrumb = hooks.addBreadcrumb;
}

function formatArgs(level: LogLevel, message: string, context?: LogContext): unknown[] {
  const merged = { ...persistentContext, ...context };
  const prefix = `[${level.toUpperCase()}] [${new Date().toISOString()}]`;
  return Object.keys(merged).length > 0
    ? [prefix, message, merged]
    : [prefix, message];
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (THRESHOLD > LEVELS.debug) return;
    console.debug(...formatArgs("debug", message, context));
  },

  info(message: string, context?: LogContext): void {
    if (THRESHOLD > LEVELS.info) return;
    console.info(...formatArgs("info", message, context));
    _addBreadcrumb?.("info", message, { ...persistentContext, ...context });
  },

  warn(message: string, context?: LogContext): void {
    if (THRESHOLD > LEVELS.warn) return;
    console.warn(...formatArgs("warn", message, context));
    _addBreadcrumb?.("warn", message, { ...persistentContext, ...context });
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (THRESHOLD > LEVELS.error) return;
    const args = formatArgs("error", message, context);
    if (error) args.push(error);
    console.error(...args);

    if (_captureException) {
      const exception = error instanceof Error ? error : new Error(message);
      _captureException(exception, { ...persistentContext, ...context });
    }
  },
};
