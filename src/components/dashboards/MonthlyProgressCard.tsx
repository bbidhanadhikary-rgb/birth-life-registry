import { useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  featured = false,
}: {
  counts: MonthlyProgressCounts;
  received: number;
  targets: { birth: number; death: number };
  warning?: string;
  compact?: boolean;
  featured?: boolean;
}) {
  const { L, n } = useApp();
  const [selectedReport, setSelectedReport] = useState<
    "overall" | "submitted" | "completed" | "progress" | null
  >(null);
  const now = new Date();
  const monthName = new Intl.DateTimeFormat(L("bn-BD", "en-US"), { month: "long" }).format(now);
  const remainingDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const gradientId = `monthly-progress-${useId().replaceAll(":", "")}`;
  const target = targets.birth + targets.death;
  const completed = counts.birth.completed + counts.death.completed;
  const submitted = counts.birth.pending + counts.death.pending;
  const inProgress = counts.birth.progress + counts.death.progress;
  const circumference = 2 * Math.PI * 88;
  const completion = target ? Math.round((completed / target) * 100) : 0;
  const completionArc = (Math.min(completed, target) / Math.max(1, target)) * circumference;
  const statusDetails = (status: keyof CaseTypeCounts) => [
    L(
      `জন্ম ${n(counts.birth[status])} / ${n(targets.birth)} (${n(targets.birth ? Math.round((counts.birth[status] / targets.birth) * 100) : 0)}%)`,
      `Birth ${n(counts.birth[status])} / ${n(targets.birth)} (${n(targets.birth ? Math.round((counts.birth[status] / targets.birth) * 100) : 0)}%)`,
    ),
    L(
      `মৃত্যু ${n(counts.death[status])} / ${n(targets.death)} (${n(targets.death ? Math.round((counts.death[status] / targets.death) * 100) : 0)}%)`,
      `Death ${n(counts.death[status])} / ${n(targets.death)} (${n(targets.death ? Math.round((counts.death[status] / targets.death) * 100) : 0)}%)`,
    ),
  ];
  const statusItems = [
    {
      id: "submitted",
      label: L("জমা হয়েছে", "Submitted"),
      value: submitted,
      details: statusDetails("pending"),
      classes: "border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-blue-500/10",
      dot: "bg-blue-500",
      text: "text-blue-800",
    },
    {
      id: "completed",
      label: L("নিবন্ধন সম্পন্ন", "Registrations completed"),
      value: completed,
      details: statusDetails("completed"),
      classes: "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-emerald-500/10",
      dot: "bg-emerald-500",
      text: "text-emerald-800",
    },
    {
      id: "progress",
      label: L("প্রক্রিয়াধীন", "In progress"),
      value: inProgress,
      details: statusDetails("progress"),
      classes: "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-amber-500/10",
      dot: "bg-amber-500",
      text: "text-amber-800",
    },
  ] as const;
  const selectedStatus =
    selectedReport && selectedReport !== "overall"
      ? statusItems.find((item) => item.id === selectedReport)
      : undefined;
  const reportStatuses = selectedStatus
    ? [selectedStatus]
    : statusItems;
  const countForStatus = (status: (typeof statusItems)[number]["id"], type: "birth" | "death") =>
    counts[type][status === "submitted" ? "pending" : status];

  return (
    <>
      <section
        className={`flex w-full flex-col rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/70 shadow-lg shadow-emerald-900/10 ${
          featured
            ? "gap-2 p-3 sm:min-h-[20rem] sm:gap-3 sm:p-4 xl:min-h-[22rem] xl:p-5"
            : compact
              ? "min-h-[17rem] gap-1.5 p-2.5 sm:min-h-[18rem] sm:gap-2 sm:p-3"
              : "min-h-[24rem] p-5 sm:min-h-[25rem] sm:p-6"
        }`}
        aria-label={L("চলতি মাসের কাজের অগ্রগতি", "Current month work progress")}
      >
      <div
        className={`grid flex-1 items-center ${
          compact
            ? "gap-1.5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-2"
            : featured
              ? "gap-2 sm:grid-cols-[minmax(12rem,0.9fr)_minmax(0,1.1fr)] sm:gap-4 xl:gap-6"
              : "gap-5 sm:grid-cols-[minmax(14rem,0.9fr)_minmax(0,1.1fr)] sm:gap-6"
        }`}
      >
        <div
          className={`flex min-w-0 flex-col items-center rounded-xl border border-slate-100 bg-white shadow-sm ${
            featured ? "gap-2 p-2 sm:gap-3 sm:p-3" : compact ? "gap-1.5 p-2" : "gap-3 p-4"
          }`}
        >
          <h2
            className={`text-center font-bold text-slate-800 ${
              featured ? "text-sm sm:text-lg xl:text-xl" : compact ? "text-sm" : "text-lg"
            }`}
          >
            {L(`${monthName} মাসের অগ্রগতি`, `${monthName} progress`)}
          </h2>
          <button
            type="button"
            onClick={() => setSelectedReport("overall")}
            className={`relative mx-auto shrink-0 cursor-pointer rounded-full transition-all hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
              featured
                ? "h-40 w-40 sm:h-52 sm:w-52 xl:h-60 xl:w-60"
                : compact
                  ? "h-44 w-44 sm:h-52 sm:w-52"
                  : "h-52 w-52 sm:h-56 sm:w-56"
            }`}
            aria-label={L("সামগ্রিক অগ্রগতির বিস্তারিত প্রতিবেদন দেখুন", "View overall progress report")}
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
              <circle
                cx="110"
                cy="110"
                r="88"
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={featured ? "22" : "20"}
              />
              <circle
                cx="110"
                cy="110"
                r="88"
                fill="none"
                stroke="#10b981"
                strokeWidth={featured ? "22" : "20"}
                strokeDasharray={`${completionArc} ${circumference - completionArc}`}
                className="drop-shadow-[0_0_5px_rgba(16,185,129,0.35)] transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`font-extrabold leading-none text-slate-800 ${
                  featured ? "text-3xl sm:text-4xl xl:text-5xl" : "text-3xl sm:text-4xl"
                }`}
              >
                {n(completion)}%
              </span>
              <span
                className={`font-semibold text-slate-500 ${
                  featured
                    ? "mt-1 text-xs sm:mt-2 sm:text-sm"
                    : compact
                      ? "mt-1 text-xs sm:text-sm"
                      : "mt-1 text-sm"
                }`}
              >
                {L("লক্ষ্যমাত্রা", "Monthly target")}
              </span>
            </div>
          </button>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p
            className={`monthly-remaining-pulse flex w-full items-center justify-center text-center font-extrabold text-emerald-700 ${
              compact ? "text-sm sm:text-lg" : "text-lg sm:text-xl"
            }`}
          >
            {L(
              `চলতি মাসের অবশিষ্ট সময়: ${n(remainingDays)} দিন`,
              `Time remaining this month: ${n(remainingDays)} days`,
            )}
          </p>
          <div
          className={`grid w-full font-bold text-slate-700 ${
            featured
              ? "gap-2 text-sm sm:gap-2.5 sm:text-base"
              : compact
                ? "gap-1.5 text-xs"
                : "gap-3 text-sm sm:text-base"
          }`}
        >
          {statusItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setSelectedReport(item.id)}
              aria-label={L(`${item.label} বিস্তারিত প্রতিবেদন দেখুন`, `View detailed ${item.label} report`)}
              className={`flex min-w-0 cursor-pointer items-center justify-between rounded-xl border shadow-md transition-all hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
                featured && item.details.length > 0
                  ? "gap-3 p-3 sm:gap-4 sm:p-4"
                  : featured
                    ? "gap-3 p-2.5 sm:gap-4 sm:p-3"
                    : compact
                      ? "gap-2 p-2"
                      : "gap-3 p-3"
              } ${item.classes}`}
            >
              <span
                className={`flex min-w-0 items-center font-semibold text-slate-700 ${
                  featured ? "gap-2.5" : compact ? "gap-1.5" : "gap-2"
                }`}
              >
                <span
                  className={`block shrink-0 rounded-full shadow-[0_0_10px_currentColor] ${
                    featured ? "h-3 w-3" : compact ? "h-2.5 w-2.5" : "h-3 w-3"
                  } ${item.dot}`}
                />
                <span>{item.label}</span>
              </span>
              <span className={`shrink-0 text-right ${item.text}`}>
                <span
                  className={`block font-extrabold ${
                    featured ? "text-lg sm:text-xl" : compact ? "text-sm" : "text-base sm:text-lg"
                  }`}
                >
                  {n(item.value)}
                </span>
                {item.details.length > 0 && (
                  <span
                    className={`mt-1 flex flex-wrap justify-end ${
                      featured ? "gap-1.5" : "gap-1"
                    }`}
                  >
                    {item.details.map((detail) => (
                      <span
                        key={detail}
                        className={`rounded-md border border-emerald-200/80 bg-white/80 font-semibold text-emerald-900 ${
                          featured
                            ? "px-2 py-1 text-[10px] leading-tight sm:text-xs"
                            : compact
                              ? "px-1 py-0.5 text-[9px] leading-tight sm:text-[10px]"
                              : "px-2 py-1 text-xs sm:text-sm"
                        }`}
                      >
                        {detail}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          ))}
          </div>
        </div>
      </div>
      <div
        className={`flex w-full flex-wrap justify-between border-t border-emerald-100 font-semibold text-slate-600 ${
          featured
            ? "gap-x-3 gap-y-1.5 px-1 pt-2 text-xs sm:pt-3 sm:text-sm"
            : compact
              ? "gap-x-2 gap-y-1 px-1 pt-2 text-[11px]"
              : "mt-4 gap-x-4 gap-y-2 px-2 pt-3 text-sm sm:text-base"
        }`}
      >
        <span>{L("মাসিক সম্পন্ন", "Completed this month")}: {n(completed)} / {n(target)}</span>
        <span>{L("মোট প্রাপ্ত আবেদন", "Total applications received")}: {n(received)}</span>
      </div>
      {warning && (
        <p
          className={`text-center font-medium text-amber-800 ${
            featured ? "text-xs sm:text-sm" : compact ? "text-xs" : "mt-2 text-sm"
          }`}
        >
          {warning}
        </p>
      )}
      </section>
      <Dialog open={selectedReport !== null} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedReport === "overall"
                ? L("চলতি মাসের অগ্রগতির বিস্তারিত", "Monthly progress details")
                : selectedStatus?.label}
            </DialogTitle>
            <DialogDescription>
              {L("জন্ম ও মৃত্যু আবেদনের মাসিক লক্ষ্যমাত্রার তুলনামূলক প্রতিবেদন।", "Monthly status report compared with birth and death targets.")}
            </DialogDescription>
          </DialogHeader>
          {selectedReport === "overall" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {reportStatuses.map((item) => (
                <div key={item.id} className={`rounded-lg border p-3 ${item.classes}`}>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm">
                    {L("মোট", "Total")}: {n(item.value)}
                  </p>
                  {item.details.map((detail) => (
                    <p key={detail} className="mt-1 text-xs text-slate-700">{detail}</p>
                  ))}
                </div>
              ))}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:col-span-2">
                <p className="font-semibold text-emerald-900">
                  {L("লক্ষ্যমাত্রা সম্পন্ন", "Target completed")}: {n(completed)} / {n(target)} ({n(completion)}%)
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {L("মোট প্রাপ্ত আবেদন", "Total applications received")}: {n(received)}
                </p>
              </div>
            </div>
          ) : selectedStatus ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["birth", "death"] as const).map((type) => {
                const value = countForStatus(selectedStatus.id, type);
                const typeTarget = targets[type];
                const percentage = typeTarget ? Math.round((value / typeTarget) * 100) : 0;
                return (
                  <div key={type} className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                    <p className="font-semibold text-emerald-950">
                      {type === "birth" ? L("জন্ম আবেদন", "Birth applications") : L("মৃত্যু আবেদন", "Death applications")}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {n(value)} / {n(typeTarget)} ({n(percentage)}%)
                    </p>
                  </div>
                );
              })}
              <p className="text-sm font-semibold text-slate-700 sm:col-span-2">
                {L("মোট", "Total")}: {n(selectedStatus.value)}
              </p>
            </div>
          ) : null}
          <Button variant="outline" onClick={() => setSelectedReport(null)} className="sm:ml-auto">
            {L("বন্ধ করুন", "Close")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
