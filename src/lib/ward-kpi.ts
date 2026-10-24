import { getCaseDeadline } from "./compliance";
import type { RegCase } from "./types";

export type WardKpi = {
  ward: number;
  total: number;
  completed: number;
  pending: number;
  green: number;
  yellow: number;
  red: number;
};

export function buildWardKpis(cases: RegCase[], now = Date.now()): WardKpi[] {
  const byWard = new Map<number, WardKpi>();
  for (const item of cases) {
    const kpi = byWard.get(item.ward) ?? {
      ward: item.ward,
      total: 0,
      completed: 0,
      pending: 0,
      green: 0,
      yellow: 0,
      red: 0,
    };
    kpi.total += 1;
    if (item.status === "completed") {
      kpi.completed += 1;
    } else if (item.status !== "rejected") {
      kpi.pending += 1;
      const elapsedDays = getCaseDeadline(item, now)?.elapsedDays;
      if (elapsedDays !== undefined) {
        if (elapsedDays <= 45) kpi.green += 1;
        else if (elapsedDays <= 365) kpi.yellow += 1;
        else kpi.red += 1;
      }
    }
    byWard.set(item.ward, kpi);
  }
  return [...byWard.values()].sort((left, right) => left.ward - right.ward);
}
