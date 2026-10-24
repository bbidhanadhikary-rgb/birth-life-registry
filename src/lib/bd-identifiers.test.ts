import { describe, expect, it } from "vitest";
import { isValidBrn, isValidNid, normalizeBdDigits } from "./bd-identifiers";

describe("Bangladesh registration identifiers", () => {
  it("normalizes Bengali and Arabic-Indic digits", () => {
    expect(normalizeBdDigits("১২৩٤")).toBe("1234");
  });

  it("accepts only 17-digit BRNs", () => {
    expect(isValidBrn("12345678901234567")).toBe(true);
    expect(isValidBrn("১২৩৪৫৬৭৮৯০১২৩৪৫৬৭")).toBe(true);
    expect(isValidBrn("1234567890123456")).toBe(false);
    expect(isValidBrn("123456789012345678")).toBe(false);
  });

  it("accepts only 10, 13, or 17-digit NIDs", () => {
    for (const length of [10, 13, 17]) {
      expect(isValidNid("1".repeat(length))).toBe(true);
    }
    expect(isValidNid("1".repeat(11))).toBe(false);
    expect(isValidNid("123456789a")).toBe(false);
  });
});
