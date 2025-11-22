import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import express, { type Express } from "express";
import request from "supertest";
import {
  corsDiagnoser,
  getErrorHistory,
  clearErrorHistory,
} from "../backend/expressMiddleware.js";

/**
 * Integration tests for backend CORS diagnoser
 * Tests the complete flow with a real Express server
 */
describe("Backend Integration Tests", () => {
  let app: Express;
  let server: any;

  beforeEach(() => {
    clearErrorHistory();
    app = express();
  });

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe("Real Express server with cors-diagnoser middleware", () => {
    it("should detect missing CORS headers from different origins", async () => {
      // Set up server without CORS headers
      app.use(corsDiagnoser({ enableHistory: true }));
      app.get("/api/users", (_req, res) => {
        res.json({ users: ["Alice", "Bob"] });
      });

      // Test from origin 1
      await request(app)
        .get("/api/users")
        .set("Origin", "https://example.com")
        .expect(200);

      // Test from origin 2
      await request(app)
        .get("/api/users")
        .set("Origin", "https://another-site.com")
        .expect(200);

      // Verify history captured both errors
      const history = getErrorHistory();
      expect(history.length).toBe(2);
      expect(history[0].origin).toBe("https://another-site.com");
      expect(history[1].origin).toBe("https://example.com");
    });

    it("should validate logs are generated correctly for CORS errors", async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        logs.push(args.join(" "));
      };

      app.use(corsDiagnoser());
      app.get("/api/data", (_req, res) => {
        res.json({ data: "test" });
      });

      await request(app)
        .get("/api/data")
        .set("Origin", "https://test.com")
        .expect(200);

      console.log = originalLog;

      // Verify log structure
      const logText = logs.join("\n");
      expect(logText).toContain("CORS");
      expect(logText).toContain("Missing Access-Control-Allow-Origin");
      expect(logText).toContain("Recommendation:");
      expect(logText).toContain("Code Example:");
    });

    it("should populate error history with correct details", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.post("/api/submit", (_req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .post("/api/submit")
        .set("Origin", "https://frontend.com")
        .send({ data: "test" })
        .expect(200);

      const history = getErrorHistory();
      expect(history.length).toBe(1);
      expect(history[0]).toMatchObject({
        route: "/api/submit",
        method: "POST",
        origin: "https://frontend.com",
        count: 1,
      });
      expect(history[0].diagnoses.length).toBeGreaterThan(0);
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });

    it("should work correctly with CORS headers configured", async () => {
      app.use(corsDiagnoser({ enableHistory: true, verbose: true }));
      app.get("/api/public", (_req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "https://allowed.com");
        res.json({ public: true });
      });

      await request(app)
        .get("/api/public")
        .set("Origin", "https://allowed.com")
        .expect(200);

      const history = getErrorHistory();
      // Should not have errors when CORS is properly configured
      expect(history.length).toBe(0);
    });

    it("should work correctly without CORS headers configured", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.get("/api/broken", (_req, res) => {
        res.json({ broken: true });
      });

      await request(app)
        .get("/api/broken")
        .set("Origin", "https://blocked.com")
        .expect(200);

      const history = getErrorHistory();
      expect(history.length).toBe(1);
      expect(history[0].diagnoses[0].issue).toContain(
        "Missing Access-Control-Allow-Origin"
      );
    });
  });

  describe("Multiple origins and preflight requests", () => {
    it("should handle preflight OPTIONS requests correctly", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.options("/api/resource", (_req, res) => {
        res.sendStatus(204);
      });

      await request(app)
        .options("/api/resource")
        .set("Origin", "https://app.com")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type, Authorization")
        .expect(204);

      const history = getErrorHistory();
      expect(history.length).toBe(1);
      expect(history[0].method).toBe("OPTIONS");

      // Should detect missing preflight headers
      const diagnoses = history[0].diagnoses;
      const hasMissingOrigin = diagnoses.some((d) =>
        d.issue.includes("Missing Access-Control-Allow-Origin")
      );
      const hasMissingMethods = diagnoses.some((d) =>
        d.issue.includes("Missing Access-Control-Allow-Methods")
      );
      const hasMissingHeaders = diagnoses.some((d) =>
        d.issue.includes("Missing Access-Control-Allow-Headers")
      );

      expect(hasMissingOrigin || hasMissingMethods || hasMissingHeaders).toBe(
        true
      );
    });

    it("should handle properly configured preflight requests", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.options("/api/resource", (req, res) => {
        res.setHeader(
          "Access-Control-Allow-Origin",
          req.headers.origin as string
        );
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization"
        );
        res.sendStatus(204);
      });

      await request(app)
        .options("/api/resource")
        .set("Origin", "https://app.com")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type, Authorization")
        .expect(204);

      const history = getErrorHistory();
      // Should not have critical errors when properly configured
      const criticalErrors = history.filter((h) =>
        h.diagnoses.some((d) => d.severity === "critical")
      );
      expect(criticalErrors.length).toBe(0);
    });

    it("should detect wildcard with credentials conflict", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.get("/api/secure", (_req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.json({ secure: true });
      });

      await request(app)
        .get("/api/secure")
        .set("Origin", "https://app.com")
        .expect(200);

      const history = getErrorHistory();
      expect(history.length).toBe(1);

      const hasWildcardCredentialsError = history[0].diagnoses.some(
        (d) =>
          d.issue.includes("Wildcard") &&
          d.issue.includes("Credentials") &&
          d.severity === "critical"
      );
      expect(hasWildcardCredentialsError).toBe(true);
    });
  });

  describe("Error history and grouping", () => {
    it("should group identical errors and increment count", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.get("/api/repeat", (_req, res) => {
        res.json({ repeat: true });
      });

      // Make same request 5 times
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get("/api/repeat")
          .set("Origin", "https://same.com")
          .expect(200);
      }

      const history = getErrorHistory();
      expect(history.length).toBe(1);
      expect(history[0].count).toBe(5);
    });

    it("should maintain separate entries for different routes", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.get("/api/route1", (_req, res) => {
        res.json({ route: 1 });
      });
      app.get("/api/route2", (_req, res) => {
        res.json({ route: 2 });
      });
      app.get("/api/route3", (_req, res) => {
        res.json({ route: 3 });
      });

      await request(app)
        .get("/api/route1")
        .set("Origin", "https://test.com")
        .expect(200);
      await request(app)
        .get("/api/route2")
        .set("Origin", "https://test.com")
        .expect(200);
      await request(app)
        .get("/api/route3")
        .set("Origin", "https://test.com")
        .expect(200);

      const history = getErrorHistory();
      expect(history.length).toBe(3);

      const routes = history.map((h) => h.route).sort();
      expect(routes).toEqual(["/api/route1", "/api/route2", "/api/route3"]);
    });

    it("should maintain separate entries for different origins", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.get("/api/multi", (_req, res) => {
        res.json({ multi: true });
      });

      await request(app)
        .get("/api/multi")
        .set("Origin", "https://origin1.com")
        .expect(200);
      await request(app)
        .get("/api/multi")
        .set("Origin", "https://origin2.com")
        .expect(200);
      await request(app)
        .get("/api/multi")
        .set("Origin", "https://origin3.com")
        .expect(200);

      const history = getErrorHistory();
      expect(history.length).toBe(3);

      const origins = history.map((h) => h.origin).sort();
      expect(origins).toEqual([
        "https://origin1.com",
        "https://origin2.com",
        "https://origin3.com",
      ]);
    });
  });

  describe("Security checks integration", () => {
    it("should detect security issues with wildcard origin", async () => {
      app.use(corsDiagnoser({ enableHistory: true, securityChecks: true }));
      app.get("/api/wildcard", (_req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json({ wildcard: true });
      });

      await request(app)
        .get("/api/wildcard")
        .set("Origin", "https://test.com")
        .expect(200);

      const history = getErrorHistory();
      expect(history.length).toBe(1);

      const hasSecurityWarning = history[0].diagnoses.some(
        (d) => d.severity === "info" || d.severity === "warning"
      );
      expect(hasSecurityWarning).toBe(true);
    });

    it("should skip security checks when disabled", async () => {
      app.use(corsDiagnoser({ enableHistory: true, securityChecks: false }));
      app.get("/api/wildcard", (_req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json({ wildcard: true });
      });

      await request(app)
        .get("/api/wildcard")
        .set("Origin", "https://test.com")
        .expect(200);

      const history = getErrorHistory();
      // Should not have info-level security warnings
      const hasInfoWarnings = history.some((h) =>
        h.diagnoses.some((d) => d.severity === "info")
      );
      expect(hasInfoWarnings).toBe(false);
    });
  });

  describe("Complex scenarios", () => {
    it("should handle mixed success and failure requests", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));

      app.get("/api/good", (req, res) => {
        res.setHeader(
          "Access-Control-Allow-Origin",
          req.headers.origin as string
        );
        res.json({ status: "good" });
      });

      app.get("/api/bad", (_req, res) => {
        res.json({ status: "bad" });
      });

      // Good request
      await request(app)
        .get("/api/good")
        .set("Origin", "https://allowed.com")
        .expect(200);

      // Bad request
      await request(app)
        .get("/api/bad")
        .set("Origin", "https://blocked.com")
        .expect(200);

      const history = getErrorHistory();
      // Only the bad request should be in history
      expect(history.length).toBe(1);
      expect(history[0].route).toBe("/api/bad");
    });

    it("should handle requests without origin header", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.get("/api/no-origin", (_req, res) => {
        res.json({ noOrigin: true });
      });

      await request(app).get("/api/no-origin").expect(200);

      const history = getErrorHistory();
      // Should not crash or create errors for same-origin requests
      expect(history.length).toBe(0);
    });

    it("should handle custom headers in preflight", async () => {
      app.use(corsDiagnoser({ enableHistory: true }));
      app.options("/api/custom", (_req, res) => {
        res.sendStatus(204);
      });

      await request(app)
        .options("/api/custom")
        .set("Origin", "https://app.com")
        .set("Access-Control-Request-Method", "POST")
        .set(
          "Access-Control-Request-Headers",
          "X-Custom-Header, X-Another-Header"
        )
        .expect(204);

      const history = getErrorHistory();
      expect(history.length).toBe(1);

      const hasCustomHeadersError = history[0].diagnoses.some(
        (d) => d.issue.includes("Custom") || d.issue.includes("Headers")
      );
      expect(hasCustomHeadersError).toBe(true);
    });
  });
});
