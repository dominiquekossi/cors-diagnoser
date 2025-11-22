import { describe, it, expect } from "@jest/globals";
import {
  generateExpressExample,
  generateFetchExample,
  formatCodeForConsole,
} from "./codeGenerator.js";

describe("generateExpressExample", () => {
  it("should generate code for wildcard credentials conflict", () => {
    const result = generateExpressExample("wildcard credentials conflict", {
      origin: "https://example.com",
    });

    expect(result.language).toBe("typescript");
    expect(result.code).toContain("cors");
    expect(result.code).toContain("credentials: true");
    expect(result.code).toContain("https://example.com");
    expect(result.description).toContain("credentials");
  });

  it("should generate code for multiple origins misconfiguration", () => {
    const result = generateExpressExample("multiple origin misconfiguration", {
      origins: ["https://example.com", "https://app.example.com"],
    });

    expect(result.code).toContain("https://example.com");
    expect(result.code).toContain("https://app.example.com");
    expect(result.code).toContain("origin:");
    expect(result.description).toContain("multiple");
  });

  it("should generate code for preflight issues", () => {
    const result = generateExpressExample("preflight failure", {
      origin: "https://example.com",
      methods: ["GET", "POST", "PUT"],
      headers: ["Content-Type", "Authorization"],
    });

    expect(result.code).toContain("options");
    expect(result.code).toContain("GET");
    expect(result.code).toContain("POST");
    expect(result.code).toContain("Content-Type");
    expect(result.description).toContain("preflight");
  });

  it("should generate code for custom headers issue", () => {
    const result = generateExpressExample(
      "custom header Access-Control-Allow-Headers",
      {
        origin: "https://example.com",
        headers: ["X-Custom-Header", "X-API-Key"],
      }
    );

    expect(result.code).toContain("allowedHeaders");
    expect(result.code).toContain("X-Custom-Header");
    expect(result.code).toContain("X-API-Key");
    expect(result.description).toContain("custom headers");
  });

  it("should generate code for credentials issue", () => {
    const result = generateExpressExample("credentials mismatch", {
      origin: "https://example.com",
    });

    expect(result.code).toContain("credentials: true");
    expect(result.code).toContain("https://example.com");
    expect(result.description).toContain("credentials");
  });

  it("should generate code for methods issue", () => {
    const result = generateExpressExample("method not allowed", {
      methods: ["GET", "POST", "DELETE"],
    });

    expect(result.code).toContain("methods:");
    expect(result.code).toContain("GET");
    expect(result.code).toContain("POST");
    expect(result.code).toContain("DELETE");
    expect(result.description).toContain("methods");
  });

  it("should generate default basic CORS setup", () => {
    const result = generateExpressExample("unknown issue");

    expect(result.code).toContain("cors");
    expect(result.code).toContain("import");
    expect(result.description).toContain("Basic");
  });

  it("should use default values when context is empty", () => {
    const result = generateExpressExample("preflight failure", {});

    expect(result.code).toContain("https://example.com");
    expect(result.code).toContain("GET");
    expect(result.code).toContain("POST");
  });

  it("should produce valid TypeScript code", () => {
    const result = generateExpressExample("wildcard credentials conflict");

    expect(result.language).toBe("typescript");
    expect(result.code).toContain("import");
    expect(result.code).toContain("const app");
    expect(result.code).toContain("app.use");
  });
});

describe("generateFetchExample", () => {
  it("should generate code for credentials issue", () => {
    const result = generateFetchExample("credentials mismatch", {
      origin: "https://api.example.com",
    });

    expect(result.code).toContain("credentials: 'include'");
    expect(result.code).toContain("withCredentials: true");
    expect(result.code).toContain("https://api.example.com");
    expect(result.description).toContain("credentials");
  });

  it("should generate code for custom headers issue", () => {
    const result = generateFetchExample(
      "custom header Access-Control-Allow-Headers",
      {
        origin: "https://api.example.com",
        headers: ["X-Custom-Header", "X-API-Key"],
      }
    );

    expect(result.code).toContain("X-Custom-Header");
    expect(result.code).toContain("X-API-Key");
    expect(result.code).toContain("headers:");
    expect(result.description).toContain("custom headers");
  });

  it("should generate code for preflight issues", () => {
    const result = generateFetchExample("preflight OPTIONS failure", {
      origin: "https://api.example.com",
    });

    expect(result.code).toContain("preflight");
    expect(result.code).toContain("PUT");
    expect(result.code).toContain("X-Custom-Header");
    expect(result.description).toContain("preflight");
  });

  it("should generate default fetch example", () => {
    const result = generateFetchExample("unknown issue");

    expect(result.code).toContain("fetch");
    expect(result.code).toContain("https://api.example.com");
    expect(result.description).toContain("Basic");
  });

  it("should include both fetch and axios examples", () => {
    const result = generateFetchExample("credentials issue");

    expect(result.code).toContain("fetch(");
    expect(result.code).toContain("axios");
  });

  it("should use default origin when not provided", () => {
    const result = generateFetchExample("credentials issue", {});

    expect(result.code).toContain("https://api.example.com");
  });

  it("should produce valid TypeScript code", () => {
    const result = generateFetchExample("credentials issue");

    expect(result.language).toBe("typescript");
    expect(result.code).toContain("fetch");
    expect(result.code).toContain(".then");
  });
});

describe("formatCodeForConsole", () => {
  it("should add ANSI color codes to TypeScript code", () => {
    const code = "const app = express();";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b["); // Contains ANSI codes
    expect(result.length).toBeGreaterThan(code.length); // Longer due to codes
  });

  it("should highlight keywords", () => {
    const code = "import express from 'express';";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[35m"); // Magenta for keywords
  });

  it("should highlight strings", () => {
    const code = "const str = 'hello world';";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[32m"); // Green for strings
  });

  it("should highlight comments", () => {
    const code = "// This is a comment\nconst x = 1;";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[90m"); // Gray for comments
  });

  it("should highlight numbers", () => {
    const code = "const num = 42;";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[36m"); // Cyan for numbers
  });

  it("should highlight function names", () => {
    const code = "function myFunc() {}";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[33m"); // Yellow for function names
  });

  it("should work with JavaScript language", () => {
    const code = "const app = express();";
    const result = formatCodeForConsole(code, "javascript");

    expect(result).toContain("\x1b["); // Contains ANSI codes
  });

  it("should return code as-is for unsupported languages", () => {
    const code = "SELECT * FROM users;";
    const result = formatCodeForConsole(code, "sql");

    expect(result).toBe(code); // No changes
  });

  it("should handle multi-line code", () => {
    const code = `import express from 'express';
const app = express();
app.listen(3000);`;
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b["); // Contains ANSI codes
    expect(result.split("\n").length).toBe(3); // Preserves line breaks
  });

  it("should handle block comments", () => {
    const code = "/* This is a block comment */\nconst x = 1;";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[90m"); // Gray for comments
  });

  it("should handle double-quoted strings", () => {
    const code = 'const str = "hello";';
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[32m"); // Green for strings
  });

  it("should handle template literals", () => {
    const code = "const str = `hello ${name}`;";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[32m"); // Green for strings
  });

  it("should handle multiple keywords in one line", () => {
    const code = "import { const, let } from 'module';";
    const result = formatCodeForConsole(code, "typescript");

    expect(result).toContain("\x1b[35m"); // Magenta for keywords
  });
});
