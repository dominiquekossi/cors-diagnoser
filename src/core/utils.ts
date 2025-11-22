import type { Request } from "express";

/**
 * Normalizes an origin URL to a standard format
 * - Converts to lowercase
 * - Removes trailing slash
 * - Handles null and undefined cases
 */
export function normalizeOrigin(origin: string | undefined | null): string {
  if (!origin) {
    return "";
  }

  let normalized = origin.trim().toLowerCase();

  // Remove trailing slash
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Parses headers into a case-insensitive Map
 * This allows for consistent header lookups regardless of casing
 */
export function parseHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): Map<string, string> {
  const headerMap = new Map<string, string>();

  if (!headers) {
    return headerMap;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      const normalizedKey = key.toLowerCase();
      const stringValue = Array.isArray(value) ? value[0] : value;
      if (stringValue) {
        headerMap.set(normalizedKey, stringValue);
      }
    }
  }

  return headerMap;
}

/**
 * Detects if a request is a CORS preflight request
 * Preflight requests are OPTIONS requests with specific CORS headers
 */
export function isPreflightRequest(req: Request): boolean {
  if (req.method !== "OPTIONS") {
    return false;
  }

  const headers = parseHeaders(req.headers as Record<string, string>);

  // A preflight request must have either:
  // - Access-Control-Request-Method header, or
  // - Access-Control-Request-Headers header
  const hasRequestMethod = headers.has("access-control-request-method");
  const hasRequestHeaders = headers.has("access-control-request-headers");

  return hasRequestMethod || hasRequestHeaders;
}

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

/**
 * Applies ANSI color codes to text for terminal output
 */
export function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/**
 * Formats a log message with color coding based on level
 * Includes timestamp and structured data formatting
 */
export function formatLog(
  level: "info" | "warn" | "error",
  message: string,
  data?: any
): void {
  const timestamp = new Date().toISOString();
  const prefix = "[CORS-DIAGNOSER]";

  let coloredLevel: string;
  let coloredPrefix: string;

  switch (level) {
    case "error":
      coloredLevel = colorize("ERROR", "red");
      coloredPrefix = colorize(prefix, "red");
      break;
    case "warn":
      coloredLevel = colorize("WARN", "yellow");
      coloredPrefix = colorize(prefix, "yellow");
      break;
    case "info":
    default:
      coloredLevel = colorize("INFO", "cyan");
      coloredPrefix = colorize(prefix, "cyan");
      break;
  }

  const timestampFormatted = colorize(timestamp, "gray");
  const formattedMessage = `${timestampFormatted} ${coloredPrefix} ${coloredLevel} ${message}`;

  console.log(formattedMessage);

  if (data !== undefined) {
    console.log(colorize("Data:", "dim"));
    console.log(data);
  }
}
