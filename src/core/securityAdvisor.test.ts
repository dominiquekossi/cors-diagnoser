import { describe, it, expect } from "@jest/globals";
import { checkSecurity, type CorsConfiguration } from "./securityAdvisor.js";

describe("checkSecurity", () => {
  it("should return empty array for secure configuration", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST"],
      credentials: true,
    };

    const issues = checkSecurity(config, "production");
    expect(issues).toEqual([]);
  });

  it("should detect wildcard origin in production", () => {
    const config: CorsConfiguration = {
      origin: "*",
    };

    const issues = checkSecurity(config, "production");
    expect(issues.length).toBeGreaterThan(0);

    const wildcardIssue = issues.find(
      (i) => i.title === "Wildcard Origin in Production"
    );
    expect(wildcardIssue).toBeDefined();
    expect(wildcardIssue?.level).toBe("warning");
    expect(wildcardIssue?.description).toContain("wildcard");
    expect(wildcardIssue?.recommendation).toContain("exact allowed origins");
  });

  it("should not detect wildcard origin in development", () => {
    const config: CorsConfiguration = {
      origin: "*",
    };

    const issues = checkSecurity(config, "development");
    const wildcardIssue = issues.find(
      (i) => i.title === "Wildcard Origin in Production"
    );
    expect(wildcardIssue).toBeUndefined();
  });

  it("should detect wildcard origin as boolean true in production", () => {
    const config: CorsConfiguration = {
      origin: true,
    };

    const issues = checkSecurity(config, "production");
    const wildcardIssue = issues.find(
      (i) => i.title === "Wildcard Origin in Production"
    );
    expect(wildcardIssue).toBeDefined();
    expect(wildcardIssue?.level).toBe("warning");
  });

  it("should detect wildcard in array of origins in production", () => {
    const config: CorsConfiguration = {
      origin: ["https://example.com", "*"],
    };

    const issues = checkSecurity(config, "production");
    const wildcardIssue = issues.find(
      (i) => i.title === "Wildcard Origin in Production"
    );
    expect(wildcardIssue).toBeDefined();
  });

  it("should detect credentials with wildcard as critical", () => {
    const config: CorsConfiguration = {
      origin: "*",
      credentials: true,
    };

    const issues = checkSecurity(config);
    const credentialsIssue = issues.find(
      (i) => i.title === "Credentials with Wildcard Origin"
    );
    expect(credentialsIssue).toBeDefined();
    expect(credentialsIssue?.level).toBe("critical");
    expect(credentialsIssue?.description).toContain("forbidden");
    expect(credentialsIssue?.recommendation).toContain(
      "specific allowed origins"
    );
  });

  it("should detect credentials with boolean true origin as critical", () => {
    const config: CorsConfiguration = {
      origin: true,
      credentials: true,
    };

    const issues = checkSecurity(config);
    const credentialsIssue = issues.find(
      (i) => i.title === "Credentials with Wildcard Origin"
    );
    expect(credentialsIssue).toBeDefined();
    expect(credentialsIssue?.level).toBe("critical");
  });

  it("should not detect issue when credentials false with wildcard", () => {
    const config: CorsConfiguration = {
      origin: "*",
      credentials: false,
    };

    const issues = checkSecurity(config, "development");
    const credentialsIssue = issues.find(
      (i) => i.title === "Credentials with Wildcard Origin"
    );
    expect(credentialsIssue).toBeUndefined();
  });

  it("should detect sensitive headers in exposedHeaders", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      exposedHeaders: ["Content-Type", "Authorization", "X-Custom-Header"],
    };

    const issues = checkSecurity(config);
    const sensitiveHeadersIssue = issues.find(
      (i) => i.title === "Sensitive Headers Exposed"
    );
    expect(sensitiveHeadersIssue).toBeDefined();
    expect(sensitiveHeadersIssue?.level).toBe("warning");
    expect(sensitiveHeadersIssue?.description).toContain("Authorization");
    expect(sensitiveHeadersIssue?.recommendation).toContain("remove");
  });

  it("should detect multiple sensitive headers", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      exposedHeaders: ["Authorization", "Cookie", "X-API-Key"],
    };

    const issues = checkSecurity(config);
    const sensitiveHeadersIssue = issues.find(
      (i) => i.title === "Sensitive Headers Exposed"
    );
    expect(sensitiveHeadersIssue).toBeDefined();
    expect(sensitiveHeadersIssue?.description).toContain("Authorization");
    expect(sensitiveHeadersIssue?.description).toContain("Cookie");
    expect(sensitiveHeadersIssue?.description).toContain("X-API-Key");
  });

  it("should handle case-insensitive header names", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      exposedHeaders: ["AUTHORIZATION", "content-type"],
    };

    const issues = checkSecurity(config);
    const sensitiveHeadersIssue = issues.find(
      (i) => i.title === "Sensitive Headers Exposed"
    );
    expect(sensitiveHeadersIssue).toBeDefined();
  });

  it("should not detect issue when no sensitive headers exposed", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      exposedHeaders: ["Content-Type", "X-Custom-Header"],
    };

    const issues = checkSecurity(config);
    const sensitiveHeadersIssue = issues.find(
      (i) => i.title === "Sensitive Headers Exposed"
    );
    expect(sensitiveHeadersIssue).toBeUndefined();
  });

  it("should detect unnecessary dangerous methods", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST", "DELETE", "PUT"],
    };

    const issues = checkSecurity(config);
    const methodsIssue = issues.find(
      (i) => i.title === "Potentially Unnecessary HTTP Methods Allowed"
    );
    expect(methodsIssue).toBeDefined();
    expect(methodsIssue?.level).toBe("info");
    expect(methodsIssue?.description).toContain("DELETE");
    expect(methodsIssue?.description).toContain("PUT");
    expect(methodsIssue?.recommendation).toContain("least privilege");
  });

  it("should detect PATCH and TRACE methods", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "PATCH", "TRACE"],
    };

    const issues = checkSecurity(config);
    const methodsIssue = issues.find(
      (i) => i.title === "Potentially Unnecessary HTTP Methods Allowed"
    );
    expect(methodsIssue).toBeDefined();
    expect(methodsIssue?.description).toContain("PATCH");
    expect(methodsIssue?.description).toContain("TRACE");
  });

  it("should handle case-insensitive method names", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["get", "delete", "put"],
    };

    const issues = checkSecurity(config);
    const methodsIssue = issues.find(
      (i) => i.title === "Potentially Unnecessary HTTP Methods Allowed"
    );
    expect(methodsIssue).toBeDefined();
  });

  it("should not detect issue when only safe methods allowed", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: ["GET", "POST", "HEAD", "OPTIONS"],
    };

    const issues = checkSecurity(config);
    const methodsIssue = issues.find(
      (i) => i.title === "Potentially Unnecessary HTTP Methods Allowed"
    );
    expect(methodsIssue).toBeUndefined();
  });

  it("should sort issues by severity (critical, warning, info)", () => {
    const config: CorsConfiguration = {
      origin: "*",
      credentials: true,
      methods: ["GET", "DELETE"],
      exposedHeaders: ["Authorization"],
    };

    const issues = checkSecurity(config, "production");

    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(issues[0].level).toBe("critical");

    // Find warning and info issues
    const warningIssues = issues.filter((i) => i.level === "warning");
    const infoIssues = issues.filter((i) => i.level === "info");

    expect(warningIssues.length).toBeGreaterThan(0);
    expect(infoIssues.length).toBeGreaterThan(0);

    // Verify order: critical comes before warning, warning before info
    const criticalIndex = issues.findIndex((i) => i.level === "critical");
    const firstWarningIndex = issues.findIndex((i) => i.level === "warning");
    const firstInfoIndex = issues.findIndex((i) => i.level === "info");

    expect(criticalIndex).toBeLessThan(firstWarningIndex);
    expect(firstWarningIndex).toBeLessThan(firstInfoIndex);
  });

  it("should handle configuration with no optional fields", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
    };

    const issues = checkSecurity(config);
    expect(issues).toEqual([]);
  });

  it("should handle empty arrays", () => {
    const config: CorsConfiguration = {
      origin: "https://example.com",
      methods: [],
      exposedHeaders: [],
    };

    const issues = checkSecurity(config);
    expect(issues).toEqual([]);
  });

  it("should use production as default environment", () => {
    const config: CorsConfiguration = {
      origin: "*",
    };

    const issues = checkSecurity(config);
    const wildcardIssue = issues.find(
      (i) => i.title === "Wildcard Origin in Production"
    );
    expect(wildcardIssue).toBeDefined();
  });

  it("should detect multiple issues in one configuration", () => {
    const config: CorsConfiguration = {
      origin: "*",
      credentials: true,
      methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
      exposedHeaders: ["Authorization", "Cookie", "X-API-Key"],
    };

    const issues = checkSecurity(config, "production");

    expect(issues.length).toBe(4);
    expect(issues.some((i) => i.level === "critical")).toBe(true);
    expect(issues.some((i) => i.level === "warning")).toBe(true);
    expect(issues.some((i) => i.level === "info")).toBe(true);
  });
});
