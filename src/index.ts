// Backend exports
export {
  corsDiagnoser,
  getErrorHistory,
  clearErrorHistory,
  type CorsMiddlewareOptions,
  type CorsError,
} from "./backend/expressMiddleware.js";

export {
  analyzeHeaders,
  compareConfiguration,
  testOrigin,
  type Diagnosis,
  type CorsConfiguration,
  type ConfigurationDiff,
  type TestResult,
} from "./backend/analyzer.js";

// Frontend exports
export {
  listenCorsErrors,
  stopListening,
  getCorsErrors,
  type BrowserListenerOptions,
  type CorsErrorInfo,
} from "./frontend/browserListener.js";

// Core exports (advanced usage)
export {
  detectPattern,
  COMMON_PATTERNS,
  type ErrorPattern,
} from "./core/patternMatcher.js";

export { checkSecurity, type SecurityIssue } from "./core/securityAdvisor.js";
