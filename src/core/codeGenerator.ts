import { colorize } from "./utils.js";

/**
 * Represents a code example with syntax highlighting support
 */
export interface CodeExample {
  language: string;
  code: string;
  description: string;
}

/**
 * Context information for generating code examples
 */
interface CodeContext {
  origin?: string;
  origins?: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  issue?: string;
}

/**
 * Generates Express.js code examples for common CORS configurations
 */
export function generateExpressExample(
  issue: string,
  context: CodeContext = {}
): CodeExample {
  const { origin, origins, methods, headers } = context;

  let code = "";
  let description = "";

  // Determine which template to use based on the issue
  if (issue.includes("wildcard") && issue.includes("credentials")) {
    description = "Configure CORS with specific origin when using credentials";
    const specificOrigin = origin || origins?.[0] || "https://example.com";
    code = `import cors from 'cors';
import express from 'express';

const app = express();

// Configure CORS with specific origin for credentials
app.use(cors({
  origin: '${specificOrigin}',
  credentials: true
}));

// Or with multiple origins:
app.use(cors({
  origin: ['https://example.com', 'https://app.example.com'],
  credentials: true
}));`;
  } else if (issue.includes("multiple") && issue.includes("origin")) {
    description = "Configure CORS to handle multiple origins correctly";
    const originList = origins || [
      "https://example.com",
      "https://app.example.com",
    ];
    code = `import cors from 'cors';
import express from 'express';

const app = express();

// Method 1: Use array of allowed origins
app.use(cors({
  origin: ${JSON.stringify(originList, null, 2)}
}));

// Method 2: Use dynamic origin validation
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = ${JSON.stringify(originList, null, 2)};
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));`;
  } else if (issue.includes("preflight") || issue.includes("OPTIONS")) {
    description = "Configure CORS to handle preflight requests";
    const allowedMethods = methods || ["GET", "POST", "PUT", "DELETE", "PATCH"];
    const allowedHeaders = headers || ["Content-Type", "Authorization"];
    code = `import cors from 'cors';
import express from 'express';

const app = express();

// Enable preflight for all routes
app.options('*', cors());

// Or configure CORS with specific methods and headers
app.use(cors({
  origin: '${origin || "https://example.com"}',
  methods: ${JSON.stringify(allowedMethods)},
  allowedHeaders: ${JSON.stringify(allowedHeaders)},
  preflightContinue: false,
  optionsSuccessStatus: 204
}));`;
  } else if (
    issue.includes("custom header") ||
    issue.includes("Access-Control-Allow-Headers")
  ) {
    description = "Configure CORS to allow custom headers";
    const allowedHeaders = headers || [
      "Content-Type",
      "Authorization",
      "X-Custom-Header",
    ];
    code = `import cors from 'cors';
import express from 'express';

const app = express();

// Allow specific custom headers
app.use(cors({
  origin: '${origin || "https://example.com"}',
  allowedHeaders: ${JSON.stringify(allowedHeaders)}
}));

// Or allow all requested headers (less secure)
app.use(cors({
  origin: '${origin || "https://example.com"}',
  allowedHeaders: '*'
}));`;
  } else if (issue.includes("credentials")) {
    description = "Configure CORS to allow credentials (cookies, auth headers)";
    code = `import cors from 'cors';
import express from 'express';

const app = express();

// Enable credentials with specific origin
app.use(cors({
  origin: '${origin || "https://example.com"}',
  credentials: true
}));

// Note: Cannot use wildcard '*' with credentials
// Must specify exact origin(s)`;
  } else if (issue.includes("method")) {
    description = "Configure CORS to allow specific HTTP methods";
    const allowedMethods = methods || ["GET", "POST", "PUT", "DELETE"];
    code = `import cors from 'cors';
import express from 'express';

const app = express();

// Allow specific HTTP methods
app.use(cors({
  origin: '${origin || "https://example.com"}',
  methods: ${JSON.stringify(allowedMethods)}
}));`;
  } else {
    // Default: basic CORS setup
    description = "Basic CORS configuration for Express";
    code = `import cors from 'cors';
import express from 'express';

const app = express();

// Basic CORS - allows all origins
app.use(cors());

// Or with specific origin
app.use(cors({
  origin: '${origin || "https://example.com"}'
}));

// Or with multiple origins
app.use(cors({
  origin: ['https://example.com', 'https://app.example.com']
}));`;
  }

  return {
    language: "typescript",
    code,
    description,
  };
}

/**
 * Generates frontend fetch/axios code examples for CORS configurations
 */
export function generateFetchExample(
  issue: string,
  context: CodeContext = {}
): CodeExample {
  const { origin, headers } = context;

  let code = "";
  let description = "";

  if (issue.includes("credentials")) {
    description =
      "Frontend configuration for sending credentials with requests";
    code = `// Using fetch with credentials
fetch('${origin || "https://api.example.com"}/api/data', {
  method: 'GET',
  credentials: 'include', // Send cookies and auth headers
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('CORS error:', error));

// Using axios with credentials
import axios from 'axios';

axios.get('${origin || "https://api.example.com"}/api/data', {
  withCredentials: true // Enable credentials
})
  .then(response => console.log(response.data))
  .catch(error => console.error('CORS error:', error));

// Configure axios globally
axios.defaults.withCredentials = true;`;
  } else if (
    issue.includes("custom header") ||
    issue.includes("Access-Control-Allow-Headers")
  ) {
    description = "Frontend configuration for sending custom headers";
    const customHeaders = headers || ["X-Custom-Header", "X-API-Key"];
    code = `// Using fetch with custom headers
fetch('${origin || "https://api.example.com"}/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN',
${customHeaders.map((h) => `    '${h}': 'value'`).join(",\n")}
  },
  body: JSON.stringify({ data: 'your data' })
})
  .then(response => response.json())
  .then(data => console.log(data));

// Using axios with custom headers
import axios from 'axios';

axios.post('${origin || "https://api.example.com"}/api/data', 
  { data: 'your data' },
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
${customHeaders.map((h) => `      '${h}': 'value'`).join(",\n")}
    }
  }
);`;
  } else if (issue.includes("preflight") || issue.includes("OPTIONS")) {
    description =
      "Frontend request that triggers preflight (non-simple request)";
    code = `// Requests that trigger preflight:
// 1. Methods other than GET, HEAD, POST
// 2. Custom headers beyond simple headers
// 3. Content-Type other than application/x-www-form-urlencoded, 
//    multipart/form-data, or text/plain

// Example: PUT request (triggers preflight)
fetch('${origin || "https://api.example.com"}/api/data', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ data: 'updated data' })
});

// Example: Custom header (triggers preflight)
fetch('${origin || "https://api.example.com"}/api/data', {
  method: 'GET',
  headers: {
    'X-Custom-Header': 'value' // This triggers preflight
  }
});

// Simple request (no preflight):
fetch('${origin || "https://api.example.com"}/api/data', {
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
});`;
  } else {
    // Default: basic fetch example
    description = "Basic frontend request configuration";
    code = `// Using fetch
fetch('${origin || "https://api.example.com"}/api/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('CORS error:', error));

// Using fetch with POST
fetch('${origin || "https://api.example.com"}/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ data: 'your data' })
})
  .then(response => response.json())
  .then(data => console.log(data));

// Using axios
import axios from 'axios';

axios.get('${origin || "https://api.example.com"}/api/data')
  .then(response => console.log(response.data))
  .catch(error => console.error('CORS error:', error));`;
  }

  return {
    language: "typescript",
    code,
    description,
  };
}

/**
 * Formats code with ANSI syntax highlighting for console output
 */
export function formatCodeForConsole(code: string, language: string): string {
  // Simple syntax highlighting for TypeScript/JavaScript
  if (language === "typescript" || language === "javascript") {
    let highlighted = code;

    // Keywords
    const keywords = [
      "import",
      "from",
      "const",
      "let",
      "var",
      "function",
      "return",
      "if",
      "else",
      "for",
      "while",
      "try",
      "catch",
      "new",
      "class",
      "export",
      "default",
      "async",
      "await",
    ];

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b(${keyword})\\b`, "g");
      highlighted = highlighted.replace(regex, colorize(keyword, "magenta"));
    });

    // Strings (single and double quotes)
    highlighted = highlighted.replace(
      /(['"`])((?:\\.|(?!\1).)*?)\1/g,
      (match) => colorize(match, "green")
    );

    // Comments
    highlighted = highlighted.replace(/\/\/.*/g, (match) =>
      colorize(match, "gray")
    );
    highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, (match) =>
      colorize(match, "gray")
    );

    // Numbers
    highlighted = highlighted.replace(/\b(\d+)\b/g, (match) =>
      colorize(match, "cyan")
    );

    // Function names (simple detection)
    highlighted = highlighted.replace(
      /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      (_match, funcName) => colorize(funcName, "yellow") + "("
    );

    return highlighted;
  }

  // For other languages, return as-is
  return code;
}
