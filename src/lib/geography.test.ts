import { describe, expect, it } from "vitest";
import { seedState } from "./seed";
import {
  BANGLADESH_ADMINISTRATIVE_AREAS,
  filterCasesByAdministrativeArea,
  getAdministrativeWards,
  sameAdministrativeName,
} from "./geography";

const allFilters = { division: "all", district: "all", upazila: "all", union: "all" };

describe("Bangladesh administrative geography", () => {
  it("includes the complete bilingual division, district, upazila, union and municipality catalog", () => {
    expect(BANGLADESH_ADMINISTRATIVE_AREAS.filter((area) => area.level === "division")).toHaveLength(8);
    expect(BANGLADESH_ADMINISTRATIVE_AREAS.filter((area) => area.level === "district")).toHaveLength(64);
    expect(BANGLADESH_ADMINISTRATIVE_AREAS.filter((area) => area.level === "upazila")).toHaveLength(495);
    expect(BANGLADESH_ADMINISTRATIVE_AREAS.filter((area) => area.level === "union")).toHaveLength(4540);
    expect(BANGLADESH_ADMINISTRATIVE_AREAS.filter((area) => area.level === "municipality")).toHaveLength(328);
    expect(BANGLADESH_ADMINISTRATIVE_AREAS.filter((area) => area.level === "city_corporation")).toHaveLength(12);
    expect(new Set(BANGLADESH_ADMINISTRATIVE_AREAS.map((area) => area.id)).size).toBe(
      BANGLADESH_ADMINISTRATIVE_AREAS.length,
    );
  });

  it("cascades from a division to only its districts and their upazilas", () => {
    const khulna = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "division" && area.en === "Khulna",
    )!;
    const khulnaDistricts = BANGLADESH_ADMINISTRATIVE_AREAS.filter(
      (area) => area.level === "district" && area.parentId === khulna.id,
    );
    expect(khulnaDistricts).toHaveLength(10);

    const jashore = khulnaDistricts.find((area) => area.en === "Jashore")!;
    const jashoreUpazilas = BANGLADESH_ADMINISTRATIVE_AREAS.filter(
      (area) => area.level === "upazila" && area.parentId === jashore.id,
    );
    expect(jashoreUpazilas.some((area) => area.en === "Manirampur")).toBe(true);
  });

  it("filters seeded dashboard records by upazila and union, including ordinal name variants", () => {
    const seed = seedState();
    const khulna = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "division" && area.en === "Khulna",
    )!;
    const jashore = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "district" && area.en === "Jashore",
    )!;
    const manirampur = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "upazila" && area.en === "Manirampur",
    )!;
    const rohita = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "union" && area.parentId === manirampur.id && area.en === "Rohita",
    )!;
    const municipality = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) =>
        area.level === "municipality" &&
        area.parentId === manirampur.id &&
        area.en === "Manirampur",
    )!;
    const rohitaWardOne = getAdministrativeWards(rohita.id)[0]!;
    const dhakaNorth = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "city_corporation" && area.en === "Dhaka North City Corporation",
    )!;

    expect(
      filterCasesByAdministrativeArea(seed.cases, seed.upazilas, {
        ...allFilters,
        division: khulna.id,
        district: jashore.id,
      }).map((item) => item.id),
    ).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
    expect(
      filterCasesByAdministrativeArea(seed.cases, seed.upazilas, {
        ...allFilters,
        upazila: manirampur.id,
      }).map((item) => item.id),
    ).toEqual(["c1", "c2", "c3", "c4", "c5", "c6"]);
    expect(
      filterCasesByAdministrativeArea(seed.cases, seed.upazilas, {
        ...allFilters,
        upazila: manirampur.id,
        union: rohita.id,
      }).map((item) => item.id),
    ).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(
      filterCasesByAdministrativeArea(seed.cases, seed.upazilas, {
        ...allFilters,
        upazila: dhakaNorth.id,
      }),
    ).toEqual([]);
    expect(
      filterCasesByAdministrativeArea(seed.cases, seed.upazilas, {
        ...allFilters,
        upazila: manirampur.id,
        union: municipality.id,
      }).map((item) => item.id),
    ).toEqual(["c6"]);
    expect(
      filterCasesByAdministrativeArea(seed.cases, seed.upazilas, {
        ...allFilters,
        upazila: manirampur.id,
        union: rohita.id,
        ward: rohitaWardOne.id,
      }).map((item) => item.id),
    ).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("filters by a ward across an upazila without requiring a union selection", () => {
    const seed = seedState();
    const manirampur = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "upazila" && area.en === "Manirampur",
    )!;

    expect(
      filterCasesByAdministrativeArea(seed.cases, seed.upazilas, {
        ...allFilters,
        upazila: manirampur.id,
        ward: "ward-1",
      }).map((item) => item.id),
    ).toEqual(["c1", "c2", "c3", "c4", "c5", "c6"]);
    expect(
      filterCasesByAdministrativeArea(seed.cases, seed.upazilas, {
        ...allFilters,
        upazila: manirampur.id,
        ward: "ward-10",
      }),
    ).toEqual([]);
  });

  it("supports Bangla/English aliases and supplies app-schema ward numbers", () => {
    expect(sameAdministrativeName("০১ নং রোহিতা", "রোহিতা")).toBe(true);
    expect(sameAdministrativeName("Manirampur Pourashava", "Manirampur")).toBe(true);
    expect(sameAdministrativeName("Comilla", "Cumilla")).toBe(true);
    const union = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "union" && area.en === "Rohita",
    )!;
    expect(getAdministrativeWards(union.id).map((ward) => ward.wardNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    const dhakaNorth = BANGLADESH_ADMINISTRATIVE_AREAS.find(
      (area) => area.level === "city_corporation" && area.en === "Dhaka North City Corporation",
    )!;
    expect(getAdministrativeWards(dhakaNorth.id)).toHaveLength(54);
  });
});
