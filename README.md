# cors-diagnoser

> Automatic and clear diagnostics for CORS errors in backend and frontend

[![npm version](https://img.shields.io/npm/v/cors-diagnoser.svg)](https://www.npmjs.com/package/cors-diagnoser)
[![npm downloads](https://img.shields.io/npm/dm/cors-diagnoser.svg)](https://www.npmjs.com/package/cors-diagnoser)
[![CI](https://github.com/dominiquekossi/cors-diagnoser/actions/workflows/ci.yml/badge.svg)](https://github.com/dominiquekossi/cors-diagnoser/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/dominiquekossi/cors-diagnoser/branch/main/graph/badge.svg)](https://codecov.io/gh/dominiquekossi/cors-diagnoser)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

**cors-diagnoser** is an NPM package that helps developers automatically diagnose CORS (Cross-Origin Resource Sharing) issues in both backend and frontend. The package intercepts errors, analyzes HTTP headers, validates preflight configurations, and generates explanatory logs with solution recommendations, making CORS debugging more accessible and efficient.

## ✨ Features

- 🔍 **Automatic Detection**: Intercepts and analyzes CORS errors in real-time
- 💡 **Clear Messages**: Detailed explanations about what's wrong and how to fix it
- 📝 **Code Examples**: Ready-to-use code snippets
- 🎯 **Pattern Matching**: Detects 10+ common CORS error patterns
- 🔒 **Security Advisor**: Security suggestions for your CORS configuration
- 📊 **Error History**: Track recurring issues during development
- 🎨 **Colored Output**: Formatted and easy-to-read terminal logs
- 🌐 **Backend + Frontend**: Full support for Express and browsers

## 📦 Installation

```bash
npm install cors-diagnoser
```

## 🚀 Usage - Backend

### Express Middleware

Add the middleware to your Express server to start diagnosing CORS issues automatically:

```typescript
import express from "express";
import { corsDiagnoser } from "cors-diagnoser";

const app = express();

// Add CORS diagnoser before your routes
app.use(
  corsDiagnoser({
    verbose: true,
    enableHistory: true,
  })
);

app.get("/api/users", (req, res) => {
  res.json({ users: [] });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### Analyzing Headers Manually

```typescript
import { analyzeHeaders } from "cors-diagnoser";

app.use((req, res, next) => {
  res.on("finish", () => {
    const diagnoses = analyzeHeaders(req, res);

    if (diagnoses.length > 0) {
      console.log("CORS issues detected:");
      diagnoses.forEach((d) => {
        console.log(`- ${d.issue}: ${d.description}`);
        console.log(`  Recommendation: ${d.recommendation}`);
      });
    }
  });
  next();
});
```

### Viewing Error History

```typescript
import { getErrorHistory, clearErrorHistory } from "cors-diagnoser";

// Get all CORS errors detected during the session
app.get("/admin/cors-errors", (req, res) => {
  const errors = getErrorHistory();
  res.json(errors);
});

// Clear error history
app.post("/admin/cors-errors/clear", (req, res) => {
  clearErrorHistory();
  res.json({ message: "History cleared" });
});
```

## 🌐 Usage - Frontend

### Browser Listener

Capture and diagnose CORS errors that occur in the browser:

```typescript
import { listenCorsErrors } from "cors-diagnoser";

// Start listening for CORS errors
listenCorsErrors({
  verbose: true,
  customHandler: (error) => {
    // Send to your analytics service
    analytics.track("cors_error", {
      message: error.message,
      causes: error.possibleCauses,
    });
  },
});
```

### Getting Captured Errors

```typescript
import { getCorsErrors, stopListening } from "cors-diagnoser";

// Get all captured CORS errors
const errors = getCorsErrors();
console.log(`Captured ${errors.length} CORS errors`);

// Stop listening when done
stopListening();
```

## 📚 API Reference

### Backend API

#### `corsDiagnoser(options?)`

Creates an Express middleware that automatically diagnoses CORS issues.

**Options:**

- `verbose` (boolean): Enable detailed logging. Default: `false`
- `enableHistory` (boolean): Store errors in memory for later retrieval. Default: `true`
- `maxHistorySize` (number): Maximum number of errors to store. Default: `100`
- `securityChecks` (boolean): Enable security validation. Default: `true`

**Returns:** Express middleware function

#### `analyzeHeaders(req, res)`

Analyzes request and response headers to detect CORS issues.

**Parameters:**

- `req`: Express Request object
- `res`: Express Response object

**Returns:** `Diagnosis[]` - Array of detected issues

#### `compareConfiguration(current, expected)`

Compares current CORS configuration with expected configuration.

**Parameters:**

- `current`: Current CORS configuration object
- `expected`: Expected CORS configuration object

**Returns:** `ConfigurationDiff` - Object showing differences

#### `testOrigin(origin, config)`

Tests if a specific origin would be allowed by the given configuration.

**Parameters:**

- `origin` (string): Origin URL to test
- `config`: CORS configuration object

**Returns:** `TestResult` - Object indicating if origin is allowed

#### `getErrorHistory()`

Retrieves all CORS errors detected during the session.

**Returns:** `CorsError[]` - Array of errors sorted by timestamp (newest first)

#### `clearErrorHistory()`

Clears the error history.

### Frontend API

#### `listenCorsErrors(options?)`

Starts listening for CORS errors in the browser.

**Options:**

- `verbose` (boolean): Enable detailed console output. Default: `false`
- `autoStart` (boolean): Start listening immediately. Default: `true`
- `customHandler` (function): Custom error handler function

#### `stopListening()`

Stops listening for CORS errors and cleans up event listeners.

#### `getCorsErrors()`

Retrieves all captured CORS errors.

**Returns:** `CorsErrorInfo[]` - Array of captured errors

### Core API (Advanced)

#### `detectPattern(req, res)`

Detects common CORS error patterns.

**Returns:** `ErrorPattern | null` - Detected pattern or null

#### `checkSecurity(config, environment?)`

Validates CORS configuration for security issues.

**Parameters:**

- `config`: CORS configuration object
- `environment`: 'development' | 'production'

**Returns:** `SecurityIssue[]` - Array of security concerns

### TypeScript Interfaces

```typescript
interface Diagnosis {
  issue: string;
  description: string;
  recommendation: string;
  codeExample?: string;
  pattern?: string;
  severity?: "info" | "warning" | "critical";
}

interface CorsConfiguration {
  origin: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

interface CorsError {
  timestamp: Date;
  route: string;
  method: string;
  origin: string;
  diagnoses: Diagnosis[];
  count: number;
}

interface CorsErrorInfo {
  message: string;
  possibleCauses: string[];
  recommendations: string[];
  timestamp: Date;
}

interface TestResult {
  allowed: boolean;
  reason?: string;
  headers: Record<string, string>;
  preflight: {
    required: boolean;
    allowed: boolean;
  };
}

interface SecurityIssue {
  level: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendation: string;
}
```

## 🎯 Common Patterns Detected

cors-diagnoser automatically detects the following common CORS error patterns:

1. **wildcard-credentials-conflict**: Access-Control-Allow-Origin "\*" with credentials enabled

   - Browsers block this combination for security
   - Solution: Use specific origin instead of wildcard

2. **multiple-origins-misconfiguration**: Multiple origins needed but only one string configured

   - CORS doesn't accept multiple comma-separated origins
   - Solution: Use a function to validate origin dynamically

3. **preflight-only-failure**: Preflight fails but simple request would work

   - Required headers missing in OPTIONS response
   - Solution: Configure Access-Control-Allow-Methods and Access-Control-Allow-Headers

4. **custom-headers-not-allowed**: Custom headers sent but not allowed

   - Frontend sends headers not in Access-Control-Allow-Headers
   - Solution: Add custom headers to allowed list

5. **missing-allow-origin**: Access-Control-Allow-Origin missing in response

   - Most basic and essential CORS header
   - Solution: Configure CORS middleware or add header manually

6. **missing-allow-headers**: Access-Control-Allow-Headers missing in preflight

   - Required when frontend sends custom headers
   - Solution: List all headers your API accepts

7. **missing-allow-methods**: Access-Control-Allow-Methods missing in preflight

   - Required for methods beyond GET, HEAD, POST
   - Solution: List all HTTP methods your API supports

8. **credentials-mismatch**: Frontend sends credentials but backend doesn't allow

   - Access-Control-Allow-Credentials must be 'true'
   - Solution: Enable credentials on backend or remove from frontend

9. **origin-null-blocked**: Origin "null" is being blocked

   - Common in requests from local files or iframes
   - Solution: Configure appropriate development environment

10. **port-mismatch**: Same domain but different port blocked
    - Browsers treat different ports as different origins
    - Solution: Add origin with specific port to configuration

## ⚙️ Configuration Options

### Middleware Options

```typescript
interface CorsMiddlewareOptions {
  // Enable detailed logging of all CORS checks
  verbose?: boolean; // Default: false

  // Store errors in memory for later retrieval
  enableHistory?: boolean; // Default: true

  // Maximum number of errors to store in history
  maxHistorySize?: number; // Default: 100

  // Enable security validation checks
  securityChecks?: boolean; // Default: true
}
```

### Browser Listener Options

```typescript
interface BrowserListenerOptions {
  // Enable detailed console output
  verbose?: boolean; // Default: false

  // Start listening immediately
  autoStart?: boolean; // Default: true

  // Custom handler for captured errors
  customHandler?: (error: CorsErrorInfo) => void;
}
```

## 💡 Examples

### Example 1: Basic Express Setup with CORS

```typescript
import express from "express";
import cors from "cors";
import { corsDiagnoser } from "cors-diagnoser";

const app = express();

// Add CORS diagnoser BEFORE your CORS middleware
app.use(corsDiagnoser({ verbose: true }));

// Configure CORS
app.use(
  cors({
    origin: "https://example.com",
    credentials: true,
  })
);

app.get("/api/data", (req, res) => {
  res.json({ data: "Hello World" });
});

app.listen(3000);
```

### Example 2: Dynamic Origin Validation

```typescript
import { corsDiagnoser, testOrigin } from "cors-diagnoser";

const allowedOrigins = ["https://app.example.com", "https://admin.example.com"];

app.use(corsDiagnoser());

app.use(
  cors({
    origin: (origin, callback) => {
      // Test if origin would be allowed
      const config = { origin: allowedOrigins };
      const result = testOrigin(origin, config);

      if (result.allowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
```

### Example 3: Comparing Configurations

```typescript
import { compareConfiguration } from "cors-diagnoser";

const currentConfig = {
  origin: "*",
  methods: ["GET", "POST"],
};

const expectedConfig = {
  origin: "https://example.com",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

const diff = compareConfiguration(currentConfig, expectedConfig);

console.log("Missing properties:", diff.missing);
console.log("Incorrect values:", diff.incorrect);
console.log("Summary:", diff.summary);
```

### Example 4: Frontend Error Tracking

```typescript
import { listenCorsErrors, getCorsErrors } from "cors-diagnoser";

// Start listening
listenCorsErrors({
  verbose: true,
  customHandler: (error) => {
    // Send to error tracking service
    Sentry.captureException(new Error(error.message), {
      extra: {
        possibleCauses: error.possibleCauses,
        recommendations: error.recommendations,
      },
    });
  },
});

// Later, retrieve all errors
const errors = getCorsErrors();
console.log(`Total CORS errors: ${errors.length}`);
```

### Example 5: Security Validation

```typescript
import { checkSecurity } from "cors-diagnoser";

const config = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
};

const issues = checkSecurity(config, "production");

issues.forEach((issue) => {
  console.log(`[${issue.level.toUpperCase()}] ${issue.title}`);
  console.log(`  ${issue.description}`);
  console.log(`  Recommendation: ${issue.recommendation}`);
});
```

### Example 6: Testing Origins Before Deployment

```typescript
import { testOrigin } from "cors-diagnoser";

const config = {
  origin: ["https://app.example.com", "https://admin.example.com"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
};

const originsToTest = [
  "https://app.example.com",
  "https://malicious.com",
  "http://localhost:3000",
];

originsToTest.forEach((origin) => {
  const result = testOrigin(origin, config);
  console.log(`${origin}: ${result.allowed ? "✅ ALLOWED" : "❌ BLOCKED"}`);

  if (!result.allowed) {
    console.log(`  Reason: ${result.reason}`);
  }
});
```

## 🗺️ Roadmap

We're working on expanding cors-diagnoser with the following features:

- **Fastify Support**: Middleware for Fastify framework
- **Next.js API Routes**: Specific helper for Next.js API routes
- **CLI Tool**: Command-line tool to test endpoints and validate configurations
  - `cors-diagnoser test https://api.example.com`
  - `cors-diagnoser validate cors-config.json`
- **Dashboard SaaS**: Web platform for CORS error aggregation
  - Analytics of CORS issues across multiple environments
  - Real-time alerts
  - Trend and pattern visualization
- **IDE Extensions**: Extensions for VS Code and other editors
  - Inline quick fixes
  - Diagnostics in configuration files
- **Advanced Pattern Detection**: Machine learning to detect new patterns
- **APM Integration**: Integration with Datadog, New Relic, and other monitoring tools

## 🤝 Contributing

Contributions are welcome! If you found a bug or have a feature suggestion:

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/dominiquekossi/cors-diagnoser.git
cd cors-diagnoser

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## 📄 License

MIT © Dominique Kossi

---

**Made with ❤️ by developers, for developers**

If this package helped you, consider giving it a ⭐ on GitHub!
