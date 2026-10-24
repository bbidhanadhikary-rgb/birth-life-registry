import { describe, expect, it } from "vitest";
import { seedState } from "./seed";
import { simulateJurisdiction } from "./jurisdiction-simulation";
import {
  EXECUTIVE_PREVIEW_ROLES,
  POLICY_READ_ONLY_ROLES,
} from "./dashboard-roles";

const seed = seedState();

describe("executive role configuration", () => {
  it("keeps the eight executive roles in the requested order and read-only", () => {
    expect(EXECUTIVE_PREVIEW_ROLES).toEqual([
      "municipal_executive_officer",
      "uno",
      "ddlg",
      "dc",
      "addl_registrar_general",
      "city_corporation_ceo",
      "divisional_commissioner",
      "registrar_general",
    ]);
    expect(EXECUTIVE_PREVIEW_ROLES.every((role) => POLICY_READ_ONLY_ROLES.includes(role))).toBe(true);
  });
});

describe("simulateJurisdiction", () => {
  it("filters village police to the assigned ward", () => {
    const result = simulateJurisdiction(seed.cases, seed.upazilas, "village_police", null);

    expect(result.level).toBe("ward");
    expect(result.cases.every((item) => item.ward === 1)).toBe(true);
  });

  it("filters health workers to assigned wards", () => {
    const result = simulateJurisdiction(seed.cases, seed.upazilas, "health_worker", null);

    expect(result.level).toBe("assigned_wards");
    expect(result.cases.every((item) => [1, 2, 3].includes(item.ward))).toBe(true);
    expect(result.targetScale).toBe(3 / 9);
  });

  it("uses union and municipality mappings from the geography tree", () => {
    const union = simulateJurisdiction(seed.cases, seed.upazilas, "up_chairman", null);
    const municipality = simulateJurisdiction(seed.cases, seed.upazilas, "municipal_secretary", null);

    expect(union.cases.every((item) => item.unionId === "mn-rohita")).toBe(true);
    expect(municipality.cases.length).toBe(1);
    expect(municipality.cases.every((item) => item.unionId.includes("pourashava"))).toBe(true);
  });

  it("maps the PEO and city corporation CEO to municipal cases", () => {
    const peo = simulateJurisdiction(
      seed.cases,
      seed.upazilas,
      "municipal_executive_officer",
      null,
    );
    const ceo = simulateJurisdiction(
      seed.cases,
      seed.upazilas,
      "city_corporation_ceo",
      null,
    );

    expect(peo.level).toBe("municipality");
    expect(ceo.level).toBe("municipality");
    expect(peo.cases.map((item) => item.id)).toEqual(ceo.cases.map((item) => item.id));
    expect(peo.labelEn).toContain("PEO");
    expect(ceo.labelEn).toContain("City Corporation");
  });

  it("simulates city zones as odd/even ward groups within mapped municipalities", () => {
    const result = simulateJurisdiction(seed.cases, seed.upazilas, "city_zonal_officer", null);

    expect(result.level).toBe("city_zone");
    expect(result.cases.length).toBe(1);
    expect(result.cases[0]?.ward).toBe(1);
    expect(result.cases[0]?.unionId).toBe("mn-pourashava");
  });

  it("aggregates at upazila, district, and division levels", () => {
    const upazila = simulateJurisdiction(seed.cases, seed.upazilas, "uno", null);
    const ddlg = simulateJurisdiction(seed.cases, seed.upazilas, "ddlg", null);
    const dc = simulateJurisdiction(seed.cases, seed.upazilas, "dc", null);
    const division = simulateJurisdiction(
      seed.cases,
      seed.upazilas,
      "divisional_commissioner",
      null,
    );

    expect(upazila.cases).toHaveLength(6);
    expect(ddlg.cases).toHaveLength(seed.cases.length);
    expect(dc.cases).toHaveLength(seed.cases.length);
    expect(division.cases).toHaveLength(seed.cases.length);
  });

  it("aggregates the available cases at nationwide level", () => {
    const result = simulateJurisdiction(seed.cases, seed.upazilas, "registrar_general", null);

    expect(result.level).toBe("nationwide");
    expect(result.cases).toEqual(seed.cases);
  });
});
