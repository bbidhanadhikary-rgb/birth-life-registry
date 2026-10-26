import { describe, expect, it } from "vitest";
import { getStationsForUpazila, MONIRAMPUR_STATIONS } from "./monirampur-stations";
import { seedState } from "./seed";

describe("Monirampur station registry", () => {
  it("contains one paurashava and all 17 unions with unique station IDs", () => {
    expect(MONIRAMPUR_STATIONS).toHaveLength(18);
    expect(MONIRAMPUR_STATIONS.filter((station) => station.type === "union")).toHaveLength(17);
    expect(MONIRAMPUR_STATIONS.filter((station) => station.type === "paurashava")).toHaveLength(1);
    expect(new Set(MONIRAMPUR_STATIONS.map((station) => station.id)).size).toBe(18);
  });

  it("drives seeded stations and the UNO station list", () => {
    const monirampur = seedState().upazilas.find((upazila) => upazila.id === "manirampur")!;
    const stations = getStationsForUpazila(monirampur.id, monirampur.unions);

    expect(stations).toHaveLength(18);
    expect(stations.find((station) => station.id === "mn-pourashava")?.type).toBe("paurashava");
    expect(stations.find((station) => station.id === "mn-dhakuria")?.bn).toBe("০৪ নং ঢাকুরিয়া");
  });
});
