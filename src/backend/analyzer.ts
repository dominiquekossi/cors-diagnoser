import type { Request, Response } from "express";
import {
  normalizeOrigin,
  parseHeaders,
  isPreflightRequest,
} from "../core/utils.js";
import { detectPattern } from "../core/patternMatcher.js";
import { generateExpressExample } from "../core/codeGenerator.js";
import {
  checkSecurity,
  type CorsConfiguration as SecurityCorsConfig,
} from "../core/securityAdvisor.js";

/**
 * Represents a diagnosis of a CORS issue
 */
export interface Diagnosis {
  issue: string;
  description: string;
  recommendation: string;
  codeExample?: string;
  pattern?: string;
  severity?: "info" | "warning" | "critical";
}

/**
 * CORS configuration interface
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
 * Represents the difference between two CORS configurations
 */
export interface ConfigurationDiff {
  missing: string[];
  incorrect: Array<{
    property: string;
    current: any;
    expected: any;
  }>;
  extra: string[];
  summary: string;
}

/**
 * Result of testing an origin against a CORS configuration
 */
export interface TestResult {
  allowed: boolean;
  reason?: string;
  headers: Record<string, string>;
  preflight: {
    required: boolean;
    allowed: boolean;
  };
}

/**
 * Analyzes HTTP headers from a request/response pair to detect CORS issues
 * Returns an array of Diagnosis objects describing any problems found
 */
export function analyzeHeaders(req: Request, res: Response): Diagnosis[] {
  const diagnoses: Diagnosis[] = [];

  // Parse headers for easier access
  const reqHeaders = parseHeaders(req.headers as Record<string, string>);
  const resHeaders = parseHeaders(res.getHeaders() as Record<string, string>);

  // Extract and normalize origin from request
  const requestOrigin = reqHeaders.get("origin");
  const normalizedOrigin = normalizeOrigin(requestOrigin);

  // Check if this is a preflight request
  const isPreflight = isPreflightRequest(req);

  // Check 1: Missing Access-Control-Allow-Origin
  const allowOrigin = resHeaders.get("access-control-allow-origin");
  if (requestOrigin && !allowOrigin) {
    diagnoses.push({
      issue: "Missing Access-Control-Allow-Origin",
      description: `The request includes an Origin header (${requestOrigin}), but the server response is missing the Access-Control-Allow-Origin header. This is the most common CORS error and will cause the browser to block the response.`,
      recommendation:
        "Add the Access-Control-Allow-Origin header to your response. Use a CORS middleware like 'cors' for Express, or set the header manually in your route handlers.",
      codeExample: generateExpressExample("missing allow origin", {
        origin: requestOrigin || undefined,
      }).code,
      severity: "critical",
    });
  }

  // Check 2: Origin validation - does the response origin match the request?
  if (requestOrigin && allowOrigin && allowOrigin !== "*") {
    const normalizedAllowOrigin = normalizeOrigin(allowOrigin);
    if (normalizedOrigin !== normalizedAllowOrigin) {
      diagnoses.push({
        issue: "Origin Mismatch",
        description: `The request origin (${requestOrigin}) does not match the Access-Control-Allow-Origin header (${allowOrigin}). The browser will block this response.`,
        recommendation:
          "Ensure your CORS configuration includes the requesting origin, or use a dynamic origin validator to check against a whitelist of allowed origins.",
        codeExample: generateExpressExample("origin mismatch", {
          origin: requestOrigin || undefined,
        }).code,
        severity: "critical",
      });
    }
  }

  // Check 3: Credentials + wildcard conflict
  const allowCredentials = resHeaders.get("access-control-allow-credentials");
  if (allowOrigin === "*" && allowCredentials === "true") {
    diagnoses.push({
      issue: "Wildcard Origin with Credentials",
      description:
        "Access-Control-Allow-Origin is set to '*' (wildcard) while Access-Control-Allow-Credentials is 'true'. This combination is forbidden by the CORS specification and will cause all requests to fail.",
      recommendation:
        "Replace the wildcard '*' with the specific origin from the request. When using credentials, you must specify an exact origin.",
      codeExample: generateExpressExample("wildcard credentials conflict", {
        origin: requestOrigin || undefined,
        credentials: true,
      }).code,
      pattern: "wildcard-credentials-conflict",
      severity: "critical",
    });
  }

  // Check 4: Preflight-specific checks
  if (isPreflight) {
    // Check for Access-Control-Allow-Methods
    const allowMethods = resHeaders.get("access-control-allow-methods");
    if (!allowMethods) {
      diagnoses.push({
        issue: "Missing Access-Control-Allow-Methods on Preflight",
        description:
          "This is a preflight OPTIONS request, but the response is missing the Access-Control-Allow-Methods header. The browser needs to know which HTTP methods are allowed.",
        recommendation:
          "Add the Access-Control-Allow-Methods header to your preflight response, listing all HTTP methods your API supports (e.g., 'GET, POST, PUT, DELETE').",
        codeExample: generateExpressExample("preflight missing methods", {
          origin: requestOrigin || undefined,
          methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        }).code,
        severity: "critical",
      });
    }

    // Check for Access-Control-Allow-Headers when custom headers are requested
    const requestHeaders = reqHeaders.get("access-control-request-headers");
    const allowHeaders = resHeaders.get("access-control-allow-headers");

    if (requestHeaders && !allowHeaders) {
      diagnoses.push({
        issue: "Missing Access-Control-Allow-Headers on Preflight",
        description: `The browser is requesting permission to send custom headers (${requestHeaders}), but the server is not responding with Access-Control-Allow-Headers to grant permission.`,
        recommendation:
          "Add the Access-Control-Allow-Headers header to your preflight response, listing all custom headers your API accepts.",
        codeExample: generateExpressExample("custom headers not allowed", {
          origin: requestOrigin || undefined,
          headers: requestHeaders.split(",").map((h) => h.trim()),
        }).code,
        pattern: "custom-headers-not-allowed",
        severity: "critical",
      });
    }
  }

  // Check 5: Detect common patterns
  const pattern = detectPattern(req, res);
  if (pattern && !diagnoses.find((d) => d.pattern === pattern.id)) {
    diagnoses.push({
      issue: pattern.name,
      description: pattern.explanation,
      recommendation: pattern.solution,
      codeExample: pattern.codeExample,
      pattern: pattern.id,
      severity: "warning",
    });
  }

  // Check 6: Security validation
  // Extract current configuration from response headers
  const allowMethodsHeader = resHeaders.get("access-control-allow-methods");
  const currentConfig: SecurityCorsConfig = {
    origin: allowOrigin || false,
    methods: allowMethodsHeader?.split(",").map((m) => m.trim()),
    allowedHeaders: resHeaders
      .get("access-control-allow-headers")
      ?.split(",")
      .map((h) => h.trim()),
    exposedHeaders: resHeaders
      .get("access-control-expose-headers")
      ?.split(",")
      .map((h) => h.trim()),
    credentials: allowCredentials === "true",
    maxAge: resHeaders.get("access-control-max-age")
      ? parseInt(resHeaders.get("access-control-max-age")!, 10)
      : undefined,
  };

  const securityIssues = checkSecurity(currentConfig);
  for (const issue of securityIssues) {
    diagnoses.push({
      issue: issue.title,
      description: issue.description,
      recommendation: issue.recommendation,
      severity: issue.level,
    });
  }

  return diagnoses;
}

/**
 * Compares two CORS configurations and returns the differences
 * Useful for understanding what needs to be changed to fix CORS issues
 */
export function compareConfiguration(
  current: CorsConfiguration,
  expected: CorsConfiguration
): ConfigurationDiff {
  const missing: string[] = [];
  const incorrect: Array<{ property: string; current: any; expected: any }> =
    [];
  const extra: string[] = [];

  // Helper to normalize values for comparison
  const normalize = (value: any): any => {
    if (Array.isArray(value)) {
      return value.sort();
    }
    return value;
  };

  // Helper to check if values are equal
  const isEqual = (a: any, b: any): boolean => {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((val, idx) => val === sortedB[idx]);
    }
    return a === b;
  };

  // Check all properties in expected configuration
  const expectedKeys = Object.keys(expected) as Array<keyof CorsConfiguration>;
  for (const key of expectedKeys) {
    const expectedValue = expected[key];
    const currentValue = current[key];

    if (currentValue === undefined) {
      // Property is missing in current config
      missing.push(key);
    } else if (!isEqual(normalize(currentValue), normalize(expectedValue))) {
      // Property exists but has incorrect value
      incorrect.push({
        property: key,
        current: currentValue,
        expected: expectedValue,
      });
    }
  }

  // Check for extra properties in current config
  const currentKeys = Object.keys(current) as Array<keyof CorsConfiguration>;
  for (const key of currentKeys) {
    if (expected[key] === undefined) {
      extra.push(key);
    }
  }

  // Generate human-readable summary
  let summary = "";
  if (missing.length === 0 && incorrect.length === 0 && extra.length === 0) {
    summary = "Configurations match perfectly.";
  } else {
    const parts: string[] = [];

    if (missing.length > 0) {
      parts.push(
        `Missing properties: ${missing.join(
          ", "
        )}. These need to be added to your CORS configuration.`
      );
    }

    if (incorrect.length > 0) {
      const incorrectDetails = incorrect
        .map(
          (item) =>
            `${item.property} (current: ${JSON.stringify(
              item.current
            )}, expected: ${JSON.stringify(item.expected)})`
        )
        .join("; ");
      parts.push(
        `Incorrect values: ${incorrectDetails}. These need to be updated.`
      );
    }

    if (extra.length > 0) {
      parts.push(
        `Extra properties: ${extra.join(
          ", "
        )}. These are not needed but won't cause issues.`
      );
    }

    summary = parts.join(" ");
  }

  return {
    missing,
    incorrect,
    extra,
    summary,
  };
}

/**
 * Tests if a specific origin would be allowed by a CORS configuration
 * Simulates both simple requests and preflight requests
 */
export function testOrigin(
  origin: string,
  config: CorsConfiguration
): TestResult {
  const normalizedOrigin = normalizeOrigin(origin);
  const headers: Record<string, string> = {};
  let allowed = false;
  let reason: string | undefined;

  // Check if origin is allowed
  if (config.origin === true || config.origin === "*") {
    allowed = true;
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (typeof config.origin === "string") {
    const normalizedConfigOrigin = normalizeOrigin(config.origin);
    if (normalizedOrigin === normalizedConfigOrigin) {
      allowed = true;
      headers["Access-Control-Allow-Origin"] = config.origin;
    } else {
      allowed = false;
      reason = `Origin '${origin}' does not match configured origin '${config.origin}'`;
    }
  } else if (Array.isArray(config.origin)) {
    const normalizedOrigins = config.origin.map((o) => normalizeOrigin(o));
    if (normalizedOrigins.includes(normalizedOrigin)) {
      allowed = true;
      headers["Access-Control-Allow-Origin"] = origin;
    } else {
      allowed = false;
      reason = `Origin '${origin}' is not in the list of allowed origins: ${config.origin.join(
        ", "
      )}`;
    }
  } else {
    allowed = false;
    reason = "CORS is not configured (origin is false or undefined)";
  }

  // Add credentials header if configured
  if (config.credentials) {
    if (headers["Access-Control-Allow-Origin"] === "*") {
      allowed = false;
      reason =
        "Cannot use wildcard origin (*) with credentials. Must specify exact origin.";
      headers["Access-Control-Allow-Credentials"] = "true";
    } else if (allowed) {
      headers["Access-Control-Allow-Credentials"] = "true";
    }
  }

  // Add methods header if configured
  if (config.methods && config.methods.length > 0) {
    headers["Access-Control-Allow-Methods"] = config.methods.join(", ");
  }

  // Add allowed headers if configured
  if (config.allowedHeaders && config.allowedHeaders.length > 0) {
    headers["Access-Control-Allow-Headers"] = config.allowedHeaders.join(", ");
  }

  // Add exposed headers if configured
  if (config.exposedHeaders && config.exposedHeaders.length > 0) {
    headers["Access-Control-Expose-Headers"] = config.exposedHeaders.join(", ");
  }

  // Add max age if configured
  if (config.maxAge !== undefined) {
    headers["Access-Control-Max-Age"] = config.maxAge.toString();
  }

  // Determine if preflight is required and allowed
  const preflightRequired =
    (config.methods &&
      config.methods.some(
        (m) => !["GET", "HEAD", "POST"].includes(m.toUpperCase())
      )) ||
    (config.allowedHeaders && config.allowedHeaders.length > 0);

  const preflightAllowed =
    allowed &&
    (!preflightRequired ||
      (headers["Access-Control-Allow-Methods"] !== undefined &&
        headers["Access-Control-Allow-Headers"] !== undefined));

  return {
    allowed,
    reason,
    headers,
    preflight: {
      required: preflightRequired || false,
      allowed: preflightAllowed,
    },
  };
}
