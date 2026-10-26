import { describe, expect, it } from "vitest";
import {
  getStationsForUpazila,
  getTargetEntryStations,
  MONIRAMPUR_STATIONS,
} from "./monirampur-stations";
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

  it("orders target-entry rows as unions 01-17 followed by paurashava 18", () => {
    const monirampur = seedState().upazilas.find((upazila) => upazila.id === "manirampur")!;
    const stations = getTargetEntryStations(monirampur.id, monirampur.unions);

    expect(stations).toHaveLength(18);
    expect(stations.slice(0, 17).every((station) => station.type === "union")).toBe(true);
    expect(stations[0]).toMatchObject({ id: "mn-rohita", bn: "০১ নং রোহিতা" });
    expect(stations[16]).toMatchObject({ id: "mn-monoharpur", bn: "১৭ নং মনোহরপুর" });
    expect(stations[17]).toMatchObject({ id: "mn-pourashava", bn: "মণিরামপুর পৌরসভা", type: "paurashava" });
  });
});
