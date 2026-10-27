import { describe, expect, it } from "vitest";
import {
  getCompletionPercent,
  getDhakaMonthYear,
  getMonthlyStatusProgress,
} from "./monthly-targets";

describe("union monthly target helpers", () => {
  it("uses the Bangladesh calendar month when building the month key", () => {
    expect(getDhakaMonthYear(new Date("2026-09-30T19:00:00.000Z"))).toBe("2026-10-01");
  });

  it("calculates combined birth and death target completion", () => {
    expect(getCompletionPercent(28, 9, 56, 18)).toBe(50);
    expect(getCompletionPercent(80, 20, 56, 18)).toBe(135);
    expect(getCompletionPercent(1, 1, 0, 0)).toBe(0);
  });

  it("compares station submissions to target and statuses to total applications", () => {
    const counts = { pending: 2, progress: 1, completed: 3, total: 8 };
    expect(getMonthlyStatusProgress(counts, 10, "submitted")).toEqual({
      value: 8,
      denominator: 10,
      percentage: 80,
    });
    expect(getMonthlyStatusProgress(counts, 10, "completed")).toEqual({
      value: 3,
      denominator: 8,
      percentage: 38,
    });
    expect(getMonthlyStatusProgress(counts, 10, "progress")).toEqual({
      value: 3,
      denominator: 8,
      percentage: 38,
    });
  });
});
