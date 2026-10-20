import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardGate } from "@/components/dashboards/DashboardGate";
import { CompliancePanel } from "@/components/dashboards/CompliancePanel";
import { UnionStatisticsPanel } from "@/components/dashboards/UnionStatisticsPanel";
import { PageTitle, StatusBadge, useCaseHelpers } from "@/components/shared";
import { scopedCases, useApp } from "@/lib/store";
import type { RegCase, Role, Upazila } from "@/lib/types";

const roleDashboards = {
  worker: lazy(() =>
    import("@/components/dashboards/Worker").then((m) => ({ default: m.WorkerDashboard })),
  ),
  admin: lazy(() =>
    import("@/components/dashboards/Admin").then((m) => ({ default: m.AdminDashboard })),
  ),
  police: lazy(() =>
    import("@/components/dashboards/Police").then((m) => ({ default: m.PoliceDashboard })),
  ),
  uno: lazy(() => import("@/components/dashboards/Uno").then((m) => ({ default: m.UnoDashboard }))),
  district: lazy(() =>
    import("@/components/dashboards/Uno").then((m) => ({ default: m.UnoDashboard })),
  ),
  super: lazy(() =>
    import("@/components/dashboards/Super").then((m) => ({
      default: () => <m.SuperDashboard />,
    })),
  ),
};

type Section = "unions" | "compliance" | "alerts" | "records" | "users";

export const Route = createFileRoute("/dashboard/$section")({
  head: () => ({
    meta: [
      { title: "Dashboard details — ই-নিবন্ধন ট্র্যাকার" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardSection,
});

function DashboardSection() {
  const { section } = Route.useParams();
  return (
    <DashboardGate>
      <DashboardSectionContent section={section} />
    </DashboardGate>
  );
}

function DashboardSectionContent({ section }: { section: string }) {
  const { user, state, L } = useApp();
  const selectedUpazilaId: string | undefined = undefined;
  const [unionId, setUnionId] = useState("all");
  if (!user) return null;

  const allowedSections: Section[] =
    user.role === "worker" || user.role === "police"
      ? ["records"]
      : user.role === "super"
        ? ["unions", "compliance", "alerts", "records", "users"]
        : ["unions", "compliance", "alerts", "records"];
  if (!allowedSections.includes(section as Section)) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="font-display text-xl font-bold">
          {L("এই পাতায় প্রবেশের অনুমতি নেই", "You don't have access to this page")}
        </h1>
        <Button className="mt-4" asChild>
          <Link to="/dashboard">{L("ড্যাশবোর্ডে ফিরুন", "Back to dashboard")}</Link>
        </Button>
      </div>
    );
  }

  const cases = scopedCases(state, user);
  const districtUpazilas =
    user.role === "district"
      ? state.upazilas.filter((up) => up.districtEn === user.districtId)
      : [];
  const districtSource = districtUpazilas[0];
  const districtArea: Upazila | undefined = districtSource
    ? {
        ...districtSource,
        id: `district:${user.districtId}`,
        bn: districtSource.districtBn,
        en: districtSource.districtEn,
        unions: districtUpazilas.flatMap((up) => up.unions),
      }
    : undefined;
  const upazila =
    user.role === "super"
      ? (state.upazilas.find((up) => up.id === selectedUpazilaId) ?? state.upazilas[0])
      : user.role === "district"
        ? districtArea
        : state.upazilas.find((up) => up.id === user.upazilaId);
  const areas = upazila
    ? user.role === "admin"
      ? upazila.unions.filter((union) => union.id === user.unionId)
      : upazila.unions
    : [];
  const upazilaCases =
    user.role === "super" && upazila ? cases.filter((c) => c.upazilaId === upazila.id) : cases;
  const sectionTitle: Record<Section, string> = {
    unions: L("ইউনিয়নভিত্তিক পরিসংখ্যান", "Union statistics"),
    compliance: L("৩৬৫ দিনের নিবন্ধন পর্যবেক্ষণ", "365-day compliance monitoring"),
    alerts: L("সময়সীমার সতর্কতা", "Deadline alerts"),
    records: L("জন্ম ও মৃত্যু নিবন্ধন রেকর্ড", "Birth & death registration records"),
    users: L("ব্যবহারকারী ও ভূমিকা", "Users & roles"),
  };

  return (
    <>
      <nav className="mb-4">
        <Link
          to="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          {L("মূল ড্যাশবোর্ড", "Dashboard overview")}
        </Link>
      </nav>
      <PageTitle
        title={sectionTitle[section as Section]}
        {...(upazila
          ? {
              sub: L(
                user.role === "district"
                  ? `${upazila.bn} জেলা`
                  : `${upazila.bn} উপজেলা · ${upazila.districtBn}`,
                user.role === "district"
                  ? `${upazila.en} District`
                  : `${upazila.en} Upazila · ${upazila.districtEn}`,
              ),
            }
          : {})}
      />
      {section === "unions" && upazila && (
        <UnionStatisticsPanel
          upazila={upazila}
          cases={upazilaCases}
          unions={areas}
          selectedUnionId={unionId}
          onUnionChange={setUnionId}
        />
      )}
      {(section === "compliance" || section === "alerts") && upazila && (
        <CompliancePanel
          upazila={upazila}
          cases={upazilaCases}
          unions={areas}
          selectedUnionId={unionId}
          onUnionChange={setUnionId}
          mode={section === "alerts" ? "alerts" : "full"}
        />
      )}
      {section === "records" &&
        (user.role === "super" ? <SuperRecords cases={cases} /> : <RoleRecords role={user.role} />)}
      {section === "users" && user.role === "super" && <RoleManagement />}
    </>
  );
}

function RoleRecords({ role }: { role: Exclude<Role, "super"> }) {
  const Dashboard = roleDashboards[role];
  return (
    <Suspense fallback={<SectionLoading />}>
      <Dashboard />
    </Suspense>
  );
}

function RoleManagement() {
  const Management = roleDashboards.super;
  return (
    <Suspense fallback={<SectionLoading />}>
      <Management />
    </Suspense>
  );
}

function SectionLoading() {
  const { L } = useApp();
  return (
    <div className="space-y-4 py-4" role="status" aria-live="polite">
      <span className="sr-only">{L("পাতা লোড হচ্ছে", "Loading page")}</span>
      <div className="h-10 w-2/3 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-72 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}

function SuperRecords({ cases }: { cases: RegCase[] }) {
  const { L, n } = useApp();
  const { address, date } = useCaseHelpers();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return cases;
    return cases.filter((c) =>
      [c.id, c.name.bn, c.name.en, c.nid].some((value) =>
        value.toLocaleLowerCase().includes(normalized),
      ),
    );
  }, [cases, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="super-records-title"
    >
      <h2 id="super-records-title" className="font-semibold">
        {L("অনুমোদিত এলাকার নিবন্ধন", "Registration records in authorized areas")}
      </h2>
      <label className="relative mt-3 block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder={L(
            "নাম, রেকর্ড আইডি বা NID দিয়ে খুঁজুন",
            "Search by name, record ID or NID",
          )}
          aria-label={L("নিবন্ধন খুঁজুন", "Search registrations")}
        />
      </label>
      <p className="my-3 text-sm text-muted-foreground">
        {L(
          `${n(filtered.length)}টি রেকর্ড · প্রতি পাতায় ${n(pageSize)}টি`,
          `${filtered.length} records · ${pageSize} per page`,
        )}
      </p>
      {visible.length ? (
        <ul className="space-y-2">
          {visible.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{L(c.name.bn, c.name.en)}</div>
                  <div className="text-xs text-muted-foreground">{address(c)}</div>
                </div>
                <StatusBadge s={c.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{c.type === "birth" ? L("জন্ম", "Birth") : L("মৃত্যু", "Death")}</span>
                <span>
                  {L("আবেদনের তারিখ", "Filed")} {date(c.createdAt)}
                </span>
                <span>
                  {L("রেকর্ড", "Record")} {c.id.slice(0, 8)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {L("কোনো রেকর্ড পাওয়া যায়নি।", "No records found.")}
        </p>
      )}
      {filtered.length > pageSize && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {L("আগের", "Previous")}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {n(page + 1)} / {n(pageCount)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {L("পরের", "Next")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
