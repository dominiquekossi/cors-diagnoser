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
} from "./browserListener.js";

// Mock ErrorEvent class
class MockErrorEvent extends Event {
  message: string;
  error?: Error;

  constructor(type: string, options: { message: string; error?: Error }) {
    super(type);
    this.message = options.message;
    this.error = options.error;
  }
}

describe("browserListener", () => {
  let mockWindow: any;
  let eventListeners: Map<string, Function[]>;
  let consoleGroupSpy: jest.SpiedFunction<typeof console.group>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleGroupEndSpy: jest.SpiedFunction<typeof console.groupEnd>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    // Create mock event listeners storage
    eventListeners = new Map();

    // Create mock window object
    mockWindow = {
      location: {
        origin: "https://example.com",
      },
      addEventListener: jest.fn((event: string, handler: Function) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event)!.push(handler);
      }),
      removeEventListener: jest.fn((event: string, handler: Function) => {
        if (eventListeners.has(event)) {
          const handlers = eventListeners.get(event)!;
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      }),
      dispatchEvent: jest.fn((event: Event) => {
        const handlers = eventListeners.get(event.type) || [];
        handlers.forEach((handler) => handler(event));
        return true;
      }),
      ErrorEvent: MockErrorEvent,
    };

    // Set global window
    global.window = mockWindow;

    // Clear error history
    clearCorsErrors();

    // Spy on console methods
    consoleGroupSpy = jest.spyOn(console, "group").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleGroupEndSpy = jest
      .spyOn(console, "groupEnd")
      .mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    stopListening();
    consoleGroupSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    // Clean up global window
    delete (global as any).window;
  });

  describe("listenCorsErrors", () => {
    it("should register error listener on window", () => {
      listenCorsErrors();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "error",
        expect.any(Function)
      );
    });

    it("should filter and capture CORS-related errors", () => {
      listenCorsErrors();

      // Dispatch CORS error
      const corsEvent = new MockErrorEvent("error", {
        message: "Access to fetch has been blocked by CORS policy",
      });
      mockWindow.dispatchEvent(corsEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("CORS");
    });

    it("should ignore non-CORS errors", () => {
      listenCorsErrors();

      // Dispatch non-CORS error
      const normalEvent = new MockErrorEvent("error", {
        message: "Uncaught TypeError: Cannot read property 'x' of undefined",
      });
      mockWindow.dispatchEvent(normalEvent);

      const errors = getCorsErrors();
      expect(errors.length).toBe(0);
    });

    it("should detect errors with 'cors' keyword", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "CORS policy blocked the request",
      });
      mockWindow.dispatchEvent(event);

      expect(getCorsErrors().length).toBe(1);
    });

    it("should detect errors with 'cross-origin' keyword", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "Cross-origin request blocked",
      });
      mockWindow.dispatchEvent(event);

      expect(getCorsErrors().length).toBe(1);
    });

    it("should detect errors with 'blocked' keyword", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "Request has been blocked by the browser",
      });
      mockWindow.dispatchEvent(event);

      expect(getCorsErrors().length).toBe(1);
    });

    it("should analyze error and provide possible causes", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "CORS: No 'Access-Control-Allow-Origin' header is present",
      });
      mockWindow.dispatchEvent(event);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].possibleCauses.length).toBeGreaterThan(0);
      expect(errors[0].possibleCauses[0]).toContain(
        "Access-Control-Allow-Origin"
      );
    });

    it("should provide recommendations for fixing errors", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "CORS policy: No 'Access-Control-Allow-Origin' header",
      });
      mockWindow.dispatchEvent(event);

      const errors = getCorsErrors();
      expect(errors[0].recommendations.length).toBeGreaterThan(0);
      expect(errors[0].recommendations[0]).toContain("CORS");
    });

    it("should include timestamp in error info", () => {
      listenCorsErrors();

      const beforeTime = new Date();
      const event = new MockErrorEvent("error", {
        message: "CORS error",
      });
      mockWindow.dispatchEvent(event);
      const afterTime = new Date();

      const errors = getCorsErrors();
      expect(errors[0].timestamp).toBeInstanceOf(Date);
      expect(errors[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(errors[0].timestamp.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });

    it("should display error in console with formatting", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "CORS error occurred",
      });
      mockWindow.dispatchEvent(event);

      expect(consoleGroupSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it("should call custom handler when provided", () => {
      const customHandler = jest.fn();
      listenCorsErrors({ customHandler });

      const event = new MockErrorEvent("error", {
        message: "CORS error",
      });
      mockWindow.dispatchEvent(event);

      expect(customHandler).toHaveBeenCalledTimes(1);
      expect(customHandler.mock.calls[0][0]).toHaveProperty("message");
      expect(customHandler.mock.calls[0][0]).toHaveProperty("possibleCauses");
      expect(customHandler.mock.calls[0][0]).toHaveProperty("recommendations");
    });

    it("should handle custom handler errors gracefully", () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const customHandler = jest.fn(() => {
        throw new Error("Handler error");
      });

      listenCorsErrors({ customHandler });

      const event = new MockErrorEvent("error", {
        message: "CORS error",
      });
      mockWindow.dispatchEvent(event);

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should log in verbose mode", () => {
      listenCorsErrors({ verbose: true });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logs = consoleLogSpy.mock.calls.map((call) => call.join(" "));
      expect(logs.some((log) => log.includes("listener started"))).toBe(true);
    });

    it("should warn if listener already active", () => {
      listenCorsErrors();
      listenCorsErrors(); // Try to start again

      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnings = consoleWarnSpy.mock.calls.map((call) => call.join(" "));
      expect(warnings.some((w) => w.includes("already active"))).toBe(true);
    });

    it("should detect preflight-related errors", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "CORS: Preflight request failed",
      });
      mockWindow.dispatchEvent(event);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(
        errors[0].possibleCauses.some((c) => c.includes("preflight"))
      ).toBe(true);
    });

    it("should detect credentials-related errors", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "Credentials mode blocked by CORS",
      });
      mockWindow.dispatchEvent(event);

      const errors = getCorsErrors();
      expect(
        errors[0].possibleCauses.some((c) => c.includes("credential"))
      ).toBe(true);
    });

    it("should detect custom header errors", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "CORS: Request header field X-Custom-Header is not allowed",
      });
      mockWindow.dispatchEvent(event);

      const errors = getCorsErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].possibleCauses.some((c) => c.includes("header"))).toBe(
        true
      );
    });

    it("should detect method not allowed errors", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "Method DELETE not allowed by CORS",
      });
      mockWindow.dispatchEvent(event);

      const errors = getCorsErrors();
      expect(errors[0].possibleCauses.some((c) => c.includes("method"))).toBe(
        true
      );
    });
  });

  describe("stopListening", () => {
    it("should remove error listener from window", () => {
      listenCorsErrors();
      stopListening();

      // Dispatch error after stopping
      const event = new MockErrorEvent("error", {
        message: "CORS error",
      });
      mockWindow.dispatchEvent(event);

      // Should not capture the error
      const errors = getCorsErrors();
      expect(errors.length).toBe(0);
    });

    it("should log when stopping listener", () => {
      listenCorsErrors();
      consoleLogSpy.mockClear(); // Clear previous logs
      stopListening();

      expect(consoleLogSpy).toHaveBeenCalled();
      const logs = consoleLogSpy.mock.calls.map((call) => call.join(" "));
      expect(logs.some((log) => log.includes("stopped"))).toBe(true);
    });

    it("should not throw when called without active listener", () => {
      expect(() => stopListening()).not.toThrow();
    });
  });

  describe("getCorsErrors", () => {
    it("should return empty array initially", () => {
      const errors = getCorsErrors();
      expect(errors).toEqual([]);
    });

    it("should return array of captured errors", () => {
      listenCorsErrors();

      const event1 = new MockErrorEvent("error", {
        message: "CORS error 1",
      });
      const event2 = new MockErrorEvent("error", {
        message: "CORS error 2",
      });

      mockWindow.dispatchEvent(event1);
      mockWindow.dispatchEvent(event2);

      const errors = getCorsErrors();
      expect(errors.length).toBe(2);
      expect(errors[0].message).toContain("CORS error 1");
      expect(errors[1].message).toContain("CORS error 2");
    });

    it("should return a copy of the error array", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "CORS error",
      });
      mockWindow.dispatchEvent(event);

      const errors1 = getCorsErrors();
      const errors2 = getCorsErrors();

      expect(errors1).not.toBe(errors2); // Different array instances
      expect(errors1).toEqual(errors2); // But same content
    });
  });

  describe("clearCorsErrors", () => {
    it("should clear all captured errors", () => {
      listenCorsErrors();

      const event = new MockErrorEvent("error", {
        message: "CORS error",
      });
      mockWindow.dispatchEvent(event);

      expect(getCorsErrors().length).toBe(1);

      clearCorsErrors();

      expect(getCorsErrors().length).toBe(0);
    });
  });

  describe("SSR safety", () => {
    it("should warn when window is undefined", () => {
      // Remove window temporarily
      const originalWindow = global.window;
      delete (global as any).window;

      listenCorsErrors();

      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnings = consoleWarnSpy.mock.calls.map((call) => call.join(" "));
      expect(warnings.some((w) => w.includes("non-browser environment"))).toBe(
        true
      );

      // Restore window
      global.window = originalWindow;
    });

    it("should not throw when window is undefined", () => {
      const originalWindow = global.window;
      delete (global as any).window;

      expect(() => listenCorsErrors()).not.toThrow();
      expect(() => stopListening()).not.toThrow();

      global.window = originalWindow;
    });
  });
});
