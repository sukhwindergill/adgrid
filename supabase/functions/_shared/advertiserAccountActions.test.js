import { describe, it, expect } from "vitest";
import { validateSetStatus, validateAddCredits, validateSetRateOverride } from "./advertiserAccountActions.ts";

describe("validateSetStatus", () => {
  it("accepts active and suspended", () => {
    expect(validateSetStatus("active").valid).toBe(true);
    expect(validateSetStatus("suspended").valid).toBe(true);
  });
  it("rejects anything else", () => {
    expect(validateSetStatus("banned").valid).toBe(false);
    expect(validateSetStatus(undefined).valid).toBe(false);
  });
});

describe("validateAddCredits", () => {
  it("accepts a positive number", () => {
    expect(validateAddCredits(50).valid).toBe(true);
    expect(validateAddCredits("50.25").valid).toBe(true);
  });
  it("rejects zero, negative, and non-numeric", () => {
    expect(validateAddCredits(0).valid).toBe(false);
    expect(validateAddCredits(-5).valid).toBe(false);
    expect(validateAddCredits("abc").valid).toBe(false);
    expect(validateAddCredits(NaN).valid).toBe(false);
  });
});

describe("validateSetRateOverride", () => {
  it("accepts null to clear", () => {
    expect(validateSetRateOverride(null).valid).toBe(true);
  });
  it("accepts a non-negative number", () => {
    expect(validateSetRateOverride(12.5).valid).toBe(true);
    expect(validateSetRateOverride(0).valid).toBe(true);
  });
  it("rejects negative or non-numeric", () => {
    expect(validateSetRateOverride(-1).valid).toBe(false);
    expect(validateSetRateOverride("abc").valid).toBe(false);
  });
});
