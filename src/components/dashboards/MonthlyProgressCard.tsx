import { useId } from "react";
import { useApp } from "@/lib/store";

type CaseTypeCounts = {
  pending: number;
  progress: number;
  completed: number;
};

export type MonthlyProgressCounts = {
  birth: CaseTypeCounts;
  death: CaseTypeCounts;
};

export function MonthlyProgressCard({
  counts,
  received,
  targets,
  warning,
  compact = false,
}: {
  counts: MonthlyProgressCounts;
  received: number;
  targets: { birth: number; death: number };
  warning?: string;
  compact?: boolean;
}) {
  const { L, n } = useApp();
  const gradientId = `monthly-progress-${useId().replaceAll(":", "")}`;
  const target = targets.birth + targets.death;
  const completed = counts.birth.completed + counts.death.completed;
  const submitted = counts.birth.pending + counts.death.pending;
  const inProgress = counts.birth.progress + counts.death.progress;
  const circumference = 2 * Math.PI * 88;
  const completion = target ? Math.round((completed / target) * 100) : 0;
  const completionArc = (Math.min(completed, target) / Math.max(1, target)) * circumference;
  const birthPercent = targets.birth
    ? Math.round((counts.birth.completed / targets.birth) * 100)
    : 0;
  const deathPercent = targets.death
    ? Math.round((counts.death.completed / targets.death) * 100)
    : 0;
  const statusItems = [
    {
      id: "submitted",
      label: L("জমা হয়েছে", "Submitted"),
      value: submitted,
      detail: "",
      classes: "border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-blue-500/10",
      dot: "bg-blue-500",
      text: "text-blue-800",
    },
    {
      id: "completed",
      label: L("নিবন্ধন সম্পন্ন", "Registrations completed"),
      value: completed,
      detail: L(
        `জন্ম ${n(counts.birth.completed)} / ${n(targets.birth)} (${n(birthPercent)}%) · মৃত্যু ${n(counts.death.completed)} / ${n(targets.death)} (${n(deathPercent)}%)`,
        `Birth ${n(counts.birth.completed)} / ${n(targets.birth)} (${n(birthPercent)}%) · Death ${n(counts.death.completed)} / ${n(targets.death)} (${n(deathPercent)}%)`,
      ),
      classes: "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-emerald-500/10",
      dot: "bg-emerald-500",
      text: "text-emerald-800",
    },
    {
      id: "progress",
      label: L("প্রক্রিয়াধীন", "In progress"),
      value: inProgress,
      detail: "",
      classes: "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-amber-500/10",
      dot: "bg-amber-500",
      text: "text-amber-800",
    },
  ];

  return (
    <section
      className={`flex w-full flex-col rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/70 shadow-lg shadow-emerald-900/10 ${
        compact
          ? "min-h-[17rem] gap-1.5 p-2.5 sm:min-h-[18rem] sm:gap-2 sm:p-3"
          : "min-h-[24rem] p-5 sm:min-h-[25rem] sm:p-6"
      }`}
      aria-label={L("চলতি মাসের কাজের অগ্রগতি", "Current month work progress")}
    >
      <h2
        className={`text-center font-bold text-emerald-950 sm:text-left ${
          compact ? "text-base" : "mb-4 text-lg sm:text-xl"
        }`}
      >
        {L("চলতি মাসের কাজের অগ্রগতি", "Current month work progress")}
      </h2>
      <div
        className={`grid flex-1 items-center ${
          compact
            ? "gap-1.5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-2"
            : "gap-5 sm:grid-cols-[minmax(14rem,0.9fr)_minmax(0,1.1fr)] sm:gap-6"
        }`}
      >
        <div
          className={`relative mx-auto shrink-0 ${
            compact ? "h-44 w-44 sm:h-52 sm:w-52" : "h-52 w-52 sm:h-56 sm:w-56"
          }`}
        >
          <svg
            viewBox="0 0 220 220"
            className="h-full w-full -rotate-90"
            role="img"
            aria-label={`${n(completion)}% ${L("মাসিক লক্ষ্যমাত্রা সম্পন্ন", "of monthly target completed")}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                <stop offset="35%" stopColor="#3b82f6" stopOpacity="0.32" />
                <stop offset="68%" stopColor="#f59e0b" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.32" />
              </linearGradient>
            </defs>
            <circle cx="110" cy="110" r="88" fill="none" stroke={`url(#${gradientId})`} strokeWidth="20" />
            <circle
              cx="110"
              cy="110"
              r="88"
              fill="none"
              stroke="#10b981"
              strokeWidth="20"
              strokeDasharray={`${completionArc} ${circumference - completionArc}`}
              className="drop-shadow-[0_0_5px_rgba(16,185,129,0.35)] transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold leading-none text-slate-800 sm:text-4xl">
              {n(completion)}%
            </span>
            <span className={`font-semibold text-slate-500 ${compact ? "mt-1 text-xs sm:text-sm" : "mt-1 text-sm"}`}>
              {L("লক্ষ্যমাত্রা", "Monthly target")}
            </span>
          </div>
        </div>
        <div
          className={`grid w-full font-bold text-slate-700 ${
            compact ? "gap-1.5 text-xs" : "gap-3 text-sm sm:text-base"
          }`}
        >
          {statusItems.map((item) => (
            <div
              key={item.id}
              className={`flex min-w-0 items-center justify-between rounded-xl border shadow-md ${
                compact ? "gap-2 p-2" : "gap-3 p-3"
              } ${item.classes}`}
            >
              <span className={`flex min-w-0 items-center font-semibold text-slate-700 ${compact ? "gap-1.5" : "gap-2"}`}>
                <span className={`block shrink-0 rounded-full shadow-[0_0_10px_currentColor] ${compact ? "h-2.5 w-2.5" : "h-3 w-3"} ${item.dot}`} />
                <span>{item.label}</span>
              </span>
              <span className={`shrink-0 text-right ${item.text}`}>
                <span className={`block font-extrabold ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
                  {n(item.value)}
                </span>
                {item.detail && (
                  <span className={`block max-w-64 whitespace-normal font-bold ${compact ? "text-[9px] leading-tight sm:text-[10px]" : "text-xs sm:text-sm"}`}>
                    {item.detail}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        className={`flex w-full flex-wrap justify-between border-t border-emerald-100 font-semibold text-slate-600 ${
          compact
            ? "gap-x-2 gap-y-1 px-1 pt-2 text-[11px]"
            : "mt-4 gap-x-4 gap-y-2 px-2 pt-3 text-sm sm:text-base"
        }`}
      >
        <span>{L("মাসিক সম্পন্ন", "Completed this month")}: {n(completed)} / {n(target)}</span>
        <span>{L("মোট প্রাপ্ত আবেদন", "Total applications received")}: {n(received)}</span>
      </div>
      {warning && (
        <p className={`text-center font-medium text-amber-800 ${compact ? "text-xs" : "mt-2 text-sm"}`}>
          {warning}
        </p>
      )}
    </section>
  );
}
