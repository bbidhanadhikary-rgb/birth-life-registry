export type SavedRegistrationTarget = {
  union_id: string;
  birth_target: number;
  death_target: number;
  status: string;
  updated_at: string;
};

export type DemoRegistrationTarget = SavedRegistrationTarget & { union_name: string };

const DEMO_TARGETS_KEY = "monitoring-union-targets";

export function getDemoTargetsStorageKey(upazilaId: string, monthYear: string) {
  return `${DEMO_TARGETS_KEY}:${upazilaId}:${monthYear}`;
}

export function readDemoRegistrationTargets(
  upazilaId: string,
  monthYear: string,
): DemoRegistrationTarget[] {
  try {
    const stored = localStorage.getItem(getDemoTargetsStorageKey(upazilaId, monthYear));
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DemoRegistrationTarget =>
      typeof item === "object" && item !== null &&
      "union_id" in item && typeof item.union_id === "string" &&
      "union_name" in item && typeof item.union_name === "string" &&
      "birth_target" in item && typeof item.birth_target === "number" &&
      "death_target" in item && typeof item.death_target === "number" &&
      "status" in item && (item.status === "draft" || item.status === "submitted") &&
      "updated_at" in item && typeof item.updated_at === "string",
    );
  } catch (error) {
    console.error("Failed to read demo registration targets", error);
    return [];
  }
}

export function writeDemoRegistrationTargets(
  upazilaId: string,
  monthYear: string,
  targets: DemoRegistrationTarget[],
) {
  try {
    localStorage.setItem(
      getDemoTargetsStorageKey(upazilaId, monthYear),
      JSON.stringify(targets),
    );
    return true;
  } catch (error) {
    console.error("Failed to save demo registration targets", error);
    return false;
  }
}
