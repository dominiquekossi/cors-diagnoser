import type { Request, Response } from "express";
import { parseHeaders, isPreflightRequest } from "./utils.js";

/**
 * Represents a common CORS error pattern with detection logic and solution
 */
export interface ErrorPattern {
  id: string;
  name: string;
  detector: (req: Request, res: Response) => boolean;
  explanation: string;
  solution: string;
  codeExample: string;
}

/**
 * Common CORS error patterns with detection logic and solutions
 */
export const COMMON_PATTERNS: ErrorPattern[] = [
  {
    id: "wildcard-credentials-conflict",
    name: "Wildcard Origin with Credentials Conflict",
    detector: (_req: Request, res: Response) => {
      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );
      const allowOrigin = resHeaders.get("access-control-allow-origin");
      const allowCredentials = resHeaders.get(
        "access-control-allow-credentials"
      );

      return allowOrigin === "*" && allowCredentials === "true";
    },
    explanation:
      "Access-Control-Allow-Origin is set to '*' (wildcard) while Access-Control-Allow-Credentials is 'true'. This combination is forbidden by the CORS specification. When credentials are included, you must specify an exact origin.",
    solution:
      "Replace the wildcard '*' with the specific origin from the request, or disable credentials if you need to allow all origins.",
    codeExample: `// Instead of:
app.use(cors({ origin: '*', credentials: true }));

// Use:
app.use(cors({ 
  origin: 'https://example.com', // or use a function to validate origins
  credentials: true 
}));

// Or with dynamic origin:
app.use(cors({ 
  origin: (origin, callback) => {
    const allowedOrigins = ['https://example.com', 'https://app.example.com'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));`,
  },

  {
    id: "multiple-origins-misconfiguration",
    name: "Multiple Origins Misconfiguration",
    detector: (_req: Request, res: Response) => {
      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );
      const allowOrigin = resHeaders.get("access-control-allow-origin");

      // Check if multiple origins are specified in a single string (comma-separated)
      return !!allowOrigin && allowOrigin.includes(",");
    },
    explanation:
      "Access-Control-Allow-Origin contains multiple origins separated by commas. The CORS specification only allows a single origin or '*' in this header. You cannot specify multiple origins directly.",
    solution:
      "Use a function to dynamically return the appropriate origin based on the request, or use a CORS middleware that handles multiple origins.",
    codeExample: `// Instead of:
res.setHeader('Access-Control-Allow-Origin', 'https://example.com, https://app.example.com');

// Use:
const allowedOrigins = ['https://example.com', 'https://app.example.com'];
const origin = req.headers.origin;
if (origin && allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}

// Or with cors middleware:
app.use(cors({ 
  origin: ['https://example.com', 'https://app.example.com']
}));`,
  },

  {
    id: "preflight-only-failure",
    name: "Preflight Request Failure",
    detector: (req: Request, res: Response) => {
      if (!isPreflightRequest(req)) {
        return false;
      }

      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );
      const hasAllowOrigin = resHeaders.has("access-control-allow-origin");
      const hasAllowMethods = resHeaders.has("access-control-allow-methods");

      // Preflight is failing if it's missing required headers
      return !hasAllowOrigin || !hasAllowMethods;
    },
    explanation:
      "The preflight OPTIONS request is missing required CORS headers. Preflight requests must include Access-Control-Allow-Origin and Access-Control-Allow-Methods headers in the response.",
    solution:
      "Ensure your server responds to OPTIONS requests with the appropriate CORS headers, or use a CORS middleware that handles preflight automatically.",
    codeExample: `// Add OPTIONS handler before your routes:
app.options('*', cors());

// Or handle manually:
app.options('/api/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});`,
  },

  {
    id: "custom-headers-not-allowed",
    name: "Custom Headers Not Allowed",
    detector: (req: Request, res: Response) => {
      if (!isPreflightRequest(req)) {
        return false;
      }

      const reqHeaders = parseHeaders(req.headers as Record<string, string>);
      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );

      const requestedHeaders = reqHeaders.get("access-control-request-headers");
      const allowedHeaders = resHeaders.get("access-control-allow-headers");

      // If custom headers are requested but not allowed
      return !!requestedHeaders && !allowedHeaders;
    },
    explanation:
      "The browser is requesting permission to send custom headers (via Access-Control-Request-Headers), but the server is not responding with Access-Control-Allow-Headers to grant permission.",
    solution:
      "Add the Access-Control-Allow-Headers header to your preflight response, listing all custom headers your API accepts.",
    codeExample: `// With cors middleware:
app.use(cors({ 
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header']
}));

// Or manually:
app.options('/api/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Custom-Header');
  res.sendStatus(204);
});`,
  },

  {
    id: "missing-allow-origin",
    name: "Missing Access-Control-Allow-Origin",
    detector: (req: Request, res: Response) => {
      const reqHeaders = parseHeaders(req.headers as Record<string, string>);
      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );

      const origin = reqHeaders.get("origin");
      const allowOrigin = resHeaders.get("access-control-allow-origin");

      // If there's an origin in the request but no allow-origin in response
      return !!origin && !allowOrigin;
    },
    explanation:
      "The request includes an Origin header, but the server response is missing the Access-Control-Allow-Origin header. This is the most common CORS error.",
    solution:
      "Add the Access-Control-Allow-Origin header to your response. Use a CORS middleware or set the header manually.",
    codeExample: `// Using cors middleware (recommended):
import cors from 'cors';
app.use(cors());

// Or manually for specific routes:
app.get('/api/data', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.json({ data: 'your data' });
});

// Or for specific origin:
app.use(cors({ origin: 'https://example.com' }));`,
  },

  {
    id: "missing-allow-headers",
    name: "Missing Access-Control-Allow-Headers on Preflight",
    detector: (req: Request, res: Response) => {
      if (!isPreflightRequest(req)) {
        return false;
      }

      const reqHeaders = parseHeaders(req.headers as Record<string, string>);
      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );

      const requestedHeaders = reqHeaders.get("access-control-request-headers");
      const allowedHeaders = resHeaders.get("access-control-allow-headers");

      return !!requestedHeaders && !allowedHeaders;
    },
    explanation:
      "The preflight request includes Access-Control-Request-Headers, but the response is missing Access-Control-Allow-Headers. The browser needs explicit permission to send custom headers.",
    solution:
      "Include the Access-Control-Allow-Headers header in your preflight response with the list of allowed headers.",
    codeExample: `// With cors middleware:
app.use(cors({ 
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Or handle OPTIONS manually:
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.sendStatus(204);
});`,
  },

  {
    id: "missing-allow-methods",
    name: "Missing Access-Control-Allow-Methods on Preflight",
    detector: (req: Request, res: Response) => {
      if (!isPreflightRequest(req)) {
        return false;
      }

      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );
      const allowMethods = resHeaders.get("access-control-allow-methods");

      return !allowMethods;
    },
    explanation:
      "The preflight OPTIONS request is missing the Access-Control-Allow-Methods header. This header tells the browser which HTTP methods are allowed for the actual request.",
    solution:
      "Add the Access-Control-Allow-Methods header to your preflight response, listing all HTTP methods your API supports.",
    codeExample: `// With cors middleware:
app.use(cors({ 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));

// Or manually:
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.sendStatus(204);
});`,
  },

  {
    id: "credentials-mismatch",
    name: "Credentials Mode Mismatch",
    detector: (req: Request, res: Response) => {
      const reqHeaders = parseHeaders(req.headers as Record<string, string>);
      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );

      // Check if request likely includes credentials (Cookie header present)
      const hasCookies = reqHeaders.has("cookie");
      const allowCredentials = resHeaders.get(
        "access-control-allow-credentials"
      );

      // Credentials sent but not allowed
      return hasCookies && allowCredentials !== "true";
    },
    explanation:
      "The frontend is sending credentials (cookies, authorization headers) but the server is not responding with Access-Control-Allow-Credentials: true. Credentials will be blocked.",
    solution:
      "Enable credentials in your CORS configuration on the server, and ensure you're using a specific origin (not wildcard).",
    codeExample: `// Backend (Express):
app.use(cors({ 
  origin: 'https://example.com',
  credentials: true 
}));

// Frontend (fetch):
fetch('https://api.example.com/data', {
  credentials: 'include' // This sends cookies
});

// Frontend (axios):
axios.get('https://api.example.com/data', {
  withCredentials: true
});`,
  },

  {
    id: "origin-null-blocked",
    name: "Origin 'null' Blocked",
    detector: (req: Request, res: Response) => {
      const reqHeaders = parseHeaders(req.headers as Record<string, string>);
      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );

      const origin = reqHeaders.get("origin");
      const allowOrigin = resHeaders.get("access-control-allow-origin");

      // Origin is "null" but not explicitly allowed
      return origin === "null" && allowOrigin !== "null" && allowOrigin !== "*";
    },
    explanation:
      "The request has Origin: null (common with file:// protocol, sandboxed iframes, or redirects), but the server is not configured to allow it. This is a security-sensitive scenario.",
    solution:
      "If you need to support null origins (e.g., for local file testing), explicitly allow it. However, be cautious as this can be a security risk in production.",
    codeExample: `// For development/testing only:
app.use(cors({ 
  origin: (origin, callback) => {
    // Allow null origin for local development
    if (!origin || origin === 'null') {
      callback(null, true);
    } else {
      callback(null, origin);
    }
  }
}));

// Better: Use a local development server instead of file://
// npx http-server or python -m http.server`,
  },

  {
    id: "port-mismatch",
    name: "Same Domain Different Port Blocked",
    detector: (req: Request, res: Response) => {
      const reqHeaders = parseHeaders(req.headers as Record<string, string>);
      const resHeaders = parseHeaders(
        res.getHeaders() as Record<string, string>
      );

      const origin = reqHeaders.get("origin");
      const allowOrigin = resHeaders.get("access-control-allow-origin");

      if (!origin || !allowOrigin || allowOrigin === "*") {
        return false;
      }

      try {
        const originUrl = new URL(origin);
        const allowedUrl = new URL(allowOrigin);

        // Same hostname but different port
        return (
          originUrl.hostname === allowedUrl.hostname &&
          originUrl.port !== allowedUrl.port
        );
      } catch {
        return false;
      }
    },
    explanation:
      "The request is from the same domain but a different port (e.g., localhost:3000 vs localhost:5000). Browsers treat different ports as different origins, so CORS applies.",
    solution:
      "Include the full origin with the port number in your CORS configuration, or use a dynamic origin validator.",
    codeExample: `// Allow specific ports:
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:5000']
}));

// Or allow all localhost ports (development only):
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));`,
  },
];

/**
 * Detects which CORS error pattern matches the current request/response
 * Returns the first matching pattern or null if no pattern matches
 */
export function detectPattern(
  req: Request,
  res: Response
): ErrorPattern | null {
  for (const pattern of COMMON_PATTERNS) {
    try {
      if (pattern.detector(req, res)) {
        return pattern;
      }
    } catch (error) {
      // Continue to next pattern if detector throws
      continue;
    }
  }

  return null;
}
