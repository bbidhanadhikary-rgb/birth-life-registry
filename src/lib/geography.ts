import type { AdministrativeArea, Upazila } from "./types";
import rawBangladeshGeo from "./data/bangladesh-geo.json";

type NamedPlace = { name: string; bn_name: string };
type LocalPlace = NamedPlace & { category?: string };
type GeoUpazila = NamedPlace & { unions: NamedPlace[]; pourashavas: LocalPlace[] };
type GeoDistrict = NamedPlace & { upazilas: GeoUpazila[] };
type GeoDivision = NamedPlace & { districts: GeoDistrict[] };

const bangladeshGeo = rawBangladeshGeo as GeoDivision[];

const slug = (value: string) =>
  value
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const idFor = (...parts: string[]) => parts.map(slug).join(":");
const cityCorporationData = [
  { id: "barishal", bn: "বরিশাল সিটি কর্পোরেশন", en: "Barishal City Corporation", division: "Barisal", district: "Barisal", wardCount: 30 },
  { id: "chattogram", bn: "চট্টগ্রাম সিটি কর্পোরেশন", en: "Chattogram City Corporation", division: "Chattagram", district: "Chattogram", wardCount: 41 },
  { id: "dhaka-north", bn: "ঢাকা উত্তর সিটি কর্পোরেশন", en: "Dhaka North City Corporation", division: "Dhaka", district: "Dhaka", wardCount: 54 },
  { id: "dhaka-south", bn: "ঢাকা দক্ষিণ সিটি কর্পোরেশন", en: "Dhaka South City Corporation", division: "Dhaka", district: "Dhaka", wardCount: 75 },
  { id: "gazipur", bn: "গাজীপুর সিটি কর্পোরেশন", en: "Gazipur City Corporation", division: "Dhaka", district: "Gazipur", wardCount: 57 },
  { id: "khulna", bn: "খুলনা সিটি কর্পোরেশন", en: "Khulna City Corporation", division: "Khulna", district: "Khulna", wardCount: 31 },
  { id: "cumilla", bn: "কুমিল্লা সিটি কর্পোরেশন", en: "Cumilla City Corporation", division: "Chattagram", district: "Comilla", wardCount: 27 },
  { id: "mymensingh", bn: "ময়মনসিংহ সিটি কর্পোরেশন", en: "Mymensingh City Corporation", division: "Mymensingh", district: "Mymensingh", wardCount: 33 },
  { id: "narayanganj", bn: "নারায়ণগঞ্জ সিটি কর্পোরেশন", en: "Narayanganj City Corporation", division: "Dhaka", district: "Narayanganj", wardCount: 27 },
  { id: "rajshahi", bn: "রাজশাহী সিটি কর্পোরেশন", en: "Rajshahi City Corporation", division: "Rajshahi", district: "Rajshahi", wardCount: 30 },
  { id: "rangpur", bn: "রংপুর সিটি কর্পোরেশন", en: "Rangpur City Corporation", division: "Rangpur", district: "Rangpur", wardCount: 33 },
  { id: "sylhet", bn: "সিলেট সিটি কর্পোরেশন", en: "Sylhet City Corporation", division: "Sylhet", district: "Sylhet", wardCount: 42 },
] as const;

const nationalAreas: AdministrativeArea[] = (() => {
  const areas: AdministrativeArea[] = [];
  for (const division of bangladeshGeo) {
    const divisionId = `division:${slug(division.name)}`;
    areas.push({
      id: divisionId,
      level: "division",
      bn: division.bn_name,
      en: division.name,
      parentId: null,
      divisionId,
      districtId: null,
      cityCorporationId: null,
      municipalityId: null,
      upazilaId: null,
      unionId: null,
      wardNumber: null,
    });
    for (const district of division.districts) {
      const districtId = idFor("district", division.name, district.name);
      areas.push({
        id: districtId,
        level: "district",
        bn: district.bn_name,
        en: district.name,
        parentId: divisionId,
        divisionId,
        districtId,
        cityCorporationId: null,
        municipalityId: null,
        upazilaId: null,
        unionId: null,
        wardNumber: null,
      });
      for (const upazila of district.upazilas) {
        const upazilaId = idFor("upazila", division.name, district.name, upazila.name);
        areas.push({
          id: upazilaId,
          level: "upazila",
          bn: upazila.bn_name,
          en: upazila.name,
          parentId: districtId,
          divisionId,
          districtId,
          cityCorporationId: null,
          municipalityId: null,
          upazilaId,
          unionId: null,
          wardNumber: null,
        });
        const localAreas: {
          place: LocalPlace;
          level: "union" | "municipality";
          sourceIndex: number;
        }[] = [
          ...upazila.unions.map((place, sourceIndex) => ({
            place,
            level: "union" as const,
            sourceIndex,
          })),
          ...upazila.pourashavas.map((place, sourceIndex) => ({
            place,
            level: "municipality" as const,
            sourceIndex,
          })),
        ];
        for (const { place, level, sourceIndex } of localAreas) {
          const localAreaId = idFor(
            level,
            division.name,
            district.name,
            upazila.name,
            place.name,
            String(sourceIndex + 1),
          );
          areas.push({
            id: localAreaId,
            level,
            bn: place.bn_name,
            en: place.name,
            parentId: upazilaId,
            divisionId,
            districtId,
            cityCorporationId: null,
            municipalityId: level === "municipality" ? localAreaId : null,
            upazilaId,
            unionId: localAreaId,
            wardNumber: null,
            wardNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          });
        }
      }
    }
  }
  return areas;
})();

for (const cityCorporation of cityCorporationData) {
  const division = nationalAreas.find(
    (area) => area.level === "division" && area.en === cityCorporation.division,
  );
  const district = nationalAreas.find(
    (area) =>
      area.level === "district" &&
      area.en === cityCorporation.district &&
      area.divisionId === division?.id,
  );
  if (!division || !district) {
    throw new Error(`Administrative parent not found for ${cityCorporation.en}`);
  }
  nationalAreas.push({
    id: `city-corporation:${cityCorporation.id}`,
    level: "city_corporation",
    bn: cityCorporation.bn,
    en: cityCorporation.en,
    parentId: district.id,
    divisionId: division.id,
    districtId: district.id,
    cityCorporationId: `city-corporation:${cityCorporation.id}`,
    municipalityId: null,
    upazilaId: null,
    unionId: null,
    wardNumber: null,
    wardCount: cityCorporation.wardCount,
  });
}

export const BANGLADESH_ADMINISTRATIVE_AREAS = nationalAreas;

export function getAdministrativeWards(localAreaId: string): AdministrativeArea[] {
  const localArea = BANGLADESH_ADMINISTRATIVE_AREAS.find(
    (area) =>
      area.id === localAreaId &&
      (area.level === "union" ||
        area.level === "municipality" ||
        area.level === "city_corporation"),
  );
  if (!localArea) return [];
  const wardNumbers =
    localArea.wardCount === undefined
      ? (localArea.wardNumbers ?? [])
      : Array.from({ length: localArea.wardCount }, (_, index) => index + 1);
  return wardNumbers.map((wardNumber) => ({
    id: `${localArea.id}:ward-${wardNumber}`,
    level: "ward",
    bn: `ওয়ার্ড ${wardNumber}`,
    en: `Ward ${wardNumber}`,
    parentId: localArea.id,
    divisionId: localArea.divisionId,
    districtId: localArea.districtId,
    municipalityId: localArea.municipalityId,
    upazilaId: localArea.upazilaId,
    cityCorporationId: localArea.cityCorporationId ?? null,
    unionId: localArea.unionId,
    wardNumber,
  }));
}

export function sameAdministrativeName(left: string, right: string): boolean {
  const normalize = (value: string) => {
    const normalized = value
      .normalize("NFKD")
      .toLocaleLowerCase("en")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
      .replace(/^\s*\d+\s*(?:no\.?|number|নং)\s*/i, "")
      .replace(/\b(?:pourashava|municipality|union|upazila)\b/gi, " ")
      .replace(/(?:পৌরসভা|ইউনিয়ন|ইউনিয়ন|উপজেলা)/g, " ")
      .replace(/[^a-z0-9\u0980-\u09ff]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
    const aliases: Record<string, string> = {
      barisal: "barishal",
      chattagram: "chattogram",
      chittagong: "chattogram",
      comilla: "cumilla",
      jessore: "jashore",
    };
    return aliases[normalized] ?? normalized;
  };
  return normalize(left) === normalize(right);
}

function registeredUpazilaMatches(
  registered: Upazila,
  administrativeUpazila: AdministrativeArea,
): boolean {
  const district = BANGLADESH_ADMINISTRATIVE_AREAS.find(
    (area) => area.id === administrativeUpazila.districtId,
  );
  const division = BANGLADESH_ADMINISTRATIVE_AREAS.find(
    (area) => area.id === administrativeUpazila.divisionId,
  );
  return !!district && !!division &&
    (sameAdministrativeName(registered.en, administrativeUpazila.en) ||
      sameAdministrativeName(registered.bn, administrativeUpazila.bn)) &&
    (sameAdministrativeName(registered.districtEn, district.en) ||
      sameAdministrativeName(registered.districtBn, district.bn)) &&
    (sameAdministrativeName(registered.divisionEn, division.en) ||
      sameAdministrativeName(registered.divisionBn, division.bn));
}

export function filterCasesByAdministrativeArea<
  T extends { upazilaId: string; unionId: string; ward: number },
>(
  cases: T[],
  registeredUpazilas: Upazila[],
  filters: {
    division: string;
    district: string;
    upazila: string;
    union: string;
    ward?: string;
  },
): T[] {
  if (
    filters.division === "all" &&
    filters.district === "all" &&
    filters.upazila === "all" &&
    filters.union === "all" &&
    (!filters.ward || filters.ward === "all")
  ) return cases;

  const selectedArea = BANGLADESH_ADMINISTRATIVE_AREAS.find(
    (area) =>
      area.id === filters.upazila &&
      (area.level === "upazila" || area.level === "city_corporation"),
  );
  if (selectedArea?.level === "city_corporation") return [];

  const selectedUpazilas = BANGLADESH_ADMINISTRATIVE_AREAS.filter(
    (area) =>
      area.level === "upazila" &&
      (filters.division === "all" || area.divisionId === filters.division) &&
      (filters.district === "all" || area.districtId === filters.district) &&
      (filters.upazila === "all" || area.id === filters.upazila),
  );
  const registeredInScope = registeredUpazilas.filter((registered) =>
    selectedUpazilas.some((area) => registeredUpazilaMatches(registered, area)),
  );
  const upazilaIds = new Set(registeredInScope.map((area) => area.id));
  const selectedUnion = BANGLADESH_ADMINISTRATIVE_AREAS.find(
    (area) =>
      area.id === filters.union && (area.level === "union" || area.level === "municipality"),
  );
  const selectedWardOptions = getAdministrativeWards(selectedUnion?.id ?? "");
  const selectedWardNumber = (() => {
    if (!filters.ward || filters.ward === "all") return undefined;
    const selectedWard = selectedWardOptions.find((area) => area.id === filters.ward);
    if (selectedWard) return selectedWard.wardNumber ?? undefined;
    if (!selectedUnion) {
      const genericWard = /^ward-(\d+)$/.exec(filters.ward);
      const wardNumber = genericWard ? Number(genericWard[1]) : Number.NaN;
      if (Number.isInteger(wardNumber) && wardNumber >= 1 && wardNumber <= 9) return wardNumber;
    }
    return null;
  })();
  if (selectedWardNumber === null) return [];
  if (!selectedUnion) {
    return cases.filter(
      (item) =>
        upazilaIds.has(item.upazilaId) &&
        (selectedWardNumber === undefined || item.ward === selectedWardNumber),
    );
  }
  const sameNameUnions = BANGLADESH_ADMINISTRATIVE_AREAS.filter(
    (area) =>
      area.level === selectedUnion.level &&
      area.parentId === selectedUnion.parentId &&
      (sameAdministrativeName(area.en, selectedUnion.en) ||
        sameAdministrativeName(area.bn, selectedUnion.bn)),
  );
  const selectedUnionOccurrence = sameNameUnions.findIndex(
    (area) => area.id === selectedUnion.id,
  );
  const unionIds = new Set(
    registeredInScope
      .filter((registered) =>
        selectedUpazilas.some(
          (area) => area.id === selectedUnion.parentId && registeredUpazilaMatches(registered, area),
        ),
      )
      .flatMap((registered) => {
        const sameNameRegisteredUnions = registered.unions.filter(
          (registeredUnion) =>
            sameAdministrativeName(registeredUnion.en, selectedUnion.en) ||
            sameAdministrativeName(registeredUnion.bn, selectedUnion.bn),
        );
        const match = sameNameRegisteredUnions[selectedUnionOccurrence];
        return match ? [match.id] : [];
      }),
  );
  return cases.filter(
    (item) =>
      upazilaIds.has(item.upazilaId) &&
      unionIds.has(item.unionId) &&
      (selectedWardNumber === undefined || item.ward === selectedWardNumber),
  );
}

export function buildAdministrativeAreas(upazilas: Upazila[]): AdministrativeArea[] {
  const areas: AdministrativeArea[] = [];
  const divisions = new Map<string, AdministrativeArea>();
  const districts = new Map<string, AdministrativeArea>();

  for (const upazila of upazilas) {
    const divisionKey = upazila.divisionEn;
    let division = divisions.get(divisionKey);
    if (!division) {
      division = {
        id: `division:${slug(divisionKey)}`,
        level: "division",
        bn: upazila.divisionBn,
        en: divisionKey,
        parentId: null,
        divisionId: "",
        districtId: null,
        cityCorporationId: null,
        municipalityId: null,
        upazilaId: null,
        unionId: null,
        wardNumber: null,
      };
      division.divisionId = division.id;
      divisions.set(divisionKey, division);
      areas.push(division);
    }

    const districtKey = `${divisionKey}\u0000${upazila.districtEn}`;
    let district = districts.get(districtKey);
    if (!district) {
      district = {
        id: `district:${slug(divisionKey)}:${slug(upazila.districtEn)}`,
        level: "district",
        bn: upazila.districtBn,
        en: upazila.districtEn,
        parentId: division.id,
        divisionId: division.id,
        districtId: "",
        cityCorporationId: null,
        municipalityId: null,
        upazilaId: null,
        unionId: null,
        wardNumber: null,
      };
      district.districtId = district.id;
      districts.set(districtKey, district);
      areas.push(district);
    }

    areas.push({
      id: `upazila:${upazila.id}`,
      level: "upazila",
      bn: upazila.bn,
      en: upazila.en,
      parentId: district.id,
      divisionId: division.id,
      districtId: district.id,
      cityCorporationId: null,
      municipalityId: null,
      upazilaId: upazila.id,
      unionId: null,
      wardNumber: null,
    });

    for (const localArea of upazila.unions) {
      const municipality = /পৌরসভা|pourashava/i.test(`${localArea.bn} ${localArea.en}`);
      const localId = `${municipality ? "municipality" : "union"}:${upazila.id}:${localArea.id}`;
      areas.push({
        id: localId,
        level: municipality ? "municipality" : "union",
        bn: localArea.bn,
        en: localArea.en,
        parentId: `upazila:${upazila.id}`,
        divisionId: division.id,
        districtId: district.id,
        cityCorporationId: null,
        municipalityId: municipality ? localId : null,
        upazilaId: upazila.id,
        unionId: localArea.id,
        wardNumber: null,
      });
      for (let wardNumber = 1; wardNumber <= 9; wardNumber++) {
        areas.push({
          id: `ward:${upazila.id}:${localArea.id}:${wardNumber}`,
          level: "ward",
          bn: `ওয়ার্ড ${wardNumber}`,
          en: `Ward ${wardNumber}`,
          parentId: localId,
          divisionId: division.id,
          districtId: district.id,
          cityCorporationId: null,
          municipalityId: municipality ? localId : null,
          upazilaId: upazila.id,
          unionId: localArea.id,
          wardNumber,
        });
      }
    }
  }

  return areas;
}
