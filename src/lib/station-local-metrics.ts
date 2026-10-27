const STORAGE_PREFIX = "station-global-metrics";
export const STATION_METRICS_UPDATED_EVENT = "station-global-metrics-updated";

export type StationLocalMetrics = {
  birthTarget?: number;
  deathTarget?: number;
  completedCount?: number;
  completedCaseIds?: string[];
};

function storageKey(upazilaId: string, stationId: string, monthYear: string) {
  return `${STORAGE_PREFIX}:${upazilaId}:${stationId}:${monthYear}`;
}

export function readStationLocalMetrics(
  upazilaId: string,
  stationId: string,
  monthYear: string,
): StationLocalMetrics {
  try {
    const raw = localStorage.getItem(storageKey(upazilaId, stationId, monthYear));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStationLocalMetrics(
  upazilaId: string,
  stationId: string,
  monthYear: string,
  metrics: StationLocalMetrics,
) {
  try {
    localStorage.setItem(storageKey(upazilaId, stationId, monthYear), JSON.stringify(metrics));
    window.dispatchEvent(new CustomEvent(STATION_METRICS_UPDATED_EVENT, {
      detail: { upazilaId, stationId, monthYear },
    }));
    return true;
  } catch {
    return false;
  }
}

export function writeStationLocalTarget(
  upazilaId: string,
  stationId: string,
  monthYear: string,
  birthTarget: number,
  deathTarget: number,
) {
  const current = readStationLocalMetrics(upazilaId, stationId, monthYear);
  return writeStationLocalMetrics(upazilaId, stationId, monthYear, {
    ...current,
    birthTarget,
    deathTarget,
  });
}

export function incrementStationCompletedCount(
  upazilaId: string,
  stationId: string,
  monthYear: string,
  caseId: string,
  databaseCompletedCount?: number,
) {
  const current = readStationLocalMetrics(upazilaId, stationId, monthYear);
  const completedCaseIds = current.completedCaseIds ?? [];
  if (completedCaseIds.includes(caseId)) return current.completedCount ?? databaseCompletedCount ?? 0;

  const nextCount = Math.max(
    current.completedCount ?? databaseCompletedCount ?? 0,
    databaseCompletedCount ?? 0,
  ) + 1;
  const nextIds = [...completedCaseIds, caseId];
  if (!writeStationLocalMetrics(upazilaId, stationId, monthYear, {
    ...current,
    completedCount: nextCount,
    completedCaseIds: nextIds,
  })) return databaseCompletedCount ?? nextCount;
  return nextCount;
}
