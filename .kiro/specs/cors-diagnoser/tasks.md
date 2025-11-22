# Implementation Plan - cors-diagnoser

- [x] 1. Initialize project structure and configuration

  - Create package.json with correct metadata (name: "cors-diagnoser", type: "module", main, types, keywords)
  - Create tsconfig.json with strict mode enabled, ES2022 target, outDir: "dist"
  - Create directory structure: src/backend, src/frontend, src/core
  - Create src/index.ts as main entry point
  - Add build script in package.json: "build": "tsc"
  - _Requirements: 5.1, 5.2, 5.5, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 2. Implement core utilities module

  - [x] 2.1 Create src/core/utils.ts with helper functions

    - Implement normalizeOrigin() to standardize URL format (remove trailing slash, lowercase)
    - Implement parseHeaders() to create case-insensitive header map
    - Implement isPreflightRequest() to detect OPTIONS requests with CORS headers
    - Implement formatLog() with ANSI color codes for terminal output
    - Implement colorize() for syntax highlighting in console
    - _Requirements: 6.5, 13.3_

- [x] 3. Implement pattern matcher for common CORS errors

  - [x] 3.1 Create src/core/patternMatcher.ts with pattern detection

    - Define ErrorPattern interface with id, name, detector function, explanation, solution, codeExample
    - Implement COMMON_PATTERNS array with at least 10 patterns:
      - wildcard-credentials-conflict: Access-Control-Allow-Origin "\*" with credentials
      - multiple-origins-misconfiguration: Multiple origins needed but single string configured
      - preflight-only-failure: Preflight fails but simple request would work
      - custom-headers-not-allowed: Custom headers sent but not in Access-Control-Allow-Headers
      - missing-allow-origin: No Access-Control-Allow-Origin header
      - missing-allow-headers: No Access-Control-Allow-Headers on preflight
      - missing-allow-methods: No Access-Control-Allow-Methods on preflight
      - credentials-mismatch: Frontend sends credentials but backend doesn't allow
      - origin-null-blocked: Origin "null" is blocked
      - port-mismatch: Same domain but different port blocked
    - Implement detectPattern() that iterates patterns and returns first match
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4. Implement code generator for examples

  - [x] 4.1 Create src/core/codeGenerator.ts with code generation

    - Define CodeExample interface with language, code, description
    - Implement generateExpressExample() with templates for common CORS configurations
    - Implement generateFetchExample() for frontend fetch/axios configurations
    - Implement formatCodeForConsole() to add ANSI syntax highlighting
    - Create templates for: adding cors middleware, configuring specific origins, enabling credentials, allowing custom headers
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

-

- [x] 5. Implement security advisor

  - [x] 5.1 Create src/core/securityAdvisor.ts with security validation

    - Define SecurityIssue interface with level, title, description, recommendation
    - Implement checkSecurity() that validates CorsConfiguration
    - Add check for wildcard origin in production (warning level)
    - Add check for credentials + wildcard (critical level)
    - Add check for sensitive headers in Access-Control-Expose-Headers (warning level)
    - Add check for unnecessary methods in Access-Control-Allow-Methods (info level)
    - Return issues sorted by severity (critical, warning, info)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 6. Implement analyzer engine

  - [x] 6.1 Create src/backend/analyzer.ts with core analysis logic

    - Define Diagnosis interface with issue, description, recommendation, codeExample, pattern, severity
    - Define CorsConfiguration interface with origin, methods, allowedHeaders, exposedHeaders, credentials, maxAge
    - Define ConfigurationDiff interface with missing, incorrect, extra, summary
    - Define TestResult interface with allowed, reason, headers, preflight
    - Implement analyzeHeaders(req, res) that:
      - Extracts and normalizes origin from request
      - Checks for Access-Control-Allow-Origin in response
      - Validates origin matches configuration
      - Detects credentials + wildcard conflict
      - Identifies missing headers on preflight requests
      - Calls detectPattern() from patternMatcher
      - Calls generateExpressExample() from codeGenerator
      - Calls checkSecurity() from securityAdvisor
      - Returns array of Diagnosis objects
    - Implement compareConfiguration(current, expected) that:
      - Identifies missing properties
      - Identifies incorrect values with current vs expected
      - Identifies extra properties
      - Generates human-readable summary
    - Implement testOrigin(origin, config) that:
      - Simulates request from specified origin
      - Validates against configuration
      - Returns TestResult with allowed status and headers
      - Checks both simple requests and preflight requirements
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 7. Implement Express middleware with history tracking

  - [x] 7.1 Create src/backend/expressMiddleware.ts with middleware logic

    - Define CorsMiddlewareOptions interface with verbose, enableHistory, maxHistorySize, securityChecks
    - Define CorsError interface with timestamp, route, method, origin, diagnoses, count
    - Create in-memory circular buffer for error history (default max 100 entries)
    - Implement corsDiagnoser(options) that returns Express middleware:
      - Intercepts incoming request and captures headers
      - Wraps res.send/res.json to capture response headers before sending
      - Detects if request is OPTIONS (preflight)
      - Calls analyzeHeaders() from analyzer
      - If diagnoses found, formats and logs with "[CORS-DIAGNOSER]" prefix
      - If enableHistory is true, stores error in history with grouping (increment count for duplicates)
      - Uses formatLog() from utils for colored output
      - Never throws exceptions that would break the server
    - Implement getErrorHistory() that returns sorted array of CorsError (newest first)
    - Implement clearErrorHistory() to reset history
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.4, 4.5, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8. Implement browser listener for frontend

  - [x] 8.1 Create src/frontend/browserListener.ts with error capture

    - Define BrowserListenerOptions interface with verbose, autoStart, customHandler
    - Define CorsErrorInfo interface with message, possibleCauses, recommendations, timestamp
    - Create in-memory array to store captured CORS errors
    - Implement listenCorsErrors(options) that:
      - Checks if window exists (SSR safety)
      - Registers window.addEventListener('error') listener
      - Filters errors containing "CORS", "cross-origin", "blocked" keywords
      - Analyzes error message to identify probable cause
      - Maps to known patterns (missing header, preflight fail, credentials issue)
      - Formats output using console.group for better readability
      - Stores error in history array
      - Calls customHandler if provided
    - Implement stopListening() that removes event listener and cleans up
    - Implement getCorsErrors() that returns array of captured errors
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.2, 4.4, 4.5_

- [x] 9. Create main entry point with exports

  - [x] 9.1 Create src/index.ts with all public exports

    - Export corsDiagnoser, getErrorHistory, clearErrorHistory from backend/expressMiddleware
    - Export analyzeHeaders, compareConfiguration, testOrigin from backend/analyzer
    - Export listenCorsErrors, stopListening, getCorsErrors from frontend/browserListener
    - Export detectPattern, COMMON_PATTERNS from core/patternMatcher
    - Export checkSecurity from core/securityAdvisor
    - Export all TypeScript interfaces and types
    - _Requirements: 4.1, 4.2, 4.3, 13.4_

-

- [x] 10. Create comprehensive README documentation

  - [x] 10.1 Create README.md with complete documentation

    - Add title "# cors-diagnoser" and tagline
    - Add description: "Diagnóstico automático e claro para erros CORS no backend e frontend"
    - Add installation section with npm install command
    - Add "Usage - Backend" section with Express example showing corsDiagnoser middleware
    - Add "Usage - Frontend" section with listenCorsErrors example
    - Add "API Reference" section documenting all exported functions and interfaces
    - Add "Common Patterns Detected" section listing the 10+ patterns
    - Add "Configuration Options" section for middleware and listener options
    - Add "Examples" section with real-world scenarios and solutions
    - Add "Roadmap" section mentioning: Fastify support, Next.js API routes, CLI tool, Dashboard SaaS
    - Add "Contributing" and "License" sections
    - _Requirements: 5.3, 5.4_

- [ ] 11. Write unit tests for core modules

  - [x] 11.1 Create tests for utils module

    - Test normalizeOrigin with various URL formats
    - Test parseHeaders with different header cases
    - Test isPreflightRequest with OPTIONS and non-OPTIONS requests
    - Test formatLog output formatting
    - _Requirements: 6.5_

  - [x] 11.2 Create tests for patternMatcher module

    - Test each of the 10+ pattern detectors individually
    - Test detectPattern returns correct pattern for various scenarios
    - Test detectPattern returns null when no pattern matches
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 11.3 Create tests for codeGenerator module

    - Test generateExpressExample produces valid code
    - Test generateFetchExample produces valid code
    - Test formatCodeForConsole adds ANSI codes
    - Test template substitution with various contexts
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 11.4 Create tests for securityAdvisor module

    - Test wildcard origin detection in production
    - Test credentials + wildcard critical alert
    - Test sensitive headers warning
    - Test unnecessary methods info
    - Test severity sorting
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 12. Write unit tests for backend modules

  - [x] 12.1 Create tests for analyzer module

    - Test analyzeHeaders with missing Access-Control-Allow-Origin
    - Test analyzeHeaders with credentials conflict
    - Test analyzeHeaders with custom headers not allowed
    - Test compareConfiguration diff generation
    - Test testOrigin with allowed and blocked origins
    - Mock req/res objects from Express
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 12.2 Create tests for expressMiddleware module

    - Test middleware intercepts requests correctly
    - Test OPTIONS request detection
    - Test error history storage and grouping
    - Test circular buffer behavior at max size
    - Test getErrorHistory returns sorted results
    - Test clearErrorHistory resets state
    - Use supertest for Express integration testing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 13. Write unit tests for frontend module

  - [x] 13.1 Create tests for browserListener module

    - Test error listener registration
    - Test CORS error filtering (matches "CORS", "cross-origin", "blocked")
    - Test non-CORS errors are ignored
    - Test error history storage
    - Test stopListening cleanup
    - Test getCorsErrors returns captured errors
    - Mock window.addEventListener
    - Use JSDOM for browser environment simulation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 14. Create integration tests

  - [x] 14.1 Create end-to-end backend test

    - Set up real Express server with cors-diagnoser middleware
    - Make HTTP requests from different origins
    - Validate logs are generated correctly
    - Validate error history is populated
    - Test with and without CORS headers configured
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 14.2 Create end-to-end frontend test

    - Set up JSDOM or Playwright environment
    - Simulate CORS errors from failed fetch requests
    - Validate console messages are formatted correctly
    - Validate error history is captured
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 15. Build and validate package

  - [x] 15.1 Build package and verify output

    - Run npm run build to compile TypeScript
    - Verify dist/ directory contains .js and .d.ts files
    - Verify all modules are properly exported
    - Test importing package in a sample project
    - Validate package.json exports are correct
    - _Requirements: 5.1, 5.2, 5.5_
