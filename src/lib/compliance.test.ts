import { describe, expect, it } from "vitest";
import { getCaseDeadline } from "./compliance";
import type { RegCase } from "./types";

const makeCase = (overrides: Partial<RegCase> = {}): RegCase => ({
  id: "case-1",
  type: "birth",
  name: { bn: "নমুনা", en: "Sample" },
  father: { bn: "পিতা", en: "Father" },
  mother: { bn: "মাতা", en: "Mother" },
  nid: "1234567890",
  gender: "male",
  dob: "2025-01-01",
  villageId: "village-1",
  files: [],
  status: "pending",
  remarks: [],
  createdBy: "worker-1",
  upazilaId: "manirampur",
  unionId: "union-1",
  ward: 1,
  createdAt: 0,
  synced: true,
  smsSent: false,
  ...overrides,
});

describe("getCaseDeadline", () => {
  it("uses the birth date and reports cases approaching the 365-day deadline", () => {
    const result = getCaseDeadline(makeCase(), Date.UTC(2025, 11, 7));
    expect(result).toMatchObject({
      eventDate: "2025-01-01",
      deadlineDate: "2026-01-01",
      elapsedDays: 340,
      daysRemaining: 25,
      status: "due-soon",
    });
  });

  it("uses date of death for death registrations", () => {
    const result = getCaseDeadline(
      makeCase({ type: "death", dod: "2024-02-29" }),
      Date.UTC(2025, 2, 1),
    );
    expect(result).toMatchObject({ eventDate: "2024-02-29", status: "overdue" });
  });

  it("does not mark a case overdue on its deadline date", () => {
    const result = getCaseDeadline(makeCase(), Date.UTC(2026, 0, 1));
    expect(result).toMatchObject({ elapsedDays: 365, daysRemaining: 0, status: "due-soon" });
  });

  it("uses the Bangladesh calendar date when UTC and local dates differ", () => {
    const result = getCaseDeadline(makeCase(), Date.UTC(2026, 0, 1) - 5.5 * 60 * 60 * 1000);
    expect(result).toMatchObject({ elapsedDays: 365, daysRemaining: 0, status: "due-soon" });
  });

  it("marks cases overdue only after the deadline date", () => {
    const result = getCaseDeadline(makeCase(), Date.UTC(2026, 0, 2));
    expect(result).toMatchObject({ elapsedDays: 366, daysRemaining: -1, status: "overdue" });
  });

  it("returns null for missing, invalid, and future occurrence dates", () => {
    expect(
      getCaseDeadline(makeCase({ type: "death", dod: undefined }), Date.UTC(2025, 0, 1)),
    ).toBeNull();
    expect(getCaseDeadline(makeCase({ dob: "2025-02-30" }), Date.UTC(2025, 2, 1))).toBeNull();
    expect(getCaseDeadline(makeCase({ dob: "2025-01-02" }), Date.UTC(2025, 0, 1))).toBeNull();
  });
});
