import type { Request, Response, NextFunction } from "express";
import { analyzeHeaders, type Diagnosis } from "./analyzer.js";
import { formatLog } from "../core/utils.js";

/**
 * Options for configuring the CORS diagnoser middleware
 */
export interface CorsMiddlewareOptions {
  /** Enable verbose logging for all requests (default: false) */
  verbose?: boolean;
  /** Enable error history tracking (default: true) */
  enableHistory?: boolean;
  /** Maximum number of errors to store in history (default: 100) */
  maxHistorySize?: number;
  /** Enable security checks (default: true) */
  securityChecks?: boolean;
}

/**
 * Represents a CORS error captured by the middleware
 */
export interface CorsError {
  /** When the error occurred */
  timestamp: Date;
  /** The route that was accessed */
  route: string;
  /** HTTP method used */
  method: string;
  /** Origin that made the request */
  origin: string;
  /** List of diagnoses for this error */
  diagnoses: Diagnosis[];
  /** Number of times this exact error has occurred */
  count: number;
}

/**
 * In-memory circular buffer for error history
 * Stores errors with automatic deduplication and counting
 */
class ErrorHistory {
  private errors: CorsError[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Adds an error to the history
   * If an identical error exists, increments its count instead
   */
  add(error: Omit<CorsError, "count">): void {
    // Check if this error already exists (same route, method, origin, and issues)
    const existingError = this.errors.find(
      (e) =>
        e.route === error.route &&
        e.method === error.method &&
        e.origin === error.origin &&
        this.diagnosesMatch(e.diagnoses, error.diagnoses)
    );

    if (existingError) {
      // Increment count and update timestamp
      existingError.count++;
      existingError.timestamp = error.timestamp;
    } else {
      // Add new error
      const newError: CorsError = {
        ...error,
        count: 1,
      };

      this.errors.unshift(newError);

      // Maintain circular buffer size
      if (this.errors.length > this.maxSize) {
        this.errors.pop();
      }
    }
  }

  /**
   * Checks if two diagnosis arrays are equivalent
   */
  private diagnosesMatch(a: Diagnosis[], b: Diagnosis[]): boolean {
    if (a.length !== b.length) return false;

    // Sort by issue name for consistent comparison
    const sortedA = [...a].sort((x, y) => x.issue.localeCompare(y.issue));
    const sortedB = [...b].sort((x, y) => x.issue.localeCompare(y.issue));

    return sortedA.every((diagA, idx) => {
      const diagB = sortedB[idx];
      return (
        diagA.issue === diagB.issue &&
        diagA.description === diagB.description &&
        diagA.recommendation === diagB.recommendation
      );
    });
  }

  /**
   * Returns all errors sorted by timestamp (newest first)
   */
  getAll(): CorsError[] {
    return [...this.errors].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Clears all errors from history
   */
  clear(): void {
    this.errors = [];
  }
}

// Global error history instance
let errorHistory: ErrorHistory | null = null;

/**
 * Express middleware that diagnoses CORS issues automatically
 * Intercepts requests and responses to detect and log CORS problems
 */
export function corsDiagnoser(options: CorsMiddlewareOptions = {}) {
  const {
    verbose = false,
    enableHistory = true,
    maxHistorySize = 100,
    securityChecks = true,
  } = options;

  // Initialize error history if enabled
  if (enableHistory && !errorHistory) {
    errorHistory = new ErrorHistory(maxHistorySize);
  }

  return function corsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      // Capture request information
      const route = req.path || req.url;
      const method = req.method;
      const origin = (req.headers.origin as string) || "";

      // Store original send and json methods
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);

      // Flag to ensure we only analyze once
      let analyzed = false;

      /**
       * Performs CORS analysis on the request/response pair
       */
      const performAnalysis = (): void => {
        if (analyzed) return;
        analyzed = true;

        try {
          // Analyze headers for CORS issues
          const diagnoses = analyzeHeaders(req, res);

          // Filter out security checks if disabled
          const filteredDiagnoses = securityChecks
            ? diagnoses
            : diagnoses.filter((d) => d.severity !== "info");

          // Log if issues found or verbose mode is enabled
          if (filteredDiagnoses.length > 0) {
            formatLog(
              "error",
              `CORS issues detected on ${method} ${route} from origin: ${origin}`
            );

            // Log each diagnosis
            filteredDiagnoses.forEach((diagnosis, index) => {
              console.log(`\n${index + 1}. ${diagnosis.issue}`);
              console.log(`   Severity: ${diagnosis.severity || "warning"}`);
              console.log(`   ${diagnosis.description}`);
              console.log(`   Recommendation: ${diagnosis.recommendation}`);

              if (diagnosis.codeExample) {
                console.log(`\n   Code Example:`);
                console.log(
                  diagnosis.codeExample
                    .split("\n")
                    .map((line) => `   ${line}`)
                    .join("\n")
                );
              }

              if (diagnosis.pattern) {
                console.log(`   Pattern: ${diagnosis.pattern}`);
              }
            });

            console.log("\n");

            // Store in history if enabled
            if (enableHistory && errorHistory) {
              errorHistory.add({
                timestamp: new Date(),
                route,
                method,
                origin,
                diagnoses: filteredDiagnoses,
              });
            }
          } else if (verbose) {
            formatLog(
              "info",
              `No CORS issues detected on ${method} ${route} from origin: ${origin}`
            );
          }
        } catch (analysisError) {
          // Never throw - log error but don't break the server
          console.error(
            "[CORS-DIAGNOSER] Error during analysis:",
            analysisError
          );
        }
      };

      // Wrap res.send to capture response before sending
      res.send = function (body?: any): Response {
        performAnalysis();
        return originalSend(body);
      };

      // Wrap res.json to capture response before sending
      res.json = function (body?: any): Response {
        performAnalysis();
        return originalJson(body);
      };

      // Also hook into finish event as a fallback
      res.on("finish", () => {
        performAnalysis();
      });

      // Continue to next middleware
      next();
    } catch (error) {
      // Never throw exceptions that would break the server
      console.error("[CORS-DIAGNOSER] Middleware error:", error);
      next();
    }
  };
}

/**
 * Returns the error history sorted by timestamp (newest first)
 * Returns empty array if history is not enabled
 */
export function getErrorHistory(): CorsError[] {
  if (!errorHistory) {
    return [];
  }
  return errorHistory.getAll();
}

/**
 * Clears all errors from the history
 */
export function clearErrorHistory(): void {
  if (errorHistory) {
    errorHistory.clear();
  }
}
