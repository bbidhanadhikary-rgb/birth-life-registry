import { useId } from "react";
import { useApp } from "@/lib/store";

type MonthlyCounts = {
  pending: number;
  progress: number;
  completed: number;
};

export function MonthlyProgressCard({
  counts,
  received,
  target,
  warning,
}: {
  counts: MonthlyCounts;
  received: number;
  target: number;
  warning?: string;
}) {
  const { L, n } = useApp();
  const gradientId = `monthly-progress-${useId().replaceAll(":", "")}`;
  const total = Math.max(target, received, 1);
  const circumference = 2 * Math.PI * 88;
  const segments = [
    { id: "completed", value: counts.completed, color: "#10b981" },
    { id: "pending", value: counts.pending, color: "#3b82f6" },
    { id: "progress", value: counts.progress, color: "#f59e0b" },
  ];
  const completion = Math.min(100, Math.round((counts.completed / Math.max(1, target)) * 100));

  return (
    <section
      className="flex min-h-[24rem] w-full flex-col rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/70 p-5 shadow-lg shadow-emerald-900/10 sm:min-h-[25rem] sm:p-6"
      aria-label={L("চলতি মাসের কাজের অগ্রগতি", "Current month work progress")}
    >
      <h2 className="mb-4 text-center text-lg font-bold text-emerald-950 sm:text-left sm:text-xl">
        {L("চলতি মাসের কাজের অগ্রগতি", "Current month work progress")}
      </h2>
      <div className="grid flex-1 items-center gap-5 sm:grid-cols-[minmax(14rem,0.9fr)_minmax(0,1.1fr)] sm:gap-6">
        <div className="relative mx-auto h-52 w-52 shrink-0 sm:h-56 sm:w-56">
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
            <circle cx="110" cy="110" r="88" fill="none" stroke={`url(#${gradientId})`} strokeWidth="18" />
            {segments.map((segment, index) => {
              const length = (segment.value / total) * circumference;
              const offset = segments
                .slice(0, index)
                .reduce((sum, previous) => sum + (previous.value / total) * circumference, 0);
              return segment.value > 0 ? (
                <circle
                  key={segment.id}
                  cx="110"
                  cy="110"
                  r="88"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="18"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  className="drop-shadow-[0_0_5px_rgba(16,185,129,0.35)] transition-all duration-500"
                />
              ) : null;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold leading-none text-slate-800 sm:text-4xl">
              {n(completion)}%
            </span>
            <span className="mt-1 text-sm font-semibold text-slate-500">
              {L("লক্ষ্যমাত্রা", "Monthly target")}
            </span>
          </div>
        </div>
        <div className="grid w-full gap-3 text-sm font-bold text-slate-700 sm:text-base">
          {[
            {
              id: "pending",
              label: L("জমা হয়েছে", "Submitted"),
              value: counts.pending,
              classes: "border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-blue-500/10",
              dot: "bg-blue-500",
              text: "text-blue-800",
            },
            {
              id: "completed",
              label: L("নিবন্ধন সম্পন্ন", "Completed"),
              value: counts.completed,
              classes: "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-emerald-500/10",
              dot: "bg-emerald-500",
              text: "text-emerald-800",
            },
            {
              id: "progress",
              label: L("প্রক্রিয়াধীন", "In progress"),
              value: counts.progress,
              classes: "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-amber-500/10",
              dot: "bg-amber-500",
              text: "text-amber-800",
            },
          ].map((item) => (
            <div
              key={item.id}
              className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 shadow-md ${item.classes}`}
            >
              <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
                <span className={`block h-3 w-3 shrink-0 rounded-full shadow-[0_0_10px_currentColor] ${item.dot}`} />
                <span>{item.label}</span>
              </span>
              <span className={`shrink-0 text-right ${item.text}`}>
                <span className="block text-base font-extrabold sm:text-lg">{n(item.value)}</span>
                <span className="block text-xs font-bold sm:text-sm">
                  {n(((item.value / Math.max(1, target)) * 100).toFixed(1))}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex w-full flex-wrap justify-between gap-x-4 gap-y-2 border-t border-emerald-100 px-2 pt-3 text-sm font-semibold text-slate-600 sm:text-base">
        <span>{L("মাসিক সম্পন্ন", "Completed this month")}: {n(counts.completed)} / {n(target)}</span>
        <span>{L("মোট প্রাপ্ত আবেদন", "Total applications received")}: {n(received)}</span>
      </div>
      {warning && (
        <p className="mt-2 text-center text-sm font-medium text-amber-800">{warning}</p>
      )}
    </section>
  );
}
