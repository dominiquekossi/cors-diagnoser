/**
 * Browser-side CORS error listener
 * Captures and analyzes CORS errors in the browser console
 */

/// <reference lib="dom" />

/**
 * Configuration options for the browser listener
 */
export interface BrowserListenerOptions {
  verbose?: boolean;
  autoStart?: boolean;
  customHandler?: (error: CorsErrorInfo) => void;
}

/**
 * Information about a captured CORS error
 */
export interface CorsErrorInfo {
  message: string;
  possibleCauses: string[];
  recommendations: string[];
  timestamp: Date;
}

// In-memory storage for captured CORS errors
let corsErrorHistory: CorsErrorInfo[] = [];

// Reference to the error listener for cleanup
let errorListener: ((event: ErrorEvent) => void) | null = null;

// Track if listener is currently active
let isListening = false;

/**
 * Analyzes an error message to identify probable CORS-related causes
 */
function analyzeCorsError(errorMessage: string): {
  possibleCauses: string[];
  recommendations: string[];
} {
  const message = errorMessage.toLowerCase();
  const possibleCauses: string[] = [];
  const recommendations: string[] = [];

  // Pattern: Missing Access-Control-Allow-Origin
  if (
    message.includes("access-control-allow-origin") ||
    message.includes("no 'access-control-allow-origin'")
  ) {
    possibleCauses.push(
      "Server is not sending the Access-Control-Allow-Origin header"
    );
    possibleCauses.push(
      "Server is sending the header but with a different origin than expected"
    );
    recommendations.push(
      "Ask backend team to add CORS middleware (e.g., 'cors' package in Express)"
    );
    recommendations.push(
      "Verify the server is configured to allow your origin: " +
        (typeof window !== "undefined" ? window.location.origin : "your-origin")
    );
  }

  // Pattern: Preflight failure
  if (
    message.includes("preflight") ||
    message.includes("options") ||
    message.includes("access-control-request")
  ) {
    possibleCauses.push(
      "Preflight OPTIONS request is failing or not handled by server"
    );
    possibleCauses.push(
      "Server is not responding with required preflight headers"
    );
    recommendations.push(
      "Ensure server handles OPTIONS requests for the endpoint"
    );
    recommendations.push(
      "Check that Access-Control-Allow-Methods and Access-Control-Allow-Headers are set"
    );
  }

  // Pattern: Credentials issue
  if (
    message.includes("credential") ||
    message.includes("cookie") ||
    message.includes("withcredentials")
  ) {
    possibleCauses.push(
      "Server is not allowing credentials (cookies, authorization headers)"
    );
    possibleCauses.push(
      "Server is using wildcard origin (*) with credentials, which is forbidden"
    );
    recommendations.push(
      "Set Access-Control-Allow-Credentials: true on the server"
    );
    recommendations.push(
      "Ensure server uses specific origin, not wildcard (*), when allowing credentials"
    );
    recommendations.push(
      "Use credentials: 'include' in fetch or withCredentials: true in axios"
    );
  }

  // Pattern: Custom headers
  if (
    message.includes("header") &&
    (message.includes("not allowed") || message.includes("forbidden"))
  ) {
    possibleCauses.push(
      "Custom headers are being sent but not allowed by server"
    );
    recommendations.push(
      "Ask backend to add your custom headers to Access-Control-Allow-Headers"
    );
    recommendations.push(
      "Common headers to allow: Content-Type, Authorization, X-Requested-With"
    );
  }

  // Pattern: Method not allowed
  if (message.includes("method") && message.includes("not allowed")) {
    possibleCauses.push("HTTP method is not allowed by server CORS policy");
    recommendations.push(
      "Ask backend to add the HTTP method to Access-Control-Allow-Methods"
    );
  }

  // Pattern: Blocked by policy
  if (message.includes("blocked") && message.includes("policy")) {
    possibleCauses.push("Request is blocked by CORS policy");
    possibleCauses.push("Origin might not be in the server's allowed list");
    recommendations.push("Verify your origin is allowed by the server");
    recommendations.push(
      "Check browser console for specific CORS error details"
    );
  }

  // Generic fallback
  if (possibleCauses.length === 0) {
    possibleCauses.push("CORS policy is blocking the request");
    possibleCauses.push("Server CORS configuration might be incorrect");
    recommendations.push(
      "Check the browser console for detailed CORS error message"
    );
    recommendations.push(
      "Verify server has CORS enabled and configured correctly"
    );
    recommendations.push(
      "Use browser DevTools Network tab to inspect request/response headers"
    );
  }

  return { possibleCauses, recommendations };
}

/**
 * Checks if an error is CORS-related based on its message
 */
function isCorsError(errorMessage: string): boolean {
  const message = errorMessage.toLowerCase();
  return (
    message.includes("cors") ||
    message.includes("cross-origin") ||
    message.includes("blocked")
  );
}

/**
 * Formats and displays CORS error information in the console
 */
function displayCorsError(errorInfo: CorsErrorInfo, verbose: boolean): void {
  console.group(
    "%c[CORS-DIAGNOSER] CORS Error Detected",
    "color: #ff6b6b; font-weight: bold; font-size: 14px;"
  );

  console.log(
    "%cError Message:",
    "color: #ff6b6b; font-weight: bold;",
    errorInfo.message
  );

  console.log(
    "%cTimestamp:",
    "color: #4ecdc4; font-weight: bold;",
    errorInfo.timestamp.toISOString()
  );

  if (errorInfo.possibleCauses.length > 0) {
    console.group("%cPossible Causes:", "color: #ffe66d; font-weight: bold;");
    errorInfo.possibleCauses.forEach((cause, index) => {
      console.log(`${index + 1}. ${cause}`);
    });
    console.groupEnd();
  }

  if (errorInfo.recommendations.length > 0) {
    console.group("%cRecommendations:", "color: #95e1d3; font-weight: bold;");
    errorInfo.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    console.groupEnd();
  }

  if (verbose) {
    console.log(
      "%cTip:",
      "color: #a8dadc; font-style: italic;",
      "Use browser DevTools Network tab to see full request/response headers"
    );
  }

  console.groupEnd();
}

/**
 * Starts listening for CORS errors in the browser
 * @param options Configuration options for the listener
 */
export function listenCorsErrors(options: BrowserListenerOptions = {}): void {
  // SSR safety check
  if (typeof window === "undefined") {
    console.warn(
      "[CORS-DIAGNOSER] Browser listener cannot run in non-browser environment (SSR)"
    );
    return;
  }

  // Prevent multiple listeners
  if (isListening) {
    console.warn(
      "[CORS-DIAGNOSER] Listener is already active. Call stopListening() first."
    );
    return;
  }

  const { verbose = false, customHandler } = options;

  // Create the error listener
  errorListener = (event: ErrorEvent) => {
    const errorMessage = event.message || event.error?.message || "";

    // Filter for CORS-related errors
    if (!isCorsError(errorMessage)) {
      return;
    }

    // Analyze the error
    const { possibleCauses, recommendations } = analyzeCorsError(errorMessage);

    // Create error info object
    const errorInfo: CorsErrorInfo = {
      message: errorMessage,
      possibleCauses,
      recommendations,
      timestamp: new Date(),
    };

    // Store in history
    corsErrorHistory.push(errorInfo);

    // Display in console
    displayCorsError(errorInfo, verbose);

    // Call custom handler if provided
    if (customHandler) {
      try {
        customHandler(errorInfo);
      } catch (error) {
        console.error("[CORS-DIAGNOSER] Error in custom handler:", error);
      }
    }
  };

  // Register the listener
  window.addEventListener("error", errorListener);
  isListening = true;

  if (verbose) {
    console.log(
      "%c[CORS-DIAGNOSER] Browser listener started",
      "color: #95e1d3; font-weight: bold;"
    );
  }
}

/**
 * Stops listening for CORS errors and cleans up
 */
export function stopListening(): void {
  // SSR safety check
  if (typeof window === "undefined") {
    return;
  }

  if (errorListener) {
    window.removeEventListener("error", errorListener);
    errorListener = null;
    isListening = false;

    console.log(
      "%c[CORS-DIAGNOSER] Browser listener stopped",
      "color: #95e1d3; font-weight: bold;"
    );
  }
}

/**
 * Returns the array of captured CORS errors
 * @returns Array of CorsErrorInfo objects
 */
export function getCorsErrors(): CorsErrorInfo[] {
  return [...corsErrorHistory];
}

/**
 * Clears the CORS error history
 */
export function clearCorsErrors(): void {
  corsErrorHistory = [];
}
