import { useMemo } from "react";
import { AlertTriangle, CalendarClock, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCaseDeadline, STATUTORY_DEADLINE_DAYS } from "@/lib/compliance";
import type { RegCase, Upazila, Union } from "@/lib/types";
import { useApp } from "@/lib/store";
import { Stat } from "../shared";

interface CompliancePanelProps {
  upazila: Upazila;
  cases: RegCase[];
  selectedUnionId: string;
  onUnionChange: (id: string) => void;
  unions?: Union[];
  mode?: "full" | "alerts";
}

export function CompliancePanel({
  upazila,
  cases,
  selectedUnionId,
  onUnionChange,
  unions = upazila.unions,
  mode = "full",
}: CompliancePanelProps) {
  const { L, n } = useApp();
  const openCases = useMemo(() => cases.filter((c) => c.status !== "completed" && c.status !== "rejected"), [cases]);
  const deadlines = useMemo(
    () => new Map(openCases.map((c) => [c.id, getCaseDeadline(c)])),
    [openCases],
  );
  const { summaries, overdueCount, dueSoonCount, reviewCount } = useMemo(() => {
    const byUnion = new Map(
      unions.map((union) => [union.id, { union, onTrack: 0, dueSoon: 0, overdue: 0, review: 0 }]),
    );
    let overdue = 0,
      dueSoon = 0,
      review = 0;
    for (const c of openCases) {
      const summary = byUnion.get(c.unionId);
      const status = deadlines.get(c.id)?.status;
      if (!status) {
        review++;
        if (summary) summary.review++;
      } else if (status === "overdue") {
        overdue++;
        if (summary) summary.overdue++;
      } else if (status === "due-soon") {
        dueSoon++;
        if (summary) summary.dueSoon++;
      } else if (summary) summary.onTrack++;
    }
    return {
      summaries: [...byUnion.values()],
      overdueCount: overdue,
      dueSoonCount: dueSoon,
      reviewCount: review,
    };
  }, [unions, openCases, deadlines]);
  const alerts = useMemo(
    () =>
      openCases
        .filter((c) => selectedUnionId === "all" || c.unionId === selectedUnionId)
        .map((c) => ({ c, deadline: deadlines.get(c.id) ?? null }))
        .filter(({ deadline }) => !deadline || deadline.status !== "on-track")
        .sort((a, b) => {
          if (!a.deadline) return b.deadline ? 1 : 0;
          if (!b.deadline) return -1;
          return a.deadline.daysRemaining - b.deadline.daysRemaining;
        })
        .slice(0, 8),
    [openCases, selectedUnionId, deadlines],
  );

  return (
    <section
      className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="deadline-compliance-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="deadline-compliance-title" className="font-display text-xl font-bold">
            {mode === "alerts"
              ? L("জরুরি সময়সীমার সতর্কতা", "Deadline alerts")
              : L("৩৬৫ দিনের নিবন্ধন সময়সীমা", "365-day registration deadline")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {L(
              `${upazila.bn} উপজেলা · ${n(unions.length)}টি ইউনিয়ন/পৌরসভা · অনিবন্ধিত কেসের আইনি সময়সীমা`,
              `${upazila.en} Upazila · ${unions.length} unions/municipality · statutory deadline for unregistered cases`,
            )}
          </p>
        </div>
        <div
          className="-mx-1 flex max-w-full touch-pan-x gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2"
          role="group"
          aria-label={L("ইউনিয়ন ও পৌরসভা ফিল্টার", "Filter by union or municipality")}
        >
          <Button
            type="button"
            size="sm"
            variant={selectedUnionId === "all" ? "default" : "outline"}
            aria-pressed={selectedUnionId === "all"}
            onClick={() => onUnionChange("all")}
            className="h-11 shrink-0"
          >
            {L("সব এলাকা", "All areas")}
          </Button>
          {unions.map((union) => (
            <Button
              key={union.id}
              type="button"
              size="sm"
              variant={selectedUnionId === union.id ? "default" : "outline"}
              aria-pressed={selectedUnionId === union.id}
              onClick={() => onUnionChange(union.id)}
              className="h-11 shrink-0"
            >
              {L(union.bn, union.en)}
            </Button>
          ))}
        </div>
        <p className="mb-3 text-xs text-muted-foreground sm:hidden">
          {L("ইউনিয়ন বাছতে পাশের দিকে সরান", "Swipe horizontally to choose a union")}
        </p>
      </div>

      {mode === "full" && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label={L("নিবন্ধন অপেক্ষমাণ", "Awaiting registration")}
            value={n(openCases.length)}
          />
          <Stat
            label={L("সময়সীমা অতিক্রান্ত", "Past deadline")}
            value={n(overdueCount)}
            tone={overdueCount > 0 ? "danger" : undefined}
          />
          <Stat
            label={L("৩০ দিনের মধ্যে সময়সীমা", "Deadline within 30 days")}
            value={n(dueSoonCount)}
          />
          <Stat
            label={L("তারিখ যাচাই প্রয়োজন", "Occurrence date needs review")}
            value={n(reviewCount)}
            tone={reviewCount > 0 ? "danger" : undefined}
          />
        </div>
      )}

      <div
        className={
          mode === "full"
            ? "grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]"
            : "grid gap-5"
        }
      >
        {mode === "full" && (
          <div>
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" />
              {L("ইউনিয়নভিত্তিক অপেক্ষমাণ নিবন্ধন", "Outstanding registrations by union")}
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">
              {L(
                "৩৬৫ দিনের মধ্যে, ৩০ দিনের সতর্কতা, সময়সীমা অতিক্রান্ত ও তারিখ যাচাইয়ের সংখ্যা",
                "Within 365 days, 30-day warning, overdue and date-review counts",
              )}
            </p>
            <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
              {summaries.map(({ union, onTrack, dueSoon, overdue, review }) => {
                const total = onTrack + dueSoon + overdue + review;
                const accessibleSummary = L(
                  `${union.bn}: ${n(onTrack)}টি সময়সীমার মধ্যে, ${n(dueSoon)}টি শিগগির সময়সীমা, ${n(overdue)}টি অতিক্রান্ত, ${n(review)}টির তারিখ যাচাই প্রয়োজন`,
                  `${union.en}: ${onTrack} within deadline, ${dueSoon} due soon, ${overdue} overdue, ${review} need date review`,
                );
                return (
                  <div
                    key={union.id}
                    className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,2fr)_2.5rem] items-center gap-2 text-xs sm:grid-cols-[minmax(10rem,1fr)_minmax(0,3fr)_3rem]"
                  >
                    <span className="truncate" title={L(union.bn, union.en)}>
                      {L(union.bn, union.en)}
                    </span>
                    <div
                      className="flex h-4 overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={accessibleSummary}
                    >
                      {total > 0 && (
                        <>
                          {onTrack > 0 && (
                            <span
                              className="bg-primary"
                              title={L(
                                `${n(onTrack)}টি সময়সীমার মধ্যে`,
                                `${onTrack} within deadline`,
                              )}
                              style={{ width: `${(onTrack / total) * 100}%` }}
                            />
                          )}
                          {dueSoon > 0 && (
                            <span
                              className="bg-warning"
                              title={L(`${n(dueSoon)}টি শিগগির সময়সীমা`, `${dueSoon} due soon`)}
                              style={{ width: `${(dueSoon / total) * 100}%` }}
                            />
                          )}
                          {overdue > 0 && (
                            <span
                              className="bg-destructive"
                              title={L(`${n(overdue)}টি সময়সীমা অতিক্রান্ত`, `${overdue} overdue`)}
                              style={{ width: `${(overdue / total) * 100}%` }}
                            />
                          )}
                          {review > 0 && (
                            <span
                              className="bg-muted-foreground"
                              title={L(
                                `${n(review)}টির তারিখ যাচাই প্রয়োজন`,
                                `${review} need date review`,
                              )}
                              style={{ width: `${(review / total) * 100}%` }}
                            />
                          )}
                        </>
                      )}
                    </div>
                    <span className="text-right font-semibold tabular-nums">{n(total)}</span>
                  </div>
                );
              })}
            </div>
            <div
              className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"
              aria-label={L("চার্টের নির্দেশিকা", "Chart legend")}
            >
              {(
                [
                  ["bg-primary", L("সময়সীমার মধ্যে", "Within deadline")],
                  ["bg-warning", L("৩০ দিনের মধ্যে", "Due within 30 days")],
                  ["bg-destructive", L("অতিক্রান্ত", "Overdue")],
                  ["bg-muted-foreground", L("তারিখ যাচাই", "Date review")],
                ] as const
              ).map(([color, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${color}`} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {L("সময়সীমার সতর্কতা", "Deadline alerts")}
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            {L(
              "সময়সীমার সবচেয়ে কাছের কেসগুলো আগে দেখানো হচ্ছে",
              "Cases nearest to their deadline are listed first",
            )}
          </p>
          {alerts.length ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {alerts.map(({ c, deadline }) => {
                const union = unions.find((item) => item.id === c.unionId);
                const overdue = deadline?.status === "overdue";
                return (
                  <li
                    key={c.id}
                    className={`rounded-lg border p-3 ${overdue ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/10"}`}
                  >
                    <div className="flex items-start gap-2">
                      {!deadline ? (
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
                      ) : (
                        <AlertTriangle
                          className={`mt-0.5 h-4 w-4 shrink-0 ${overdue ? "text-destructive" : "text-warning-foreground"}`}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium">{L(c.name.bn, c.name.en)}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.type === "birth" ? L("জন্ম", "Birth") : L("মৃত্যু", "Death")}
                          {union && ` · ${L(union.bn, union.en)}`}
                          {` · ${L("ওয়ার্ড", "Ward")} ${n(c.ward)}`}
                        </div>
                        {deadline ? (
                          <div
                            className={`mt-1 text-xs font-semibold ${overdue ? "text-destructive" : "text-warning-foreground"}`}
                          >
                            {overdue
                              ? L(
                                  `${n(Math.abs(deadline.daysRemaining))} দিন সময়সীমা অতিক্রান্ত`,
                                  `${Math.abs(deadline.daysRemaining)} days past deadline`,
                                )
                              : L(
                                  `সময়সীমার ${n(deadline.daysRemaining)} দিন বাকি`,
                                  `${deadline.daysRemaining} days to deadline`,
                                )}
                            {` · ${L("শেষ তারিখ", "Due")} ${new Date(`${deadline.deadlineDate}T00:00:00Z`).toLocaleDateString(L("bn-BD", "en-GB"), { timeZone: "UTC" })}`}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs font-semibold text-warning-foreground">
                            {L(
                              "জন্ম/মৃত্যুর তারিখ অনুপস্থিত বা অবৈধ — যাচাই করুন",
                              "Birth/death date is missing or invalid — please review",
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {L(
                `নির্বাচিত এলাকার সব অনিবন্ধিত কেস ${STATUTORY_DEADLINE_DAYS} দিনের সময়সীমার মধ্যে রয়েছে।`,
                `All outstanding cases in this area are within the ${STATUTORY_DEADLINE_DAYS}-day deadline.`,
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
