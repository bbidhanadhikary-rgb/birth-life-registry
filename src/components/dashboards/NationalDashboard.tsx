import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  ClipboardList,
  FileWarning,
  MapPinned,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCaseDeadline } from "@/lib/compliance";
import { roleLabel, scopedCases, useApp } from "@/lib/store";
import { TARGET, type Role, type Upazila } from "@/lib/types";
import { MonthlyProgressCard } from "@/components/dashboards/MonthlyProgressCard";
import { WardKpiPanel } from "@/components/dashboards/WardKpiPanel";
import { MonitoringTargetEntry } from "@/components/dashboards/MonitoringTargetEntry";

type DashboardSection = "unions" | "compliance" | "alerts" | "records" | "users";

function monthKey(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).format(timestamp);
}

export function NationalDashboard() {
  const {
    announcements,
    L,
    n,
    saveAnnouncement,
    state,
    user,
  } = useApp();
  const [noticeBn, setNoticeBn] = useState("");
  const [noticeEn, setNoticeEn] = useState("");
  const [noticeActive, setNoticeActive] = useState(true);
  const [savingNotice, setSavingNotice] = useState(false);
  const [submittedTargets, setSubmittedTargets] = useState<{ birth: number; death: number } | null>(null);

  const selectableUpazilas = useMemo(() => {
    if (!user) return [];
    if (user.role === "super") return state.upazilas;
    if (user.role === "district") {
      return state.upazilas.filter((upazila) => upazila.districtEn === user.districtId);
    }
    return state.upazilas.filter((upazila) => upazila.id === user.upazilaId);
  }, [state.upazilas, user]);

  const selectedNotice = announcements.find((item) => item.upazilaId === user?.upazilaId);

  useEffect(() => {
    setNoticeBn(selectedNotice?.noticeBn ?? "");
    setNoticeEn(selectedNotice?.noticeEn ?? "");
    setNoticeActive(selectedNotice?.active ?? true);
  }, [selectedNotice]);

  const cases = useMemo(() => (user ? scopedCases(state, user) : []), [state, user]);
  const visibleCases = cases;
  const outstanding = visibleCases.filter((item) => item.status !== "completed" && item.status !== "rejected");
  const deadlines = useMemo(
    () =>
      outstanding
        .map((item) => ({ item, deadline: getCaseDeadline(item) }))
        .filter((row) => row.deadline === null || row.deadline.status !== "on-track")
        .sort((a, b) => {
          if (!a.deadline) return b.deadline ? -1 : 0;
          if (!b.deadline) return 1;
          return a.deadline.daysRemaining - b.deadline.daysRemaining;
        }),
    [outstanding],
  );
  const complianceCount = visibleCases.filter((item) => {
    const deadline = getCaseDeadline(item, item.completedAt ?? Date.now());
    return deadline !== null && deadline.status !== "overdue";
  }).length;
  const compliancePercent = visibleCases.length
    ? Math.round((complianceCount / visibleCases.length) * 100)
    : 0;

  const effectiveUnions = selectableUpazilas.reduce(
    (count, upazila) =>
      count +
      upazila.unions.filter(
        (union) =>
          !user || !["worker", "police", "admin"].includes(user.role) || union.id === user.unionId,
      ).length,
    0,
  );
  const currentMonthCases = visibleCases.filter(
    (item) => monthKey(item.createdAt) === monthKey(Date.now()),
  );
  const monthlyCounts = {
    birth: {
      pending: currentMonthCases.filter((item) => item.type === "birth" && item.status === "pending").length,
      progress: currentMonthCases.filter((item) => item.type === "birth" && item.status === "progress").length,
      completed: currentMonthCases.filter((item) => item.type === "birth" && item.status === "completed").length,
    },
    death: {
      pending: currentMonthCases.filter((item) => item.type === "death" && item.status === "pending").length,
      progress: currentMonthCases.filter((item) => item.type === "death" && item.status === "progress").length,
      completed: currentMonthCases.filter((item) => item.type === "death" && item.status === "completed").length,
    },
  };
  const completedThisMonth = monthlyCounts.birth.completed + monthlyCounts.death.completed;
  const defaultMonthlyTargets = {
    birth: Math.ceil(effectiveUnions * TARGET.birth),
    death: Math.ceil(effectiveUnions * TARGET.death),
  };
  const monthlyTargets = submittedTargets ?? defaultMonthlyTargets;
  const monthlyTarget = monthlyTargets.birth + monthlyTargets.death;
  const targetPercent = monthlyTarget
    ? Math.round((completedThisMonth / monthlyTarget) * 100)
    : 0;

  const performance = useMemo(() => {
    const map = new Map<string, { label: string; total: number; compliant: number }>();
    for (const item of visibleCases) {
      const upazila = state.upazilas.find((area) => area.id === item.upazilaId);
      if (!upazila) continue;
      const union = upazila.unions.find((area) => area.id === item.unionId);
      const useUnion = selectableUpazilas.length === 1;
      const key = useUnion ? item.unionId : upazila.id;
      const label = useUnion
        ? union
          ? L(union.bn, union.en)
          : item.unionId
        : L(upazila.bn, upazila.en);
      const group = map.get(key) ?? { label, total: 0, compliant: 0 };
      group.total++;
      const deadline = getCaseDeadline(item, item.completedAt ?? Date.now());
      if (deadline && deadline.status !== "overdue") group.compliant++;
      map.set(key, group);
    }
    return [...map.values()]
      .map((item) => ({
        ...item,
        percent: item.total ? Math.round((item.compliant / item.total) * 100) : 0,
      }))
      .sort((a, b) => b.percent - a.percent || b.total - a.total)
      .slice(0, 5);
  }, [L, selectableUpazilas.length, state.upazilas, visibleCases]);

  const sections: { section: DashboardSection; title: string; Icon: typeof MapPinned }[] = [
    { section: "unions", title: L("এলাকাভিত্তিক প্রতিবেদন", "Area-wise report"), Icon: MapPinned },
    {
      section: "compliance",
      title: L("৩৬৫ দিনের পর্যবেক্ষণ", "365-day monitor"),
      Icon: CalendarClock,
    },
    { section: "alerts", title: L("সতর্কতা তালিকা", "Overdue alerts"), Icon: FileWarning },
    {
      section: "records",
      title:
        user?.role === "worker" || user?.role === "police"
          ? L("তথ্য এন্ট্রি / অনুমোদন", "Data entry / review")
          : L("নিবন্ধন রেকর্ড", "Registration records"),
      Icon: ClipboardList,
    },
    ...(user?.role === "super"
      ? [
          {
            section: "users" as const,
            title: L("ব্যবহারকারী ব্যবস্থাপনা", "User management"),
            Icon: Users,
          },
        ]
      : []),
  ];
  const roleSections: Record<Role, DashboardSection[]> = {
    worker: ["records"],
    police: ["records"],
    admin: ["unions", "compliance", "alerts", "records"],
    district: ["unions", "compliance", "alerts", "records"],
    uno: ["unions", "compliance", "alerts", "records"],
    super: ["unions", "compliance", "alerts", "records", "users"],
  };
  const availableSections = user ? roleSections[user.role] : [];
  const links = sections.filter((entry) => availableSections.includes(entry.section));
  const quickLinks = links.filter((entry) => entry.section !== "users").slice(0, 4);

  const saveNotice = async () => {
    if (!user || user.role !== "uno") return;
    setSavingNotice(true);
    const saved = await saveAnnouncement(user.upazilaId, noticeBn, noticeEn, noticeActive);
    setSavingNotice(false);
    if (saved) toast.success(L("বিজ্ঞপ্তি সংরক্ষণ হয়েছে", "Notice saved"));
  };

  return (
    <div className="national-dashboard mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-2 overflow-y-auto px-4 py-2 sm:px-6 lg:px-8">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
            {L("জাতীয় জন্ম ও মৃত্যু নিবন্ধন", "National Birth & Death Registration")}
          </p>
          <h1 className="font-display text-xl font-bold sm:text-2xl">
            {L("স্বাগতম, ", "Welcome, ")}
            {L(user?.name.bn ?? "", user?.name.en ?? "")}
          </h1>
        </div>
        <span className="rounded-full border border-teal-800/15 bg-teal-800/5 px-3 py-1 text-xs font-semibold text-teal-900 dark:text-teal-100">
          {user ? roleLabel(user.role, L) : ""}
        </span>
      </div>

      <MonthlyProgressCard
        counts={monthlyCounts}
        received={currentMonthCases.length}
        targets={monthlyTargets}
        reportCases={visibleCases}
        reportsEnabled={!!user && ["admin", "district", "uno", "super"].includes(user.role)}
        compact
      />
      <MonitoringTargetEntry onSubmittedTargets={setSubmittedTargets} />
      <section
        className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4"
        aria-label={L("মূল সূচক", "Key indicators")}
      >
        <Metric
          label={L("মোট নিবন্ধন", "Total registrations")}
          value={n(visibleCases.length)}
          detail={L("জন্ম ও মৃত্যু", "Birth and death")}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <Metric
          label={L("৩৬৫ দিনের সম্মতি", "365-day compliance")}
          value={`${n(compliancePercent)}%`}
          detail={L(`${n(complianceCount)}টি সম্মত রেকর্ড`, `${complianceCount} compliant records`)}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <Metric
          label={L("অপেক্ষমাণ / অতিক্রান্ত", "Pending / overdue")}
          value={n(outstanding.length)}
          detail={L(
            `${n(deadlines.filter((row) => row.deadline?.status === "overdue").length)}টি অতিক্রান্ত`,
            `${deadlines.filter((row) => row.deadline?.status === "overdue").length} overdue`,
          )}
          icon={<BellRing className="h-4 w-4" />}
          danger={deadlines.some((row) => row.deadline?.status === "overdue")}
        />
        <Metric
          label={L("মাসিক লক্ষ্যমাত্রা", "Monthly target")}
          value={monthlyTarget ? `${n(targetPercent)}%` : "—"}
          detail={
            monthlyTarget
              ? L(
                  `${n(completedThisMonth)} / ${n(monthlyTarget)} নিবন্ধিত`,
                  `${n(completedThisMonth)} / ${n(monthlyTarget)} completed`,
                )
              : L("এলাকা নির্বাচন করুন", "Select an area")
          }
          icon={<Check className="h-4 w-4" />}
        />
      </section>
      <WardKpiPanel cases={visibleCases} />

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">
                {L("আঞ্চলিক অগ্রগতি ও র‌্যাঙ্কিং", "Regional performance")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {L("৩৬৫ দিনের সম্মতি অনুযায়ী শীর্ষ এলাকা", "Top areas by 365-day compliance")}
              </p>
            </div>
            <Link
              to="/dashboard/$section"
              params={{ section: "unions" }}
              className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-teal-800 hover:underline dark:text-teal-300"
            >
              {L("বিস্তারিত", "Details")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {performance.length ? (
            <ol className="space-y-2">
              {performance.map((item, index) => (
                <li
                  key={item.label}
                  className="grid grid-cols-[1.1rem_minmax(0,1fr)_2.8rem] items-center gap-2 text-sm"
                >
                  <span className="text-xs font-semibold text-muted-foreground">
                    {n(index + 1)}
                  </span>
                  <div className="min-w-0">
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {n(item.total)}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
                      role="progressbar"
                      aria-label={`${item.label} ${L("সম্মতি", "compliance")}`}
                      aria-valuenow={item.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-teal-700"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-right text-xs font-bold tabular-nums">
                    {n(item.percent)}%
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {L("নির্বাচিত এলাকায় কোনো নিবন্ধন নেই", "No registrations in this area")}
            </p>
          )}
        </section>

        <section className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">{L("সময়সীমা সতর্কতা", "Deadline alerts")}</h2>
              <p className="text-xs text-muted-foreground">
                {L("অতিক্রান্ত অথবা ৩০ দিনের মধ্যে", "Overdue or due within 30 days")}
              </p>
            </div>
            <Link
              to="/dashboard/$section"
              params={{ section: "alerts" }}
              className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-teal-800 hover:underline dark:text-teal-300"
            >
              {L("সব দেখুন", "View all")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="max-h-44 space-y-1 overflow-y-auto">
            {deadlines.slice(0, 5).map(({ item, deadline }) => {
              const area = state.upazilas.find((upazila) => upazila.id === item.upazilaId);
              const union = area?.unions.find((candidate) => candidate.id === item.unionId);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-sm dark:bg-rose-950/35"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {L(item.name.bn, item.name.en)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {union ? L(union.bn, union.en) : area ? L(area.bn, area.en) : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-right text-xs font-semibold ${
                      !deadline || deadline.status === "overdue"
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    {!deadline
                      ? L("তথ্য যাচাই প্রয়োজন", "Date needs review")
                      : deadline.status === "overdue"
                        ? L(
                            `${n(Math.abs(deadline.daysRemaining))} দিন পার`,
                            `${Math.abs(deadline.daysRemaining)} days overdue`,
                          )
                        : L(
                            `${n(deadline.daysRemaining)} দিন বাকি`,
                            `${deadline.daysRemaining} days left`,
                          )}
                  </span>
                </li>
              );
            })}
            {!deadlines.length && (
              <li className="rounded-lg bg-teal-50 px-3 py-5 text-center text-sm text-teal-900 dark:bg-teal-950/30 dark:text-teal-200">
                {L(
                  "এই নির্বাচনে কোনো সময়সীমা সতর্কতা নেই",
                  "No deadline alerts in this selection",
                )}
              </li>
            )}
          </ul>
        </section>
      </div>

      <section className="shrink-0" aria-label={L("দ্রুত নেভিগেশন", "Quick navigation")}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map(({ section, title, Icon }) => (
            <Link
              key={section}
              to="/dashboard/$section"
              params={{ section }}
              className="group flex min-h-11 items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm transition-colors hover:border-emerald-500 hover:bg-emerald-50/60 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <span className="truncate">{title}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700 transition-transform group-hover:translate-x-0.5 dark:text-emerald-300" />
            </Link>
          ))}
        </div>
      </section>

      {user?.role === "uno" && (
        <details className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 font-semibold">
            <Megaphone className="h-4 w-4 text-teal-800 dark:text-teal-300" />
            {L("উপজেলার বিজ্ঞপ্তি সম্পাদনা", "Manage Upazila announcement")}
          </summary>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              {L("বাংলা বিজ্ঞপ্তি", "Notice in Bangla")}
              <Textarea
                maxLength={500}
                rows={2}
                value={noticeBn}
                onChange={(event) => setNoticeBn(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              {L("ইংরেজি বিজ্ঞপ্তি", "Notice in English")}
              <Textarea
                maxLength={500}
                rows={2}
                value={noticeEn}
                onChange={(event) => setNoticeEn(event.target.value)}
              />
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noticeActive}
                onChange={(event) => setNoticeActive(event.target.checked)}
              />
              {L("বিজ্ঞপ্তিটি সক্রিয় রাখুন", "Publish this notice")}
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to="/announcements"
                className="inline-flex min-h-9 items-center rounded-md px-2 text-sm font-semibold text-teal-800 underline-offset-2 hover:bg-teal-50 hover:underline dark:text-teal-200 dark:hover:bg-teal-950/40"
              >
                {L("সব নোটিশ দেখুন", "View all notices")}
              </Link>
              <Button
                size="sm"
                disabled={savingNotice || (!noticeBn.trim() && !noticeEn.trim() && noticeActive)}
                onClick={() => void saveNotice()}
              >
                {savingNotice
                  ? L("সংরক্ষণ হচ্ছে…", "Saving…")
                  : L("বিজ্ঞপ্তি সংরক্ষণ", "Save notice")}
              </Button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function Metric({
  danger = false,
  detail,
  icon,
  label,
  value,
}: {
  danger?: boolean;
  detail: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-2 shadow-sm dark:bg-slate-900 ${danger ? "border-rose-200 dark:border-rose-900" : "border-slate-200 dark:border-slate-700"}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span
          className={
            danger ? "text-rose-700 dark:text-rose-300" : "text-teal-800 dark:text-teal-300"
          }
        >
          {icon}
        </span>
      </div>
      <div
        className={`mt-0.5 text-xl font-bold tabular-nums ${danger ? "text-rose-700 dark:text-rose-300" : "text-slate-900 dark:text-white"}`}
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
