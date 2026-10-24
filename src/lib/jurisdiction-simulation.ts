import type { RegCase, Upazila, User } from "./types";
import type { PreviewRole } from "./dashboard-roles";

export type JurisdictionLevel =
  | "ward"
  | "assigned_wards"
  | "union"
  | "municipality"
  | "city_zone"
  | "upazila"
  | "district"
  | "division"
  | "nationwide";

export type JurisdictionSimulation = {
  cases: RegCase[];
  level: JurisdictionLevel;
  targetScale: number;
  labelBn: string;
  labelEn: string;
};

const MOCK_ASSIGNMENTS = {
  wardId: 1,
  assignedWards: [1, 2, 3],
  unionCode: "mn-rohita",
  municipalityCode: "mn-pourashava",
  zoneCode: "zone-1",
  upazilaCode: "manirampur",
  districtCode: "Jashore",
  divisionCode: "Khulna",
} as const;

const isMunicipality = (id: string, bn: string, en: string) =>
  /pourashava|municipality/i.test(`${id} ${en}`) || bn.includes("পৌরসভা");

function getUnionLocations(upazilas: Upazila[]) {
  return upazilas.flatMap((upazila) =>
    upazila.unions.map((union) => ({
      upazila,
      union,
      municipality: isMunicipality(union.id, union.bn, union.en),
    })),
  );
}

export function simulateJurisdiction(
  sourceCases: RegCase[],
  upazilas: Upazila[],
  role: PreviewRole,
  user: User | null,
): JurisdictionSimulation {
  const unionLocations = getUnionLocations(upazilas);
  const fallbackUpazila =
    upazilas.find((area) => area.id === (user?.upazilaId || MOCK_ASSIGNMENTS.upazilaCode)) ??
    upazilas[0];
  const fallbackUnion =
    unionLocations.find(
      ({ union }) => union.id === (user?.unionId || MOCK_ASSIGNMENTS.unionCode),
    )?.union ?? unionLocations[0]?.union;
  let level: JurisdictionLevel;
  let selectedCases = sourceCases;
  let targetScale = 0;
  let labelBn = "জাতীয় পর্যায়";
  let labelEn = "Nationwide";

  switch (role) {
    case "village_police": {
      level = "ward";
      const wardId = user?.ward ?? MOCK_ASSIGNMENTS.wardId;
      selectedCases = sourceCases.filter((item) => item.ward === wardId);
      targetScale = 1 / 9;
      labelBn = `ওয়ার্ড ${wardId}`;
      labelEn = `Ward ${wardId}`;
      break;
    }
    case "health_worker": {
      level = "assigned_wards";
      const assignedWards: readonly number[] = MOCK_ASSIGNMENTS.assignedWards;
      selectedCases = sourceCases.filter(
        (item) =>
          assignedWards.includes(item.ward) &&
          (!user?.unionId || item.unionId === user.unionId),
      );
      targetScale = assignedWards.length / 9;
      labelBn = `নির্ধারিত ওয়ার্ড ${assignedWards.join(", ")}`;
      labelEn = `Assigned wards ${assignedWards.join(", ")}`;
      break;
    }
    case "up_official":
    case "up_secretary":
    case "up_chairman": {
      level = "union";
      const unionId = user?.unionId ?? fallbackUnion?.id ?? MOCK_ASSIGNMENTS.unionCode;
      selectedCases = sourceCases.filter((item) => item.unionId === unionId);
      targetScale = 1;
      const union = unionLocations.find((location) => location.union.id === unionId)?.union;
      labelBn = union?.bn ?? `ইউনিয়ন ${unionId}`;
      labelEn = union?.en ?? `Union ${unionId}`;
      break;
    }
    case "municipal_secretary":
    case "municipal_executive_officer":
    case "city_corporation_ceo": {
      level = "municipality";
      const municipalityId =
        user?.unionId &&
        unionLocations.some(
          ({ union, municipality }) => municipality && union.id === user.unionId,
        )
          ? user.unionId
          : MOCK_ASSIGNMENTS.municipalityCode;
      const municipalityUnions = unionLocations.filter(
        ({ union, municipality }) =>
          municipality && union.id === municipalityId,
      );
      const municipalityIds = new Set(municipalityUnions.map(({ union }) => union.id));
      selectedCases = sourceCases.filter((item) => municipalityIds.has(item.unionId));
      targetScale = Math.max(1, municipalityIds.size);
      const municipalityNameBn =
        municipalityUnions.map(({ union }) => union.bn).join(" · ") || "পৌরসভা";
      const municipalityNameEn =
        municipalityUnions.map(({ union }) => union.en).join(" · ") || "Municipality";
      labelBn =
        role === "municipal_executive_officer"
          ? `পৌর নির্বাহী কর্মকর্তা · ${municipalityNameBn}`
          : role === "city_corporation_ceo"
            ? `সিটি কর্পোরেশন · ${municipalityNameBn}`
            : municipalityNameBn;
      labelEn =
        role === "municipal_executive_officer"
          ? `PEO · ${municipalityNameEn}`
          : role === "city_corporation_ceo"
            ? `City Corporation · ${municipalityNameEn}`
            : municipalityNameEn;
      break;
    }
    case "city_zonal_officer": {
      level = "city_zone";
      const municipalityId =
        user?.unionId &&
        unionLocations.some(
          ({ union, municipality }) => municipality && union.id === user.unionId,
        )
          ? user.unionId
          : MOCK_ASSIGNMENTS.municipalityCode;
      const zoneWardParity = MOCK_ASSIGNMENTS.zoneCode === "zone-1" ? 1 : 0;
      const municipalityIds = new Set(
        unionLocations
          .filter(
            ({ union, municipality }) =>
              municipality && union.id === municipalityId,
          )
          .map(({ union }) => union.id),
      );
      selectedCases = sourceCases.filter(
        (item) =>
          municipalityIds.has(item.unionId) &&
          item.ward % 2 === zoneWardParity,
      );
      targetScale = Math.max(0.5, municipalityIds.size / 2);
      labelBn = `সিটি জোন ${zoneWardParity ? "১" : "২"}`;
      labelEn = `City Zone ${zoneWardParity ? "1" : "2"}`;
      break;
    }
    case "uno": {
      level = "upazila";
      const upazilaId = user?.upazilaId ?? fallbackUpazila?.id ?? MOCK_ASSIGNMENTS.upazilaCode;
      selectedCases = sourceCases.filter((item) => item.upazilaId === upazilaId);
      targetScale = Math.max(
        1,
        unionLocations.filter(({ upazila }) => upazila.id === upazilaId).length,
      );
      const upazila = upazilas.find((area) => area.id === upazilaId);
      labelBn = `${upazila?.bn ?? upazilaId} উপজেলা`;
      labelEn = `${upazila?.en ?? upazilaId} Upazila`;
      break;
    }
    case "ddlg":
    case "dc":
    case "ddlg_dc": {
      level = "district";
      const districtCode =
        user?.districtId ?? fallbackUpazila?.districtEn ?? MOCK_ASSIGNMENTS.districtCode;
      const districtAreas = upazilas.filter((area) => area.districtEn === districtCode);
      const districtIds = new Set(districtAreas.map((area) => area.id));
      selectedCases = sourceCases.filter((item) => districtIds.has(item.upazilaId));
      targetScale = Math.max(
        1,
        unionLocations.filter(({ upazila }) => districtIds.has(upazila.id)).length,
      );
      labelBn = `${districtAreas[0]?.districtBn ?? districtCode} জেলা`;
      labelEn = `${districtAreas[0]?.districtEn ?? districtCode} District`;
      break;
    }
    case "divisional_commissioner": {
      level = "division";
      const divisionCode = fallbackUpazila?.divisionEn ?? MOCK_ASSIGNMENTS.divisionCode;
      const divisionIds = new Set(
        upazilas.filter((area) => area.divisionEn === divisionCode).map((area) => area.id),
      );
      selectedCases = sourceCases.filter((item) => divisionIds.has(item.upazilaId));
      targetScale = Math.max(
        1,
        unionLocations.filter(({ upazila }) => divisionIds.has(upazila.id)).length,
      );
      labelBn = `${fallbackUpazila?.divisionBn ?? divisionCode} বিভাগ`;
      labelEn = `${divisionCode} Division`;
      break;
    }
    case "addl_registrar_general":
    case "registrar_general":
    case "main":
      level = "nationwide";
      targetScale = Math.max(1, unionLocations.length);
      break;
  }

  return { cases: selectedCases, level, targetScale, labelBn, labelEn };
}
