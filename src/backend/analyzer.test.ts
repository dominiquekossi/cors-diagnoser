import { describe, it, expect } from "@jest/globals";
import {
  analyzeHeaders,
  compareConfiguration,
  testOrigin,
  type CorsConfiguration,
} from "./analyzer.js";
import type { Request, Response } from "express";

// Helper to create mock Request
function createMockRequest(options: {
  method?: string;
  headers?: Record<string, string>;
}): Request {
  return {
    method: options.method || "GET",
    headers: options.headers || {},
  } as Request;
}

// Helper to create mock Response
function createMockResponse(headers: Record<string, string>): Response {
  return {
    getHeaders: () => headers,
  } as Response;
}

describe("analyzeHeaders", () => {
  it("should detect missing Access-Control-Allow-Origin", () => {
    const req = createMockRequest({
      headers: { origin: "https://example.com" },
    });
    const res = createMockResponse({});

    const diagnoses = analyzeHeaders(req, res);

    expect(diagnoses.length).toBeGreaterThan(0);
    const missingOriginIssue = diagnoses.find((d) =>
      d.issue.includes("Missing Access-Control-Allow-Origin")
    );
    expect(missingOriginIssue).toBeDefined();
    expect(missingOriginIssue?.severity).toBe("critical");
    expect(missingOriginIssue?.codeExample).toBeDefined();
  });

  it("should detect origin mismatch", () => {
    const req = createMockRequest({
      headers: { origin: "https://example.com" },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://different.com",
    });

    const diagnoses = analyzeHeaders(req, res);

    const mismatchIssue = diagnoses.find((d) =>
      d.issue.includes("Origin Mismatch")
    );
    expect(mismatchIssue).toBeDefined();
    expect(mismatchIssue?.severity).toBe("critical");
  });

  it("should not detect mismatch when origins match", () => {
    const req = createMockRequest({
      headers: { origin: "https://example.com" },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    const diagnoses = analyzeHeaders(req, res);

    const mismatchIssue = diagnoses.find((d) =>
      d.issue.includes("Origin Mismatch")
    );
    expect(mismatchIssue).toBeUndefined();
  });

  it("should not detect mismatch with wildcard origin", () => {
    const req = createMockRequest({
      headers: { origin: "https://example.com" },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "*",
    });

    const diagnoses = analyzeHeaders(req, res);

    const mismatchIssue = diagnoses.find((d) =>
      d.issue.includes("Origin Mismatch")
    );
    expect(mismatchIssue).toBeUndefined();
  });

  it("should detect wildcard with credentials conflict", () => {
    const req = createMockRequest({
      headers: { origin: "https://example.com" },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
    });

    const diagnoses = analyzeHeaders(req, res);

    const credentialsIssue = diagnoses.find((d) =>
      d.issue.includes("Wildcard Origin with Credentials")
    );
    expect(credentialsIssue).toBeDefined();
    expect(credentialsIssue?.severity).toBe("critical");
    expect(credentialsIssue?.pattern).toBe("wildcard-credentials-conflict");
  });

  it("should detect missing methods on preflight", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "POST",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    const diagnoses = analyzeHeaders(req, res);

    const methodsIssue = diagnoses.find((d) =>
      d.issue.includes("Missing Access-Control-Allow-Methods")
    );
    expect(methodsIssue).toBeDefined();
    expect(methodsIssue?.severity).toBe("critical");
  });

  it("should detect missing headers on preflight when custom headers requested", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "x-custom-header",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
      "access-control-allow-methods": "GET, POST",
    });

    const diagnoses = analyzeHeaders(req, res);

    const headersIssue = diagnoses.find((d) =>
      d.issue.includes("Missing Access-Control-Allow-Headers")
    );
    expect(headersIssue).toBeDefined();
    expect(headersIssue?.severity).toBe("critical");
    expect(headersIssue?.pattern).toBe("custom-headers-not-allowed");
  });

  it("should not detect issues for valid preflight", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
      "access-control-allow-methods": "GET, POST",
      "access-control-allow-headers": "content-type",
    });

    const diagnoses = analyzeHeaders(req, res);

    const criticalIssues = diagnoses.filter((d) => d.severity === "critical");
    expect(criticalIssues.length).toBe(0);
  });

  it("should include security issues from securityAdvisor", () => {
    const req = createMockRequest({
      headers: { origin: "https://example.com" },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
    });

    const diagnoses = analyzeHeaders(req, res);

    // Should have both CORS error and security issues
    expect(diagnoses.length).toBeGreaterThan(1);
  });

  it("should handle requests without origin header", () => {
    const req = createMockRequest({});
    const res = createMockResponse({});

    const diagnoses = analyzeHeaders(req, res);

    // Should not crash, may have security issues but no origin-related issues
    expect(Array.isArray(diagnoses)).toBe(true);
  });

  it("should normalize origins for comparison", () => {
    const req = createMockRequest({
      headers: { origin: "HTTPS://EXAMPLE.COM/" },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    const diagnoses = analyzeHeaders(req, res);

    const mismatchIssue = diagnoses.find((d) =>
      d.issue.includes("Origin Mismatch")
    );
    expect(mismatchIssue).toBeUndefined();
  });
});

describe("compareConfiguration", () => {
  it("should return empty diff for matching configurations", () => {
    const current: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST"],
      credentials: true,
    };
    const expected: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST"],
      credentials: true,
    };

    const diff = compareConfiguration(current, expected);

    expect(diff.missing).toEqual([]);
    expect(diff.incorrect).toEqual([]);
    expect(diff.extra).toEqual([]);
    expect(diff.summary).toContain("match perfectly");
  });

  it("should detect missing properties", () => {
    const current: CorsConfiguration = {
      origin: "https://example.com",
    };
    const expected: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST"],
      credentials: true,
    };

    const diff = compareConfiguration(current, expected);

    expect(diff.missing).toContain("methods");
    expect(diff.missing).toContain("credentials");
    expect(diff.summary).toContain("Missing properties");
  });

  it("should detect incorrect values", () => {
    const current: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET"],
      credentials: false,
    };
    const expected: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST"],
      credentials: true,
    };

    const diff = compareConfiguration(current, expected);

    expect(diff.incorrect.length).toBe(2);
    expect(diff.incorrect.find((i) => i.property === "methods")).toBeDefined();
    expect(
      diff.incorrect.find((i) => i.property === "credentials")
    ).toBeDefined();
    expect(diff.summary).toContain("Incorrect values");
  });

  it("should detect extra properties", () => {
    const current: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST"],
      maxAge: 3600,
    };
    const expected: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST"],
    };

    const diff = compareConfiguration(current, expected);

    expect(diff.extra).toContain("maxAge");
    expect(diff.summary).toContain("Extra properties");
  });

  it("should handle array comparison correctly", () => {
    const current: CorsConfiguration = {
      origin: ["https://example.com", "https://app.example.com"],
    };
    const expected: CorsConfiguration = {
      origin: ["https://app.example.com", "https://example.com"], // Different order
    };

    const diff = compareConfiguration(current, expected);

    expect(diff.incorrect.length).toBe(0); // Should match despite different order
  });

  it("should detect array length mismatch", () => {
    const current: CorsConfiguration = {
      origin: ["https://example.com"],
    };
    const expected: CorsConfiguration = {
      origin: ["https://example.com", "https://app.example.com"],
    };

    const diff = compareConfiguration(current, expected);

    expect(diff.incorrect.length).toBe(1);
    expect(diff.incorrect[0].property).toBe("origin");
  });

  it("should generate comprehensive summary", () => {
    const current: CorsConfiguration = {
      origin: "https://example.com",
      maxAge: 3600,
    };
    const expected: CorsConfiguration = {
      origin: "https://different.com",
      methods: ["GET", "POST"],
    };

    const diff = compareConfiguration(current, expected);

    expect(diff.summary).toContain("Missing properties");
    expect(diff.summary).toContain("Incorrect values");
    expect(diff.summary).toContain("Extra properties");
  });
});

describe("testOrigin", () => {
  it("should allow origin with wildcard configuration", () => {
    const config: CorsConfiguration = {
      origin: "*",
    };

    const result = testOrigin("https://example.com", config);

    expect(result.allowed).toBe(true);
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("should allow origin with boolean true configuration", () => {
    const config: CorsConfiguration = {
      origin: true,
    };

    const result = testOrigin("https://example.com", config);

    expect(result.allowed).toBe(true);
    expect(result.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("should allow matching single origin", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
    };

    const result = testOrigin("https://example.com", config);

    expect(result.allowed).toBe(true);
    expect(result.headers["Access-Control-Allow-Origin"]).toBe(
      "https://example.com"
    );
  });

  it("should block non-matching single origin", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
    };

    const result = testOrigin("https://different.com", config);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not match");
  });

  it("should allow origin in array of origins", () => {
    const config: CorsConfiguration = {
      origin: ["https://example.com", "https://app.example.com"],
    };

    const result = testOrigin("https://app.example.com", config);

    expect(result.allowed).toBe(true);
    expect(result.headers["Access-Control-Allow-Origin"]).toBe(
      "https://app.example.com"
    );
  });

  it("should block origin not in array", () => {
    const config: CorsConfiguration = {
      origin: ["https://example.com", "https://app.example.com"],
    };

    const result = testOrigin("https://different.com", config);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in the list");
  });

  it("should add credentials header when configured", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      credentials: true,
    };

    const result = testOrigin("https://example.com", config);

    expect(result.allowed).toBe(true);
    expect(result.headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("should block wildcard with credentials", () => {
    const config: CorsConfiguration = {
      origin: "*",
      credentials: true,
    };

    const result = testOrigin("https://example.com", config);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Cannot use wildcard origin");
  });

  it("should include methods header when configured", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST", "PUT"],
    };

    const result = testOrigin("https://example.com", config);

    expect(result.headers["Access-Control-Allow-Methods"]).toBe(
      "GET, POST, PUT"
    );
  });

  it("should include allowed headers when configured", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      allowedHeaders: ["Content-Type", "Authorization"],
    };

    const result = testOrigin("https://example.com", config);

    expect(result.headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization"
    );
  });

  it("should include exposed headers when configured", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      exposedHeaders: ["X-Total-Count", "X-Page-Number"],
    };

    const result = testOrigin("https://example.com", config);

    expect(result.headers["Access-Control-Expose-Headers"]).toBe(
      "X-Total-Count, X-Page-Number"
    );
  });

  it("should include max age when configured", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      maxAge: 3600,
    };

    const result = testOrigin("https://example.com", config);

    expect(result.headers["Access-Control-Max-Age"]).toBe("3600");
  });

  it("should detect preflight requirement for non-simple methods", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST", "PUT", "DELETE"],
    };

    const result = testOrigin("https://example.com", config);

    expect(result.preflight.required).toBe(true);
  });

  it("should detect preflight requirement for custom headers", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      allowedHeaders: ["X-Custom-Header"],
    };

    const result = testOrigin("https://example.com", config);

    expect(result.preflight.required).toBe(true);
  });

  it("should mark preflight as allowed when properly configured", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST", "PUT"],
      allowedHeaders: ["Content-Type"],
    };

    const result = testOrigin("https://example.com", config);

    expect(result.preflight.required).toBe(true);
    expect(result.preflight.allowed).toBe(true);
  });

  it("should normalize origins for comparison", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
    };

    const result = testOrigin("HTTPS://EXAMPLE.COM/", config);

    expect(result.allowed).toBe(true);
  });

  it("should handle false origin configuration", () => {
    const config: CorsConfiguration = {
      origin: false,
    };

    const result = testOrigin("https://example.com", config);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not configured");
  });
});
