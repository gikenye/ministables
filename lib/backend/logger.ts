type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = (process.env.LOG_LEVEL || "").toLowerCase();
const defaultLevel: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";
const minLevel: LogLevel = (["debug", "info", "warn", "error"] as const).includes(
  envLevel as LogLevel
)
  ? (envLevel as LogLevel)
  : defaultLevel;

function shouldLog(level: LogLevel) {
  return levelOrder[level] >= levelOrder[minLevel];
}

function safeStringify(value: unknown) {
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") {
        return val.toString();
      }
      if (typeof val === "object" && val !== null) {
        const obj = val as object;
        if (seen.has(obj)) {
          return "[Circular]";
        }
        seen.add(obj);
      }
      return val;
    });
  } catch (_error) {
    return JSON.stringify({ error: "Failed to serialize log payload" });
  }
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  if (process.env.NODE_ENV === "production") {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      meta,
    };
    const serialized = safeStringify(payload);
    if (level === "debug") {
      console.info(serialized);
    } else {
      console[level](serialized);
    }
    return;
  }

  if (meta && Object.keys(meta).length > 0) {
    console[level](message, meta);
  } else {
    console[level](message);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    log("error", message, meta),
};
