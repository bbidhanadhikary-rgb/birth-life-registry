import { describe, expect, it } from "vitest";
import { buildWardKpis } from "./ward-kpi";
import type { RegCase } from "./types";

function makeCase(id: string, dob: string, status: RegCase["status"] = "pending"): RegCase {
  return {
    id,
    type: "birth",
    name: { bn: "নমুনা", en: "Sample" },
    father: { bn: "পিতা", en: "Father" },
    mother: { bn: "মাতা", en: "Mother" },
    nid: "",
    gender: "other",
    dob,
    villageId: "village-1",
    files: [],
    status,
    remarks: [],
    createdBy: "user-1",
    upazilaId: "upazila-1",
    unionId: "union-1",
    ward: 1,
    createdAt: Date.parse("2026-01-01T00:00:00Z"),
    synced: true,
    smsSent: false,
  };
}

describe("buildWardKpis", () => {
  const now = Date.parse("2026-10-25T00:00:00Z");
  const dateAtAge = (days: number) =>
    new Date(now - days * 86400000).toISOString().slice(0, 10);

  it("groups ward totals, completion, pending backlog, and SLA bands inclusively", () => {
    const rows = buildWardKpis([
      makeCase("green", dateAtAge(45)),
      makeCase("yellow", dateAtAge(46)),
      makeCase("edge", dateAtAge(365)),
      makeCase("red", dateAtAge(366)),
      makeCase("complete", dateAtAge(400), "completed"),
      { ...makeCase("rejected", dateAtAge(50), "rejected"), ward: 2 },
    ], now);

    expect(rows).toEqual([
      { ward: 1, total: 5, completed: 1, pending: 4, green: 1, yellow: 2, red: 1 },
      { ward: 2, total: 1, completed: 0, pending: 0, green: 0, yellow: 0, red: 0 },
    ]);
  });
});
