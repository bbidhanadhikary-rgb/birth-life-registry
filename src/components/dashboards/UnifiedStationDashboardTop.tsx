import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useAssignedRegistrationTarget } from "@/lib/use-assigned-registration-target";
import { formatUnionFullName } from "@/lib/union-label";
import type { RegCase } from "@/lib/types";
import { MonthlyProgressCard, type MonthlyProgressCounts } from "./MonthlyProgressCard";

function monthKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export function UnifiedStationDashboardTop({ stationId: stationIdProp }: { stationId?: string }) {
  const { L, state, user } = useApp();
  const stationMetrics = useAssignedRegistrationTarget();
  const stationId = stationIdProp ?? user?.stationId ?? user?.unionId;
  const location = stationId
    ? state.upazilas
        .map((upazila) => ({
          upazila,
          union: upazila.unions.find((union) => union.id === stationId),
        }))
        .find((item) => item.union)
    : undefined;
  const fullStationName = location
    ? L(
        formatUnionFullName(location.union!, location.upazila.unions, location.upazila, "bn"),
        formatUnionFullName(location.union!, location.upazila.unions, location.upazila, "en"),
      )
    : L("মণিরামপুর, যশোর", "Manirampur, Jashore");

  const unifiedCases = useMemo(() => {
    if (!stationId) return [];
    return state.cases.filter((item) =>
      item.upazilaId === location?.upazila.id &&
      (item.stationId ?? item.unionId) === stationId,
    );
  }, [location?.upazila.id, state.cases, stationId]);

  const counts = useMemo<MonthlyProgressCounts>(() => {
    if (!stationIdProp && stationMetrics?.counts && user?.role && ["admin", "worker", "police"].includes(user.role)) {
      return stationMetrics.counts;
    }
    const currentMonth = monthKey(new Date());
    const monthly = unifiedCases.filter((item) => monthKey(new Date(item.createdAt)) === currentMonth);
    return {
      birth: {
        pending: monthly.filter((item) => item.type === "birth" && item.status === "pending").length,
        progress: monthly.filter((item) => item.type === "birth" && item.status === "progress").length,
        completed: monthly.filter((item) => item.type === "birth" && item.status === "completed").length,
        total: monthly.filter((item) => item.type === "birth").length,
      },
      death: {
        pending: monthly.filter((item) => item.type === "death" && item.status === "pending").length,
        progress: monthly.filter((item) => item.type === "death" && item.status === "progress").length,
        completed: monthly.filter((item) => item.type === "death" && item.status === "completed").length,
        total: monthly.filter((item) => item.type === "death").length,
      },
    };
  }, [stationIdProp, stationMetrics, unifiedCases, user?.role]);

  const targets = !stationIdProp && stationMetrics?.target
    ? { birth: stationMetrics.target.birth, death: stationMetrics.target.death }
    : { birth: 0, death: 0 };
  const received = unifiedCases.filter((item) => monthKey(new Date(item.createdAt)) === monthKey(new Date())).length;

  return (
    <div className="grid min-h-0 gap-1 sm:gap-2 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-3">
      <div className="flex min-h-0 flex-col justify-center">
        <p className="mb-1 max-w-3xl text-sm font-extrabold leading-snug text-emerald-950 sm:text-base">
          {fullStationName}
        </p>
        <h1 className="max-w-3xl font-display text-2xl font-bold leading-tight tracking-tight text-[#102a43] max-[360px]:text-xl sm:text-3xl lg:text-4xl">
          ই-নিবন্ধন ট্র্যাকার
        </h1>
        <p className="mt-1 max-w-3xl text-xs font-semibold leading-snug text-teal-800 max-[360px]:text-[11px] sm:text-sm lg:text-base">
          Birth &amp; Death Registration 365-Day Compliance System
        </p>
        <p className="mt-1 max-w-3xl text-[11px] font-medium leading-snug text-slate-700 sm:text-xs">
          {L(
            "জন্মের ৩৬৫ দিনের মধ্যে জন্ম ও মৃত্যু নিবন্ধন নিশ্চিতকরণ ব্যবস্থা",
            "A system to ensure birth and death registration within 365 days",
          )}
        </p>
      </div>
      <MonthlyProgressCard
        counts={counts}
        received={received}
        targets={targets}
        reportCases={unifiedCases as RegCase[]}
        reportsEnabled={true}
        featured
      />
    </div>
  );
}
