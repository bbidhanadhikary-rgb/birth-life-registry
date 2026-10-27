import type { Union, Upazila } from "@/lib/types";
import { MONIRAMPUR_STATIONS } from "@/lib/monirampur-stations";

const banglaDigits = (value: number) =>
  String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)] ?? digit);

export function getUnionLabel(id: string) {
  const station = MONIRAMPUR_STATIONS.find((item) => item.id === id);
  if (!station) return "ইউনিয়ন পরিষদ";
  if (station.type === "paurashava") return station.bn;
  return `${station.bn} ইউনিয়ন পরিষদ`;
}

export function formatUnionBadgeName(union: Union, unions: Union[]) {
  const knownLabel = getUnionLabel(union.id);
  if (knownLabel !== "ইউনিয়ন পরিষদ") return knownLabel;

  const name = union.bn.trim();
  if (
    !name ||
    name.toLocaleLowerCase() === union.id.toLocaleLowerCase() ||
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(name)
  ) {
    return "ইউনিয়ন পরিষদ";
  }
  if (/পৌরসভা$/.test(name) || /pourashava|municipality/i.test(`${union.id} ${union.en}`)) {
    return /পৌরসভা$/.test(name) ? name : `${name} পৌরসভা`;
  }

  const numberedName = /^(?:[০-৯]+|[0-9]+)\s*নং\s*/.test(name)
    ? name.replace(/^([0-9]+)/, (digits) => banglaDigits(Number(digits)))
    : `${banglaDigits(
        unions
          .filter(
            (item) =>
              !/পৌরসভা$/.test(item.bn) && !/pourashava|municipality/i.test(`${item.id} ${item.en}`),
          )
          .findIndex((item) => item.id === union.id) + 1,
      )} নং ${name}`;

  return `${numberedName.replace(/\s*ইউনিয়ন(?: পরিষদ)?$/, "")} ইউনিয়ন পরিষদ`;
}

export function formatUnionFullName(
  union: Union,
  unions: Union[],
  upazila: Upazila,
  language: "bn" | "en" = "bn",
) {
  if (language === "en") {
    const isMunicipality = /pourashava|municipality/i.test(`${union.id} ${union.en}`) || union.bn.includes("পৌরসভা");
    const stationName = union.en.trim()
      ? `${union.en.trim()}${isMunicipality ? " Municipality" : " Union Parishad"}`
      : "Union Parishad";
    return [stationName, upazila.en.trim(), upazila.districtEn.trim()].filter(Boolean).join(", ");
  }
  const stationName = formatUnionBadgeName(union, unions);
  return [stationName, upazila.bn.trim(), upazila.districtBn.trim()].filter(Boolean).join(", ");
}
