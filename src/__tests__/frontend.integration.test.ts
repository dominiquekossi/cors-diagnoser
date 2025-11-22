import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  listenCorsErrors,
  stopListening,
  getCorsErrors,
  clearCorsErrors,
} from "../frontend/browserListener.js";

/**
 * Integration tests for frontend CORS diagnoser
 * Tests the complete flow in a simulated browser environment
 */
describe("Frontend Integration Tests", () => {
  let consoleGroupSpy: jest.SpiedFunction<typeof console.group>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleGroupEndSpy: jest.SpiedFunction<typeof console.groupEnd>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let originalWindow: any;
  let mockWindow: any;

  beforeEach(() => {
    // Clear error history from previous tests
    clearCorsErrors();

    // Save original window
    originalWindow = global.window;

    // Create a minimal window mock with event handling
    const eventListeners: Map<string, Function[]> = new Map();

    mockWindow = {
      location: {
        origin: "https://example.com",
      },
      addEventListener: jest.fn((type: string, listener: Function) => {
        if (!eventListeners.has(type)) {
          eventListeners.set(type, []);
        }
        eventListeners.get(type)!.push(listener);
      }),
      removeEventListener: jest.fn((type: string, listener: Function) => {
        if (eventListeners.has(type)) {
          const listeners = eventListeners.get(type)!;
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      }),
      ErrorEvent: class ErrorEvent extends Event {
        message: string;
        error: Error;
        constructor(type: string, options: any = {}) {
          super(type);
          this.message = options.message || "";
          this.error = options.error || new Error();
        }
      },
      dispatchEvent: jest.fn((event: any) => {
        // Simulate event dispatch by calling registered listeners
        const listeners = eventListeners.get(event.type) || [];
        listeners.forEach((listener) => listener(event));
        return true;
      }),
    };

    // Set up global window
    global.window = mockWindow as any;

    // Spy on console methods
    consoleGroupSpy = jest.spyOn(console, "group").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleGroupEndSpy = jest
      .spyOn(console, "groupEnd")
      .mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    stopListening();
    consoleGroupSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    global.window = originalWindow;
  });

  describe("CORS error detection and capture", () => {
    it("should capture CORS errors with 'CORS' keyword", () => {
      listenCorsErrors();

      // Simulate a CORS error
      const errorEvent = new mockWindow.ErrorEvent("error", {
        message:
          "Access to fetch at 'https://api.example.com' from origin 'https://example.com' has been blocked by CORS policy",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("CORS");
      expect(errors[0].timestamp).toBeInstanceOf(Date);
    });

    it("should capture errors with 'cross-origin' keyword", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message:
          "Cross-origin request blocked: The Same Origin Policy disallows reading",
        error: new Error("Cross-origin error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Cross-origin");
    });

    it("should capture errors with 'blocked' keyword", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "Request has been blocked by the browser",
        error: new Error("Blocked error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("blocked");
    });

    it("should ignore non-CORS errors", () => {
      listenCorsErrors();

      // Simulate a non-CORS error
      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "TypeError: Cannot read property 'foo' of undefined",
        error: new Error("Regular JavaScript error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(0);
    });

    it("should capture multiple CORS errors", () => {
      listenCorsErrors();

      // Simulate multiple CORS errors
      const error1 = new mockWindow.ErrorEvent("error", {
        message: "CORS policy: No 'Access-Control-Allow-Origin' header",
        error: new Error("CORS error 1"),
      });

      const error2 = new mockWindow.ErrorEvent("error", {
        message: "CORS preflight request failed",
        error: new Error("CORS error 2"),
      });

      const error3 = new mockWindow.ErrorEvent("error", {
        message: "Cross-origin request blocked by policy",
        error: new Error("CORS error 3"),
      });

      mockWindow.dispatchEvent(error1);
      mockWindow.dispatchEvent(error2);
      mockWindow.dispatchEvent(error3);

      const errors = getCorsErrors();
      expect(errors.length).toBe(3);
    });
  });

  describe("Console message formatting", () => {
    it("should format console messages with proper structure", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS policy: No 'Access-Control-Allow-Origin' header",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      // Verify console.group was called
      expect(consoleGroupSpy).toHaveBeenCalled();
      const groupCall = consoleGroupSpy.mock.calls[0];
      expect(groupCall[0]).toContain("CORS-DIAGNOSER");
      expect(groupCall[0]).toContain("CORS Error Detected");

      // Verify console.log was called with error details
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(" "));
      const allLogs = logCalls.join(" ");

      expect(allLogs).toContain("Error Message:");
      expect(allLogs).toContain("Timestamp:");

      // Verify console.groupEnd was called
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it("should display possible causes in console", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message:
          "CORS policy: No 'Access-Control-Allow-Origin' header is present",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].possibleCauses.length).toBeGreaterThan(0);

      // Verify console displayed causes
      const groupCalls = consoleGroupSpy.mock.calls.map((call) =>
        call.join(" ")
      );
      const allGroups = groupCalls.join(" ");
      expect(allGroups).toContain("Possible Causes:");
    });

    it("should display recommendations in console", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS preflight request failed",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].recommendations.length).toBeGreaterThan(0);

      // Verify console displayed recommendations
      const groupCalls = consoleGroupSpy.mock.calls.map((call) =>
        call.join(" ")
      );
      const allGroups = groupCalls.join(" ");
      expect(allGroups).toContain("Recommendations:");
    });

    it("should use color formatting in console output", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS error occurred",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      // Verify color codes are used
      const groupCall = consoleGroupSpy.mock.calls[0];
      expect(groupCall[1]).toContain("color:");
      expect(groupCall[1]).toContain("font-weight:");
    });
  });

  describe("Error analysis and categorization", () => {
    it("should identify missing Access-Control-Allow-Origin errors", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message:
          "CORS policy: No 'Access-Control-Allow-Origin' header is present",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors[0].possibleCauses.some((cause) =>
          cause.includes("Access-Control-Allow-Origin")
        )
      ).toBe(true);
      expect(
        errors[0].recommendations.some((rec) => rec.includes("CORS middleware"))
      ).toBe(true);
    });

    it("should identify preflight failure errors", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS preflight request did not succeed",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(
        errors[0].possibleCauses.some((cause) =>
          cause.toLowerCase().includes("preflight")
        )
      ).toBe(true);
      expect(
        errors[0].recommendations.some((rec) => rec.includes("OPTIONS"))
      ).toBe(true);
    });

    it("should identify credentials-related errors", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS request with credentials requires specific origin",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(
        errors[0].possibleCauses.some((cause) =>
          cause.toLowerCase().includes("credential")
        )
      ).toBe(true);
      expect(
        errors[0].recommendations.some((rec) =>
          rec.includes("Access-Control-Allow-Credentials")
        )
      ).toBe(true);
    });

    it("should identify custom header errors", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "Request header field X-Custom-Header is not allowed by CORS",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(
        errors[0].possibleCauses.some((cause) =>
          cause.toLowerCase().includes("header")
        )
      ).toBe(true);
      expect(
        errors[0].recommendations.some((rec) =>
          rec.includes("Access-Control-Allow-Headers")
        )
      ).toBe(true);
    });

    it("should identify method not allowed errors", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "Method DELETE is not allowed by CORS policy",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(
        errors[0].possibleCauses.some((cause) =>
          cause.toLowerCase().includes("method")
        )
      ).toBe(true);
      expect(
        errors[0].recommendations.some((rec) =>
          rec.includes("Access-Control-Allow-Methods")
        )
      ).toBe(true);
    });

    it("should provide generic recommendations for unrecognized CORS errors", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "Some generic CORS error message",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors[0].possibleCauses.length).toBeGreaterThan(0);
      expect(errors[0].recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("Listener lifecycle and options", () => {
    it("should start and stop listening correctly", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS error before stop",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);
      expect(getCorsErrors().length).toBe(1);

      stopListening();

      const errorEvent2 = new mockWindow.ErrorEvent("error", {
        message: "CORS error after stop",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent2);
      expect(getCorsErrors().length).toBe(1); // Should still be 1
    });

    it("should handle verbose mode", () => {
      listenCorsErrors({ verbose: true });

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS error in verbose mode",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      // Verify verbose output includes tip
      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(" "));
      const allLogs = logCalls.join(" ");
      expect(allLogs).toContain("Tip:");
    });

    it("should call custom handler when provided", () => {
      const customHandler = jest.fn();

      listenCorsErrors({ customHandler });

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS error with custom handler",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      expect(customHandler).toHaveBeenCalledTimes(1);
      expect(customHandler.mock.calls[0][0]).toMatchObject({
        message: expect.stringContaining("CORS"),
        possibleCauses: expect.any(Array),
        recommendations: expect.any(Array),
        timestamp: expect.any(Date),
      });
    });

    it("should handle errors in custom handler gracefully", () => {
      const customHandler = jest.fn(() => {
        throw new Error("Custom handler error");
      });

      listenCorsErrors({ customHandler });

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS error",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      // Should not crash and should log error
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(getCorsErrors().length).toBe(1);
    });

    it("should prevent multiple listeners", () => {
      listenCorsErrors();
      listenCorsErrors(); // Try to start again

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("already active")
      );
    });
  });

  describe("Error history management", () => {
    it("should store all captured errors in history", () => {
      listenCorsErrors();

      for (let i = 0; i < 5; i++) {
        const errorEvent = new mockWindow.ErrorEvent("error", {
          message: `CORS error ${i}`,
          error: new Error(`CORS error ${i}`),
        });
        mockWindow.dispatchEvent(errorEvent);
      }

      const errors = getCorsErrors();
      expect(errors.length).toBe(5);
    });

    it("should return a copy of error history", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS error",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors1 = getCorsErrors();
      const errors2 = getCorsErrors();

      expect(errors1).not.toBe(errors2); // Different array instances
      expect(errors1).toEqual(errors2); // But same content
    });

    it("should include timestamp for each error", () => {
      listenCorsErrors();

      const before = new Date();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message: "CORS error",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const after = new Date();

      const errors = getCorsErrors();
      expect(errors[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(errors[0].timestamp.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });
  });

  describe("Real-world CORS error scenarios", () => {
    it("should handle typical fetch API CORS error", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message:
          "Access to fetch at 'https://api.example.com/data' from origin 'https://example.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].possibleCauses.length).toBeGreaterThan(0);
      expect(errors[0].recommendations.length).toBeGreaterThan(0);
    });

    it("should handle preflight failure scenario", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message:
          "Access to XMLHttpRequest at 'https://api.example.com/users' from origin 'https://app.example.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("preflight");
    });

    it("should handle credentials mode error scenario", () => {
      listenCorsErrors();

      const errorEvent = new mockWindow.ErrorEvent("error", {
        message:
          "Access to fetch at 'https://api.example.com/auth' from origin 'https://example.com' has been blocked by CORS policy: The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'.",
        error: new Error("CORS error"),
      });

      mockWindow.dispatchEvent(errorEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(
        errors[0].possibleCauses.some((cause) =>
          cause.toLowerCase().includes("wildcard")
        )
      ).toBe(true);
    });
  });
});
