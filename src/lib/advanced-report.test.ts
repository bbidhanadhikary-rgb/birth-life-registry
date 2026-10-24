import { describe, expect, it } from "vitest";
import { filterAdvancedReport, getDaysFromBirth, type AdvancedReportFilters } from "./advanced-report";
import type { RegCase } from "./types";

function makeCase(overrides: Partial<RegCase> = {}): RegCase {
  return {
    id: "case-1",
    type: "birth",
    name: { bn: "শিশু", en: "Child" },
    father: { bn: "পিতা", en: "Father" },
    mother: { bn: "মাতা", en: "Mother" },
    nid: "",
    gender: "other",
    dob: "2026-01-01",
    villageId: "village-1",
    files: [],
    status: "completed",
    regNo: "123",
    remarks: [],
    createdBy: "user-1",
    upazilaId: "upazila-1",
    unionId: "union-1",
    ward: 1,
    createdAt: Date.parse("2026-01-01T00:00:00Z"),
    completedAt: Date.parse("2026-02-15T00:00:00Z"),
    synced: true,
    smsSent: false,
    ...overrides,
  };
}

const defaultFilters: AdvancedReportFilters = {
  type: "all",
  status: "all",
  fromDate: "",
  toDate: "",
  thresholdDays: null,
};

describe("filterAdvancedReport", () => {
  it("includes completed births registered on or before the inclusive threshold", () => {
    const on45thDay = makeCase();
    const after45thDay = makeCase({
      id: "case-2",
      completedAt: Date.parse("2026-02-16T00:00:00Z"),
    });
    const rows = filterAdvancedReport([on45thDay, after45thDay], {
      ...defaultFilters,
      type: "birth",
      status: "completed",
      thresholdDays: 45,
    });

    expect(rows.map((row) => row.item.id)).toEqual(["case-1"]);
    expect(rows[0]?.daysFromBirth).toBe(45);
  });

  it("uses Dhaka registration dates for date ranges", () => {
    const caseOnRangeStart = makeCase({
      completedAt: Date.parse("2026-01-31T20:00:00Z"),
    });
    const caseOutsideRange = makeCase({
      id: "case-2",
      completedAt: Date.parse("2026-02-01T20:00:00Z"),
    });

    const rows = filterAdvancedReport([caseOnRangeStart, caseOutsideRange], {
      ...defaultFilters,
      fromDate: "2026-02-01",
      toDate: "2026-02-01",
    });

    expect(rows.map((row) => row.item.id)).toEqual(["case-1"]);
    expect(rows[0]?.registrationDate).toBe("2026-02-01");
  });

  it("excludes non-birth, incomplete, missing-date, and post-threshold cases", () => {
    const cases = [
      makeCase({ id: "death", type: "death" }),
      makeCase({ id: "pending", status: "pending", completedAt: undefined }),
      makeCase({ id: "missing-dob", dob: "invalid-date" }),
      makeCase({ id: "future-dob", dob: "2026-03-01" }),
      makeCase({ id: "too-late", completedAt: Date.parse("2026-02-16T00:00:00Z") }),
    ];

    expect(
      filterAdvancedReport(cases, {
        ...defaultFilters,
        thresholdDays: 45,
      }),
    ).toEqual([]);
    expect(getDaysFromBirth(cases[2]!)).toBeNull();
  });

  it("applies status and rejects invalid or reversed date ranges", () => {
    const cases = [makeCase(), makeCase({ id: "pending", status: "pending" })];
    expect(
      filterAdvancedReport(cases, {
        ...defaultFilters,
        status: "completed",
      }).map((row) => row.item.id),
    ).toEqual(["case-1"]);
    expect(
      filterAdvancedReport(cases, {
        ...defaultFilters,
        fromDate: "2026-02-30",
      }),
    ).toEqual([]);
    expect(
      filterAdvancedReport(cases, {
        ...defaultFilters,
        fromDate: "2026-03-01",
        toDate: "2026-02-01",
      }),
    ).toEqual([]);
  });

  it("counts calendar days rather than elapsed hours", () => {
    expect(
      getDaysFromBirth(
        makeCase({
          dob: "2026-01-01",
          completedAt: Date.parse("2026-01-03T01:00:00Z"),
        }),
      ),
    ).toBe(2);
  });
});
