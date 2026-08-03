import { describe, expect, it } from "vitest";
import { consumeLastCapturedError, describeError } from "@/lib/error-capture";

describe("error-capture utility", () => {
  it("describes non-error primitive values", () => {
    expect(describeError("Simple error message")).toBe("Simple error message");
    expect(describeError({ code: 500, detail: "Server error" })).toBe(
      '{"code":500,"detail":"Server error"}',
    );
  });

  it("describes standard Error instances", () => {
    const err = new Error("Database connection failed");
    const output = describeError(err);
    expect(output).toContain("Database connection failed");
  });

  it("describes error cause chains", () => {
    const rootCause = new Error("Connection timeout");
    const wrapperError = new Error("Failed to query DB", { cause: rootCause });
    const output = describeError(wrapperError);

    expect(output).toContain("Failed to query DB");
    expect(output).toContain("caused by: ");
    expect(output).toContain("Connection timeout");
  });

  it("describes errors with custom status codes", () => {
    const httpErr = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    const output = describeError(httpErr);

    expect(output).toContain("Unauthorized");
    expect(output).toContain("(status 401)");
  });

  it("captures and consumes recorded errors", () => {
    const testError = new Error("Captured error test");
    console.error(testError);

    const captured = consumeLastCapturedError();
    expect(captured).toBe(testError);

    // Second consume should return undefined since it was consumed
    expect(consumeLastCapturedError()).toBeUndefined();
  });
});
