import { MapPinned } from "lucide-react";
import { useApp } from "@/lib/store";
import type { RegCase } from "@/lib/types";
import { buildWardKpis } from "@/lib/ward-kpi";

export function WardKpiPanel({ cases }: { cases: RegCase[] }) {
  const { L, n } = useApp();
  const wards = buildWardKpis(cases);
  if (!wards.length) return null;

  const totalPending = wards.reduce((sum, ward) => sum + ward.pending, 0);
  return (
    <section
      className="shrink-0 rounded-xl border border-emerald-200 bg-white/95 p-3 shadow-sm sm:p-4"
      aria-labelledby="ward-kpi-heading"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="ward-kpi-heading"
          className="flex items-center gap-2 text-sm font-bold text-emerald-950 sm:text-base"
        >
          <MapPinned className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          {L("ওয়ার্ডভিত্তিক অগ্রগতি ও SLA", "Ward-wise progress & SLA")}
        </h2>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-950">
          {L(`মোট অপেক্ষমাণ ${n(totalPending)}`, `Total pending ${n(totalPending)}`)}
        </span>
      </header>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {wards.map((ward) => {
          const progress = ward.total
            ? Math.round((ward.completed / ward.total) * 100)
            : 0;
          return (
            <article
              key={ward.ward}
              className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900">
                  {L(`ওয়ার্ড ${n(ward.ward)}`, `Ward ${n(ward.ward)}`)}
                </h3>
                <span className="text-xs font-semibold text-slate-600">
                  {L(`${n(ward.completed)} / ${n(ward.total)} সম্পন্ন`, `${n(ward.completed)} / ${n(ward.total)} complete`)}
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-label={L(`ওয়ার্ড ${n(ward.ward)} অগ্রগতি`, `Ward ${n(ward.ward)} progress`)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-800">
                  {L(`অপেক্ষমাণ ${n(ward.pending)}`, `Pending ${n(ward.pending)}`)}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-950">
                  {L(`০–৪৫ দিন ${n(ward.green)}`, `0–45 days ${n(ward.green)}`)}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-950">
                  {L(`৪৬–৩৬৫ দিন ${n(ward.yellow)}`, `46–365 days ${n(ward.yellow)}`)}
                </span>
                <span className="rounded-full bg-red-100 px-2 py-1 text-red-950">
                  {L(`৩৬৫ দিনের বেশি ${n(ward.red)}`, `Over 365 days ${n(ward.red)}`)}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
