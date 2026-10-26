import { describe, expect, it } from "vitest";
import { seedState } from "./seed";
import { scopedCases } from "./store";

describe("station-scoped registration cases", () => {
  it("isolates administrative officers by assigned station while preserving UNO-wide visibility", () => {
    const state = seedState();
    const rohitaCase = state.cases[0]!;
    const dhakuriaCase = {
      ...rohitaCase,
      id: "dhakuria-case",
      stationId: "mn-dhakuria",
      unionId: "mn-dhakuria",
    };
    const mismatchedStationCase = {
      ...rohitaCase,
      id: "mismatched-station-case",
      stationId: "mn-dhakuria",
      unionId: "mn-rohita",
    };
    state.cases = [...state.cases, dhakuriaCase, mismatchedStationCase];

    const rohitaOfficer = state.users.find((user) => user.id === "u-a1")!;
    const uno = state.users.find((user) => user.id === "u-uno")!;

    expect(scopedCases(state, rohitaOfficer).map((item) => item.id)).not.toContain("dhakuria-case");
    expect(scopedCases(state, rohitaOfficer).map((item) => item.id)).not.toContain("mismatched-station-case");
    expect(scopedCases(state, uno).map((item) => item.id)).toContain("dhakuria-case");
  });
});
