import { beforeEach, describe, expect, it } from "vitest";
import {
  getDemoTargetsStorageKey,
  readDemoRegistrationTargets,
  writeDemoRegistrationTargets,
} from "./registration-targets";
import {
  incrementStationCompletedCount,
  readStationLocalMetrics,
  writeStationLocalTarget,
} from "./station-local-metrics";

describe("registration target storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists submitted targets and completed counts station-wise", () => {
    expect(writeStationLocalTarget("manirampur", "mn-dhakuria", "2026-10-01", 62, 21)).toBe(true);
    expect(readStationLocalMetrics("manirampur", "mn-dhakuria", "2026-10-01")).toMatchObject({
      birthTarget: 62,
      deathTarget: 21,
    });

    expect(incrementStationCompletedCount("manirampur", "mn-dhakuria", "2026-10-01", "case-1", 0, "birth")).toBe(1);
    expect(readStationLocalMetrics("manirampur", "mn-dhakuria", "2026-10-01")).toMatchObject({
      completedCount: 1,
      birthCompletedCount: 1,
      deathCompletedCount: 0,
    });

    expect(incrementStationCompletedCount("manirampur", "mn-dhakuria", "2026-10-01", "case-1", 1, "birth")).toBe(1);
  });

  it("persists submitted targets by Upazila and month while retaining station IDs", () => {
    const targets = [
      {
        union_id: "mn-dhakuria",
        union_name: "০৪ নং ঢাকুরিয়া",
        birth_target: 62,
        death_target: 21,
        status: "submitted" as const,
        updated_at: "2026-10-27T00:00:00.000Z",
      },
    ];

    expect(writeDemoRegistrationTargets("manirampur", "2026-10-01", targets)).toBe(true);
    expect(readDemoRegistrationTargets("manirampur", "2026-10-01")).toEqual(targets);
    expect(readDemoRegistrationTargets("manirampur", "2026-11-01")).toEqual([]);
    expect(readDemoRegistrationTargets("keshabpur", "2026-10-01")).toEqual([]);
    expect(getDemoTargetsStorageKey("manirampur", "2026-10-01")).toContain("manirampur:2026-10-01");
  });
});
