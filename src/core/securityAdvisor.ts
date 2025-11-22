/**
 * Security advisor for CORS configurations
 * Validates CORS settings and identifies potential security issues
 */

/**
 * Represents a security issue with CORS configuration
 */
export interface SecurityIssue {
  level: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendation: string;
}

/**
 * CORS configuration interface for security validation
 */
export interface CorsConfiguration {
  origin: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * List of sensitive headers that should not be exposed
 */
const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "x-xsrf-token",
  "x-api-key",
  "x-auth-token",
  "x-access-token",
  "x-refresh-token",
];

/**
 * HTTP methods that should be carefully considered
 */
const POTENTIALLY_DANGEROUS_METHODS = ["DELETE", "PUT", "PATCH", "TRACE"];

/**
 * Checks CORS configuration for security issues
 * Returns an array of security issues sorted by severity (critical, warning, info)
 */
export function checkSecurity(
  config: CorsConfiguration,
  environment: "development" | "production" = "production"
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  // Check 1: Wildcard origin in production (warning level)
  if (environment === "production") {
    const isWildcard =
      config.origin === "*" ||
      config.origin === true ||
      (Array.isArray(config.origin) && config.origin.includes("*"));

    if (isWildcard) {
      issues.push({
        level: "warning",
        title: "Wildcard Origin in Production",
        description:
          "Access-Control-Allow-Origin is set to '*' (wildcard) in production environment. This allows any website to make requests to your API, which may expose sensitive data or functionality.",
        recommendation:
          "Specify exact allowed origins instead of using wildcard. Use an array of trusted domains or implement dynamic origin validation based on a whitelist.",
      });
    }
  }

  // Check 2: Credentials + wildcard (critical level)
  const isWildcard =
    config.origin === "*" ||
    config.origin === true ||
    (Array.isArray(config.origin) && config.origin.includes("*"));

  if (config.credentials === true && isWildcard) {
    issues.push({
      level: "critical",
      title: "Credentials with Wildcard Origin",
      description:
        "Access-Control-Allow-Credentials is set to 'true' while Access-Control-Allow-Origin is '*' (wildcard). This combination is forbidden by the CORS specification and will cause all requests to fail. Additionally, this represents a severe security vulnerability if it were allowed.",
      recommendation:
        "Replace the wildcard origin with specific allowed origins. When using credentials, you must specify exact origins (e.g., 'https://example.com'). Never use wildcard with credentials.",
    });
  }

  // Check 3: Sensitive headers in Access-Control-Expose-Headers (warning level)
  if (config.exposedHeaders && config.exposedHeaders.length > 0) {
    const exposedSensitiveHeaders = config.exposedHeaders.filter((header) =>
      SENSITIVE_HEADERS.includes(header.toLowerCase())
    );

    if (exposedSensitiveHeaders.length > 0) {
      issues.push({
        level: "warning",
        title: "Sensitive Headers Exposed",
        description: `The following sensitive headers are exposed via Access-Control-Expose-Headers: ${exposedSensitiveHeaders.join(
          ", "
        )}. This allows client-side JavaScript to read these headers, which may contain sensitive information like authentication tokens or session data.`,
        recommendation:
          "Review the list of exposed headers and remove any that contain sensitive information. Only expose headers that are safe for client-side JavaScript to access. Consider using secure, httpOnly cookies for sensitive data instead.",
      });
    }
  }

  // Check 4: Unnecessary methods in Access-Control-Allow-Methods (info level)
  if (config.methods && config.methods.length > 0) {
    const unnecessaryMethods = config.methods.filter((method) =>
      POTENTIALLY_DANGEROUS_METHODS.includes(method.toUpperCase())
    );

    if (unnecessaryMethods.length > 0) {
      issues.push({
        level: "info",
        title: "Potentially Unnecessary HTTP Methods Allowed",
        description: `The following HTTP methods are allowed: ${unnecessaryMethods.join(
          ", "
        )}. While not necessarily a security issue, allowing methods like DELETE, PUT, or PATCH increases the attack surface of your API.`,
        recommendation:
          "Follow the principle of least privilege: only allow HTTP methods that your API actually needs. If your API is read-only, consider allowing only GET and HEAD. Review each allowed method and ensure it's necessary for your use case.",
      });
    }
  }

  // Sort issues by severity: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.level] - severityOrder[b.level]);

  return issues;
}
