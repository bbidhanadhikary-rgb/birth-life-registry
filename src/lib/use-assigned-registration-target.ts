import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDhakaMonthYear } from "@/lib/monthly-targets";
import {
  DEMO_REGISTRATION_TARGETS_UPDATED_EVENT,
  getDemoTargetsStorageKey,
  readDemoRegistrationTargets,
} from "@/lib/registration-targets";
import { loadAssignedStationRegistrationTarget } from "@/lib/registration-targets.functions";
import {
  readStationLocalMetrics,
  STATION_METRICS_UPDATED_EVENT,
} from "@/lib/station-local-metrics";
import { useApp } from "@/lib/store";
import type { RegCase } from "@/lib/types";

type CaseCounts = {
  pending: number;
  progress: number;
  completed: number;
  total: number;
};

type StationMonthlyMetrics = {
  target: {
    unionId: string;
    monthYear: string;
    birth: number;
    death: number;
  } | null;
  counts: {
    birth: CaseCounts;
    death: CaseCounts;
  };
};

function monthKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function countStationCases(
  cases: RegCase[],
  upazilaId: string,
  stationId: string,
  monthYear: string,
) {
  const counts: StationMonthlyMetrics["counts"] = {
    birth: { pending: 0, progress: 0, completed: 0, total: 0 },
    death: { pending: 0, progress: 0, completed: 0, total: 0 },
  };
  const targetMonth = monthYear.slice(0, 7);
  for (const item of cases) {
    if (
      item.upazilaId !== upazilaId ||
      (item.stationId ?? item.unionId) !== stationId
    ) continue;

    const typeCounts = counts[item.type];
    if (
      item.status === "completed" &&
      (item.completedAt
        ? monthKey(new Date(item.completedAt)) === targetMonth
        : monthKey(new Date(item.createdAt)) === targetMonth)
    ) {
      typeCounts.completed += 1;
    }
    if (monthKey(new Date(item.createdAt)) !== targetMonth) continue;
    typeCounts.total += 1;
    if (item.status === "pending" || item.status === "progress") {
      typeCounts[item.status] += 1;
    }
  }
  return counts;
}

export function useAssignedRegistrationTarget(): StationMonthlyMetrics | null {
  const { L, user, demoMode, state } = useApp();
  const [metrics, setMetrics] = useState<StationMonthlyMetrics | null>(null);

  useEffect(() => {
    const stationId = user?.stationId ?? user?.unionId;
    if (!user || !["admin", "worker", "police"].includes(user.role) || !stationId) {
      setMetrics(null);
      return;
    }

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const monthYear = getDhakaMonthYear();
    const refresh = async () => {
      try {
        if (demoMode) {
          const saved = readDemoRegistrationTargets(user.upazilaId, monthYear)
            .find((item) => item.union_id === stationId && item.status === "submitted");
          if (active) {
            const local = readStationLocalMetrics(user.upazilaId, stationId, monthYear);
            const counts = countStationCases(state.cases, user.upazilaId, stationId, monthYear);
            const localCompleted = local.completedCount;
            if (localCompleted !== undefined) {
              counts.birth.completed = local.birthCompletedCount ?? localCompleted;
              counts.death.completed = local.deathCompletedCount ?? Math.max(0, localCompleted - counts.birth.completed);
            }
            setMetrics({
              target: saved || local.birthTarget !== undefined || local.deathTarget !== undefined ? {
                unionId: stationId,
                monthYear,
                birth: local.birthTarget ?? saved?.birth_target ?? 0,
                death: local.deathTarget ?? saved?.death_target ?? 0,
              } : null,
              counts,
            });
          }
          return;
        }

        const { data, error } = await supabase.rpc("station_monthly_dashboard_metrics", {
          _month_year: monthYear,
        });
        if (error) throw new Error(error.message);
        const row = data?.[0];
        if (!row) throw new Error("Station monthly metrics were not returned");
        if (active) {
          const local = readStationLocalMetrics(user.upazilaId, stationId, monthYear);
          const birth = {
            pending: row.birth_pending_count,
            progress: row.birth_progress_count,
            completed: row.birth_completed_count,
            total: row.birth_total_count,
          };
          const death = {
            pending: row.death_pending_count,
            progress: row.death_progress_count,
            completed: row.death_completed_count,
            total: row.death_total_count,
          };
          if (local.completedCount !== undefined) {
            birth.completed = local.birthCompletedCount ?? local.completedCount;
            death.completed = local.deathCompletedCount ?? Math.max(0, local.completedCount - birth.completed);
          }
          setMetrics({
            target: row.target_present || local.birthTarget !== undefined || local.deathTarget !== undefined ? {
              unionId: stationId,
              monthYear,
              birth: local.birthTarget ?? row.birth_target,
              death: local.deathTarget ?? row.death_target,
            } : null,
            counts: { birth, death },
          });
        }
      } catch (error) {
        if (!active) return;
        console.error("Failed to load station monthly metrics", error);
        toast.error(L("স্টেশনের মাসিক পরিসংখ্যান লোড করা যায়নি", "Could not load station monthly metrics"));
      }
    };

    setMetrics(null);
    void refresh();

    if (demoMode) {
      const onTargetsUpdated = () => void refresh();
      const onStorage = (event: StorageEvent) => {
        if (event.key === getDemoTargetsStorageKey(user.upazilaId, monthYear)) onTargetsUpdated();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(DEMO_REGISTRATION_TARGETS_UPDATED_EVENT, onTargetsUpdated);
      window.addEventListener(STATION_METRICS_UPDATED_EVENT, onTargetsUpdated);
      return () => {
        active = false;
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(DEMO_REGISTRATION_TARGETS_UPDATED_EVENT, onTargetsUpdated);
        window.removeEventListener(STATION_METRICS_UPDATED_EVENT, onTargetsUpdated);
      };
    }

    const refreshOnChange = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 150);
    };
    const channel = supabase
      .channel(`station-dashboard-metrics-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "station_metric_versions",
          filter: `upazila_id=eq.${user.upazilaId}`,
        },
        refreshOnChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registration_targets",
          filter: `upazila_id=eq.${user.upazilaId}`,
        },
        refreshOnChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cases",
          filter: `upazila_id=eq.${user.upazilaId}`,
        },
        refreshOnChange,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Station dashboard metrics subscription failed", status);
          toast.error(L("লাইভ স্টেশন পরিসংখ্যান সংযোগ ব্যর্থ হয়েছে", "Live station metrics connection failed"));
        }
      });

    const onLocalMetricsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ upazilaId?: string; stationId?: string; monthYear?: string }>).detail;
      if (detail?.upazilaId === user.upazilaId && detail?.stationId === stationId && detail?.monthYear === monthYear) {
        refreshOnChange();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key?.includes(`station-global-metrics:${user.upazilaId}:${stationId}:${monthYear}`)) refreshOnChange();
    };
    window.addEventListener(STATION_METRICS_UPDATED_EVENT, onLocalMetricsUpdated);
    window.addEventListener("storage", onStorage);

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener(STATION_METRICS_UPDATED_EVENT, onLocalMetricsUpdated);
      window.removeEventListener("storage", onStorage);
      void supabase.removeChannel(channel);
    };
  }, [L, demoMode, state.cases, user]);

  return metrics;
}
