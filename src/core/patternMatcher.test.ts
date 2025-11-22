import { describe, it, expect } from "@jest/globals";
import { detectPattern, COMMON_PATTERNS } from "./patternMatcher.js";
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

describe("COMMON_PATTERNS", () => {
  it("should have at least 10 patterns defined", () => {
    expect(COMMON_PATTERNS.length).toBeGreaterThanOrEqual(10);
  });

  it("should have all required properties for each pattern", () => {
    COMMON_PATTERNS.forEach((pattern) => {
      expect(pattern).toHaveProperty("id");
      expect(pattern).toHaveProperty("name");
      expect(pattern).toHaveProperty("detector");
      expect(pattern).toHaveProperty("explanation");
      expect(pattern).toHaveProperty("solution");
      expect(pattern).toHaveProperty("codeExample");
      expect(typeof pattern.detector).toBe("function");
    });
  });

  it("should have unique pattern IDs", () => {
    const ids = COMMON_PATTERNS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("detectPattern", () => {
  it("should return null when no pattern matches", () => {
    const req = createMockRequest({
      headers: { origin: "https://example.com" },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    const result = detectPattern(req, res);
    expect(result).toBeNull();
  });

  it("should return the first matching pattern", () => {
    const req = createMockRequest({
      headers: { origin: "https://example.com" },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
    });

    const result = detectPattern(req, res);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("wildcard-credentials-conflict");
  });
});

describe("Pattern: wildcard-credentials-conflict", () => {
  const pattern = COMMON_PATTERNS.find(
    (p) => p.id === "wildcard-credentials-conflict"
  )!;

  it("should detect wildcard origin with credentials", () => {
    const req = createMockRequest({});
    const res = createMockResponse({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
    });

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when credentials is false", () => {
    const req = createMockRequest({});
    const res = createMockResponse({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "false",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect when origin is specific", () => {
    const req = createMockRequest({});
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
      "access-control-allow-credentials": "true",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: multiple-origins-misconfiguration", () => {
  const pattern = COMMON_PATTERNS.find(
    (p) => p.id === "multiple-origins-misconfiguration"
  )!;

  it("should detect comma-separated origins", () => {
    const req = createMockRequest({});
    const res = createMockResponse({
      "access-control-allow-origin":
        "https://example.com, https://app.example.com",
    });

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect single origin", () => {
    const req = createMockRequest({});
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect wildcard", () => {
    const req = createMockRequest({});
    const res = createMockResponse({
      "access-control-allow-origin": "*",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: preflight-only-failure", () => {
  const pattern = COMMON_PATTERNS.find(
    (p) => p.id === "preflight-only-failure"
  )!;

  it("should detect preflight missing allow-origin", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
      },
    });
    const res = createMockResponse({
      "access-control-allow-methods": "GET, POST",
    });

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should detect preflight missing allow-methods", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when both headers present", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
      "access-control-allow-methods": "GET, POST",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect for non-OPTIONS requests", () => {
    const req = createMockRequest({
      method: "GET",
    });
    const res = createMockResponse({});

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: custom-headers-not-allowed", () => {
  const pattern = COMMON_PATTERNS.find(
    (p) => p.id === "custom-headers-not-allowed"
  )!;

  it("should detect when custom headers requested but not allowed", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
        "access-control-request-headers": "x-custom-header",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when headers are allowed", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
        "access-control-request-headers": "x-custom-header",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
      "access-control-allow-headers": "x-custom-header",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect for non-preflight requests", () => {
    const req = createMockRequest({
      method: "GET",
    });
    const res = createMockResponse({});

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: missing-allow-origin", () => {
  const pattern = COMMON_PATTERNS.find((p) => p.id === "missing-allow-origin")!;

  it("should detect when origin present but allow-origin missing", () => {
    const req = createMockRequest({
      headers: {
        origin: "https://example.com",
      },
    });
    const res = createMockResponse({});

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when allow-origin is present", () => {
    const req = createMockRequest({
      headers: {
        origin: "https://example.com",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect when no origin in request", () => {
    const req = createMockRequest({});
    const res = createMockResponse({});

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: missing-allow-headers", () => {
  const pattern = COMMON_PATTERNS.find(
    (p) => p.id === "missing-allow-headers"
  )!;

  it("should detect when headers requested but not allowed", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    const res = createMockResponse({});

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when headers are allowed", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    const res = createMockResponse({
      "access-control-allow-headers": "content-type",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: missing-allow-methods", () => {
  const pattern = COMMON_PATTERNS.find(
    (p) => p.id === "missing-allow-methods"
  )!;

  it("should detect preflight without allow-methods", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
      },
    });
    const res = createMockResponse({});

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when allow-methods is present", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
      },
    });
    const res = createMockResponse({
      "access-control-allow-methods": "GET, POST",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: credentials-mismatch", () => {
  const pattern = COMMON_PATTERNS.find((p) => p.id === "credentials-mismatch")!;

  it("should detect when cookies sent but credentials not allowed", () => {
    const req = createMockRequest({
      headers: {
        cookie: "session=abc123",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when credentials are allowed", () => {
    const req = createMockRequest({
      headers: {
        cookie: "session=abc123",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
      "access-control-allow-credentials": "true",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect when no cookies sent", () => {
    const req = createMockRequest({});
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: origin-null-blocked", () => {
  const pattern = COMMON_PATTERNS.find((p) => p.id === "origin-null-blocked")!;

  it("should detect when origin is null but not allowed", () => {
    const req = createMockRequest({
      headers: {
        origin: "null",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "https://example.com",
    });

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when null origin is explicitly allowed", () => {
    const req = createMockRequest({
      headers: {
        origin: "null",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "null",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect when wildcard is used", () => {
    const req = createMockRequest({
      headers: {
        origin: "null",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "*",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });
});

describe("Pattern: port-mismatch", () => {
  const pattern = COMMON_PATTERNS.find((p) => p.id === "port-mismatch")!;

  it("should detect same hostname different port", () => {
    const req = createMockRequest({
      headers: {
        origin: "http://localhost:3000",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "http://localhost:5000",
    });

    expect(pattern.detector(req, res)).toBe(true);
  });

  it("should not detect when ports match", () => {
    const req = createMockRequest({
      headers: {
        origin: "http://localhost:3000",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "http://localhost:3000",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect when wildcard is used", () => {
    const req = createMockRequest({
      headers: {
        origin: "http://localhost:3000",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "*",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });

  it("should not detect different hostnames", () => {
    const req = createMockRequest({
      headers: {
        origin: "http://example.com:3000",
      },
    });
    const res = createMockResponse({
      "access-control-allow-origin": "http://different.com:3000",
    });

    expect(pattern.detector(req, res)).toBe(false);
  });
});
