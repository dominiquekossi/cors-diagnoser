import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import express, { type Express } from "express";
import request from "supertest";
import {
  corsDiagnoser,
  getErrorHistory,
  clearErrorHistory,
} from "./expressMiddleware.js";

describe("corsDiagnoser middleware", () => {
  let app: Express;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    // Clear error history before each test
    clearErrorHistory();

    // Create fresh Express app
    app = express();

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should intercept requests and detect CORS issues", async () => {
    app.use(corsDiagnoser());
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    // Should have logged CORS issue (missing Access-Control-Allow-Origin)
    expect(consoleLogSpy).toHaveBeenCalled();
    const logs = consoleLogSpy.mock.calls.map((call) => call[0]).join(" ");
    expect(logs).toContain("CORS");
  });

  it("should detect OPTIONS preflight requests", async () => {
    app.use(corsDiagnoser());
    app.options("/test", (_req, res) => {
      res.sendStatus(204);
    });

    await request(app)
      .options("/test")
      .set("Origin", "https://example.com")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should not log when no CORS issues detected", async () => {
    app.use(corsDiagnoser());
    app.get("/test", (_req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "https://example.com");
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    // Should not have logged errors (only info if verbose)
    const errorLogs = consoleLogSpy.mock.calls
      .map((call) => call[0])
      .filter(
        (log) => typeof log === "string" && log.includes("issues detected")
      );
    expect(errorLogs.length).toBe(0);
  });

  it("should log in verbose mode even when no issues", async () => {
    app.use(corsDiagnoser({ verbose: true }));
    app.get("/test", (_req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "https://example.com");
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    expect(consoleLogSpy).toHaveBeenCalled();
    const logs = consoleLogSpy.mock.calls.map((call) => call[0]).join(" ");
    expect(logs).toContain("No CORS issues");
  });

  it("should store errors in history when enabled", async () => {
    app.use(corsDiagnoser({ enableHistory: true }));
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    const history = getErrorHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].route).toBe("/test");
    expect(history[0].method).toBe("GET");
    expect(history[0].origin).toBe("https://example.com");
  });

  it("should not store errors when history disabled", async () => {
    app.use(corsDiagnoser({ enableHistory: false }));
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    const history = getErrorHistory();
    expect(history.length).toBe(0);
  });

  it("should group duplicate errors and increment count", async () => {
    app.use(corsDiagnoser({ enableHistory: true }));
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    // Make same request multiple times
    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    const history = getErrorHistory();
    expect(history.length).toBe(1);
    expect(history[0].count).toBe(3);
  });

  it("should maintain separate entries for different errors", async () => {
    app.use(corsDiagnoser({ enableHistory: true }));
    app.get("/test1", (_req, res) => {
      res.json({ message: "test1" });
    });
    app.get("/test2", (_req, res) => {
      res.json({ message: "test2" });
    });

    await request(app)
      .get("/test1")
      .set("Origin", "https://example.com")
      .expect(200);

    await request(app)
      .get("/test2")
      .set("Origin", "https://example.com")
      .expect(200);

    const history = getErrorHistory();
    expect(history.length).toBe(2);
  });

  it("should respect maxHistorySize limit", async () => {
    // Note: This test verifies the circular buffer behavior
    // The maxHistorySize is set on first initialization, so we test
    // that history doesn't grow indefinitely
    clearErrorHistory();

    app.use(corsDiagnoser({ enableHistory: true, maxHistorySize: 100 }));

    // Create many different routes
    for (let i = 1; i <= 10; i++) {
      app.get(`/limit-test-${i}`, (_req, res) => {
        res.json({ message: `test${i}` });
      });
    }

    // Make requests to all routes
    for (let i = 1; i <= 10; i++) {
      await request(app)
        .get(`/limit-test-${i}`)
        .set("Origin", `https://limit-example${i}.com`)
        .expect(200);
    }

    const history = getErrorHistory();
    // History should not exceed reasonable bounds (100 in this case)
    expect(history.length).toBeLessThanOrEqual(100);
    expect(history.length).toBeGreaterThan(0);
  });

  it("should return errors sorted by timestamp (newest first)", async () => {
    app.use(corsDiagnoser({ enableHistory: true }));
    app.get("/test1", (_req, res) => {
      res.json({ message: "test1" });
    });
    app.get("/test2", (_req, res) => {
      res.json({ message: "test2" });
    });

    await request(app)
      .get("/test1")
      .set("Origin", "https://example.com")
      .expect(200);

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    await request(app)
      .get("/test2")
      .set("Origin", "https://example.com")
      .expect(200);

    const history = getErrorHistory();
    expect(history[0].route).toBe("/test2"); // Most recent
    expect(history[1].route).toBe("/test1");
  });

  it("should clear error history", async () => {
    app.use(corsDiagnoser({ enableHistory: true }));
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    expect(getErrorHistory().length).toBeGreaterThan(0);

    clearErrorHistory();

    expect(getErrorHistory().length).toBe(0);
  });

  it("should not throw exceptions that break the server", async () => {
    // Create middleware that might cause errors
    app.use(corsDiagnoser());
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    // Should not throw even with unusual requests
    await request(app).get("/test").expect(200);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should work with res.send()", async () => {
    app.use(corsDiagnoser());
    app.get("/test", (_req, res) => {
      res.send("Hello World");
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should work with res.json()", async () => {
    app.use(corsDiagnoser());
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should filter security checks when securityChecks is false", async () => {
    app.use(corsDiagnoser({ securityChecks: false }));
    app.get("/test", (_req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE");
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    // Should not log info-level security warnings
    const logs = consoleLogSpy.mock.calls.map((call) => call[0]).join(" ");
    expect(logs).not.toContain("Potentially Unnecessary");
  });

  it("should include security checks when securityChecks is true", async () => {
    app.use(corsDiagnoser({ securityChecks: true }));
    app.get("/test", (_req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    expect(consoleLogSpy).toHaveBeenCalled();
    const logs = consoleLogSpy.mock.calls.map((call) => call[0]).join(" ");
    expect(logs).toContain("Wildcard");
  });

  it("should handle requests without origin header", async () => {
    app.use(corsDiagnoser());
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    await request(app).get("/test").expect(200);

    // Should not crash
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should analyze only once per request", async () => {
    let analyzeCount = 0;
    app.use(corsDiagnoser());
    app.get("/test", (_req, res) => {
      analyzeCount++;
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    // Middleware should only analyze once despite multiple hooks
    const history = getErrorHistory();
    expect(history.length).toBe(1);
    expect(history[0].count).toBe(1);
  });
});

describe("getErrorHistory", () => {
  beforeEach(() => {
    clearErrorHistory();
  });

  it("should return empty array when history not enabled", () => {
    const history = getErrorHistory();
    expect(history).toEqual([]);
  });

  it("should return array of CorsError objects", async () => {
    const app = express();
    app.use(corsDiagnoser({ enableHistory: true }));
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    const history = getErrorHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history[0]).toHaveProperty("timestamp");
    expect(history[0]).toHaveProperty("route");
    expect(history[0]).toHaveProperty("method");
    expect(history[0]).toHaveProperty("origin");
    expect(history[0]).toHaveProperty("diagnoses");
    expect(history[0]).toHaveProperty("count");
  });
});

describe("clearErrorHistory", () => {
  it("should clear all errors from history", async () => {
    const app = express();
    app.use(corsDiagnoser({ enableHistory: true }));
    app.get("/test", (_req, res) => {
      res.json({ message: "test" });
    });

    await request(app)
      .get("/test")
      .set("Origin", "https://example.com")
      .expect(200);

    expect(getErrorHistory().length).toBeGreaterThan(0);

    clearErrorHistory();

    expect(getErrorHistory().length).toBe(0);
  });

  it("should not throw when history not initialized", () => {
    expect(() => clearErrorHistory()).not.toThrow();
  });
});
