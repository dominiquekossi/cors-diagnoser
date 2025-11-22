import { describe, it, expect, jest } from "@jest/globals";
import {
  normalizeOrigin,
  parseHeaders,
  isPreflightRequest,
  formatLog,
  colorize,
} from "./utils.js";
import type { Request } from "express";

describe("normalizeOrigin", () => {
  it("should convert origin to lowercase", () => {
    expect(normalizeOrigin("HTTPS://EXAMPLE.COM")).toBe("https://example.com");
    expect(normalizeOrigin("HTTP://API.Example.Com")).toBe(
      "http://api.example.com"
    );
  });

  it("should remove trailing slash", () => {
    expect(normalizeOrigin("https://example.com/")).toBe("https://example.com");
    expect(normalizeOrigin("http://localhost:3000/")).toBe(
      "http://localhost:3000"
    );
  });

  it("should handle URLs without trailing slash", () => {
    expect(normalizeOrigin("https://example.com")).toBe("https://example.com");
    expect(normalizeOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
  });

  it("should trim whitespace", () => {
    expect(normalizeOrigin("  https://example.com  ")).toBe(
      "https://example.com"
    );
    expect(normalizeOrigin("\thttps://example.com\n")).toBe(
      "https://example.com"
    );
  });

  it("should handle null and undefined", () => {
    expect(normalizeOrigin(null)).toBe("");
    expect(normalizeOrigin(undefined)).toBe("");
  });

  it("should handle empty string", () => {
    expect(normalizeOrigin("")).toBe("");
    expect(normalizeOrigin("   ")).toBe("");
  });

  it("should handle complex URLs", () => {
    expect(normalizeOrigin("HTTPS://SUB.EXAMPLE.COM:8080/")).toBe(
      "https://sub.example.com:8080"
    );
  });
});

describe("parseHeaders", () => {
  it("should parse headers into case-insensitive map", () => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
      "X-Custom-Header": "value",
    };

    const result = parseHeaders(headers);

    expect(result.get("content-type")).toBe("application/json");
    expect(result.get("authorization")).toBe("Bearer token");
    expect(result.get("x-custom-header")).toBe("value");
  });

  it("should handle different header casing", () => {
    const headers = {
      "CONTENT-TYPE": "text/html",
      authorization: "token",
      "X-Custom-HEADER": "test",
    };

    const result = parseHeaders(headers);

    expect(result.get("content-type")).toBe("text/html");
    expect(result.get("authorization")).toBe("token");
    expect(result.get("x-custom-header")).toBe("test");
  });

  it("should handle array values by taking first element", () => {
    const headers = {
      Accept: ["application/json", "text/html"],
      "X-Custom": ["value1", "value2"],
    };

    const result = parseHeaders(headers);

    expect(result.get("accept")).toBe("application/json");
    expect(result.get("x-custom")).toBe("value1");
  });

  it("should handle undefined headers", () => {
    const result = parseHeaders(undefined);
    expect(result.size).toBe(0);
  });

  it("should skip undefined values", () => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: undefined,
      "X-Custom": "value",
    };

    const result = parseHeaders(headers);

    expect(result.has("content-type")).toBe(true);
    expect(result.has("authorization")).toBe(false);
    expect(result.has("x-custom")).toBe(true);
  });

  it("should handle empty headers object", () => {
    const result = parseHeaders({});
    expect(result.size).toBe(0);
  });
});

describe("isPreflightRequest", () => {
  it("should return true for OPTIONS request with Access-Control-Request-Method", () => {
    const req = {
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
        origin: "https://example.com",
      },
    } as Request;

    expect(isPreflightRequest(req)).toBe(true);
  });

  it("should return true for OPTIONS request with Access-Control-Request-Headers", () => {
    const req = {
      method: "OPTIONS",
      headers: {
        "access-control-request-headers": "content-type",
        origin: "https://example.com",
      },
    } as Request;

    expect(isPreflightRequest(req)).toBe(true);
  });

  it("should return true for OPTIONS request with both CORS headers", () => {
    const req = {
      method: "OPTIONS",
      headers: {
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,authorization",
        origin: "https://example.com",
      },
    } as Request;

    expect(isPreflightRequest(req)).toBe(true);
  });

  it("should return false for OPTIONS request without CORS headers", () => {
    const req = {
      method: "OPTIONS",
      headers: {
        "content-type": "application/json",
      },
    } as Request;

    expect(isPreflightRequest(req)).toBe(false);
  });

  it("should return false for non-OPTIONS requests", () => {
    const req = {
      method: "GET",
      headers: {
        "access-control-request-method": "POST",
      },
    } as Request;

    expect(isPreflightRequest(req)).toBe(false);
  });

  it("should return false for POST request", () => {
    const req = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    } as Request;

    expect(isPreflightRequest(req)).toBe(false);
  });

  it("should handle case-insensitive header names", () => {
    const req = {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "POST",
      },
    } as unknown as Request;

    expect(isPreflightRequest(req)).toBe(true);
  });
});

describe("colorize", () => {
  it("should wrap text with ANSI color codes", () => {
    const result = colorize("test", "red");
    expect(result).toContain("test");
    expect(result).toMatch(/\x1b\[\d+m.*\x1b\[0m/);
  });

  it("should apply different colors", () => {
    const red = colorize("error", "red");
    const yellow = colorize("warning", "yellow");
    const cyan = colorize("info", "cyan");

    expect(red).toContain("\x1b[31m");
    expect(yellow).toContain("\x1b[33m");
    expect(cyan).toContain("\x1b[36m");
  });

  it("should reset color at the end", () => {
    const result = colorize("test", "green");
    expect(result).toContain("\x1b[0m");
    expect(result.endsWith("\x1b[0m")).toBe(true);
  });
});

describe("formatLog", () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should log info level messages", () => {
    formatLog("info", "Test message");

    expect(consoleLogSpy).toHaveBeenCalled();
    const logCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(logCall).toContain("[CORS-DIAGNOSER]");
    expect(logCall).toContain("INFO");
    expect(logCall).toContain("Test message");
  });

  it("should log warn level messages", () => {
    formatLog("warn", "Warning message");

    expect(consoleLogSpy).toHaveBeenCalled();
    const logCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(logCall).toContain("[CORS-DIAGNOSER]");
    expect(logCall).toContain("WARN");
    expect(logCall).toContain("Warning message");
  });

  it("should log error level messages", () => {
    formatLog("error", "Error message");

    expect(consoleLogSpy).toHaveBeenCalled();
    const logCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(logCall).toContain("[CORS-DIAGNOSER]");
    expect(logCall).toContain("ERROR");
    expect(logCall).toContain("Error message");
  });

  it("should include timestamp in ISO format", () => {
    formatLog("info", "Test");

    const logCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(logCall).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("should log additional data when provided", () => {
    const data = { key: "value", number: 42 };
    formatLog("info", "Test", data);

    expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    expect(consoleLogSpy.mock.calls[1][0]).toContain("Data:");
    expect(consoleLogSpy.mock.calls[2][0]).toEqual(data);
  });

  it("should not log data section when data is undefined", () => {
    formatLog("info", "Test");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it("should apply color coding based on level", () => {
    formatLog("error", "Error");
    const errorLog = consoleLogSpy.mock.calls[0][0] as string;
    expect(errorLog).toContain("\x1b[31m"); // Red color

    consoleLogSpy.mockClear();

    formatLog("warn", "Warning");
    const warnLog = consoleLogSpy.mock.calls[0][0] as string;
    expect(warnLog).toContain("\x1b[33m"); // Yellow color

    consoleLogSpy.mockClear();

    formatLog("info", "Info");
    const infoLog = consoleLogSpy.mock.calls[0][0] as string;
    expect(infoLog).toContain("\x1b[36m"); // Cyan color
  });
});
