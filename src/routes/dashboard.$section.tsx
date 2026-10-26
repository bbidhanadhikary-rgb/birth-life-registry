import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardGate } from "@/components/dashboards/DashboardGate";
import { CompliancePanel } from "@/components/dashboards/CompliancePanel";
import { UnionStatisticsPanel } from "@/components/dashboards/UnionStatisticsPanel";
import { PageTitle, StatusBadge, useCaseHelpers } from "@/components/shared";
import {
  BANGLADESH_ADMINISTRATIVE_AREAS,
  filterCasesByAdministrativeArea,
  getAdministrativeWards,
  sameAdministrativeName,
} from "@/lib/geography";
import { scopedCases, useApp } from "@/lib/store";
import { getStationsForUpazila } from "@/lib/monirampur-stations";
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
    <DashboardGate developmentPreviewRole="uno">
      <DashboardSectionContent section={section} />
    </DashboardGate>
  );
}

function DashboardSectionContent({ section }: { section: string }) {
  const { user, state, L, selectedUpazilaId } = useApp();
  const [unionId, setUnionId] = useState("all");
  const [areaFilters, setAreaFilters] = useState({
    division: "all",
    district: "all",
    upazila: "all",
    union: "all",
    ward: "all",
  });
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
  const registeredUpazilas =
    user.role === "super"
      ? state.upazilas
      : user.role === "district"
        ? state.upazilas.filter((up) => up.districtEn === user.districtId)
        : state.upazilas.filter((up) => up.id === user.upazilaId);
  const geographicAreas = BANGLADESH_ADMINISTRATIVE_AREAS;
  const geographicUpazilas = geographicAreas.filter(
    (area) => area.level === "upazila" || area.level === "city_corporation",
  );
  const divisionOptions = geographicAreas.filter((area) => area.level === "division");
  const districtOptions = BANGLADESH_ADMINISTRATIVE_AREAS.filter(
    (area) =>
      area.level === "district" &&
      (area.divisionId === areaFilters.division || areaFilters.division === "all"),
  );
  const matchingGeographicUpazilas = geographicUpazilas.filter(
    (area) =>
      (area.divisionId === areaFilters.division || areaFilters.division === "all") &&
      (area.districtId === areaFilters.district || areaFilters.district === "all"),
  );
  const selectedGeographicUpazila = geographicUpazilas.find(
    (area) => area.id === areaFilters.upazila,
  );
  const selectedGeographicUnion = BANGLADESH_ADMINISTRATIVE_AREAS.find(
    (area) =>
      area.id === areaFilters.union &&
      (area.level === "union" || area.level === "municipality"),
  );
  const unionOptions = selectedGeographicUpazila
    ? geographicAreas.filter(
        (area) =>
          (area.level === "union" || area.level === "municipality") &&
          area.parentId === selectedGeographicUpazila.id,
      )
    : [];
  const wardOptions =
    selectedGeographicUnion
      ? getAdministrativeWards(selectedGeographicUnion.id)
      : selectedGeographicUpazila?.level === "city_corporation"
        ? getAdministrativeWards(selectedGeographicUpazila.id)
        : Array.from({ length: 9 }, (_, index) => ({
            id: `ward-${index + 1}`,
            bn: `ওয়ার্ড ${index + 1}`,
            en: `Ward ${index + 1}`,
          }));
  const matchingRegisteredUpazilas = registeredUpazilas.filter((registered) =>
    matchingGeographicUpazilas.some(
      (area) =>
        sameAdministrativeName(registered.en, area.en) ||
        sameAdministrativeName(registered.bn, area.bn),
    ),
  );
  const reportUnions = matchingRegisteredUpazilas.flatMap((upazila) =>
    getStationsForUpazila(upazila.id, upazila.unions).filter(
      (station) => user.role !== "admin" || station.id === user.unionId,
    ),
  );
  const selectedRegisteredUnion = selectedGeographicUnion
    ? reportUnions.find(
        (union) =>
          sameAdministrativeName(union.en, selectedGeographicUnion.en) ||
          sameAdministrativeName(union.bn, selectedGeographicUnion.bn),
      )
    : undefined;
  const reportAreaLabel =
    selectedGeographicUpazila?.bn ??
    (areaFilters.district !== "all"
      ? districtOptions.find((area) => area.id === areaFilters.district)?.bn
      : areaFilters.division !== "all"
        ? divisionOptions.find((area) => area.id === areaFilters.division)?.bn
        : undefined);
  const reportAreaLabelEn =
    selectedGeographicUpazila?.en ??
    (areaFilters.district !== "all"
      ? districtOptions.find((area) => area.id === areaFilters.district)?.en
      : areaFilters.division !== "all"
        ? divisionOptions.find((area) => area.id === areaFilters.division)?.en
        : undefined);
  const reportUpazilaSource = matchingRegisteredUpazilas[0];
  const reportUpazila = reportUpazilaSource
    ? {
        ...reportUpazilaSource,
        id: "area-report",
        bn: reportAreaLabel ?? L("জাতীয় পর্যায়", "National"),
        en: reportAreaLabelEn ?? L("জাতীয় পর্যায়", "National"),
        unions: reportUnions,
      }
    : undefined;
  const areaCases = filterCasesByAdministrativeArea(cases, registeredUpazilas, areaFilters);
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
        unions: districtUpazilas.flatMap((up) => getStationsForUpazila(up.id, up.unions)),
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
      ? getStationsForUpazila(upazila.id, upazila.unions).filter(
          (station) => station.id === user.unionId,
        )
      : getStationsForUpazila(upazila.id, upazila.unions)
    : [];
  const upazilaCases =
    user.role === "super" && upazila ? cases.filter((c) => c.upazilaId === upazila.id) : cases;
  const sectionTitle: Record<Section, string> = {
    unions: L("এলাকাভিত্তিক প্রতিবেদন", "Area-wise report"),
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
      {section === "unions" && (
        <div className="space-y-4">
          <section
            className="grid gap-3 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5"
            aria-label={L("এলাকাভিত্তিক প্রতিবেদনের ভৌগোলিক ফিল্টার", "Area-wise report geographic filters")}
          >
            <AreaFilterSelect
              label={L("বিভাগ", "Division")}
              value={areaFilters.division}
              allLabel={L("সব বিভাগ", "All divisions")}
              options={divisionOptions}
              onChange={(division) =>
                setAreaFilters({
                  division,
                  district: "all",
                  upazila: "all",
                  union: "all",
                  ward: "all",
                })
              }
            />
            <AreaFilterSelect
              label={L("জেলা", "District")}
              value={areaFilters.district}
              allLabel={L("সব জেলা", "All districts")}
              options={districtOptions}
              onChange={(district) =>
                setAreaFilters({ ...areaFilters, district, upazila: "all", union: "all", ward: "all" })
              }
            />
            <AreaFilterSelect
              label={L("উপজেলা / সিটি কর্পোরেশন", "Upazila / City Corporation")}
              value={areaFilters.upazila}
              allLabel={L("সব উপজেলা / সিটি কর্পোরেশন", "All upazilas / city corporations")}
              options={matchingGeographicUpazilas}
              onChange={(selectedId) => {
                setAreaFilters({ ...areaFilters, upazila: selectedId, union: "all", ward: "all" });
              }}
            />
            <AreaFilterSelect
              label={L("ইউনিয়ন / পৌরসভা", "Union / Municipality")}
              value={areaFilters.union}
              allLabel={L("সব ইউনিয়ন / পৌরসভা", "All unions / municipalities")}
              options={unionOptions}
              disabled={!selectedGeographicUpazila || selectedGeographicUpazila.level === "city_corporation"}
              onChange={(union) => setAreaFilters({ ...areaFilters, union, ward: "all" })}
            />
            <AreaFilterSelect
              label={L("ওয়ার্ড", "Ward")}
              value={areaFilters.ward}
              allLabel={L("সব ওয়ার্ড", "All wards")}
              options={wardOptions}
              onChange={(ward) => setAreaFilters({ ...areaFilters, ward })}
            />
          </section>
          {reportUpazila ? (
            <UnionStatisticsPanel
              upazila={reportUpazila}
              cases={areaCases}
              unions={reportUnions}
              selectedUnionId={
                areaFilters.union === "all"
                  ? "all"
                  : selectedRegisteredUnion?.id ?? "__no_registered_union__"
              }
              showUnionFilter={false}
            />
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-muted-foreground">
              {L("নির্বাচিত এলাকায় কোনো নিবন্ধিত উপজেলা পাওয়া যায়নি।", "No registered upazila was found in this selection.")}
            </p>
          )}
          <AreaReportRecords
            key={`${areaFilters.division}:${areaFilters.district}:${areaFilters.upazila}:${areaFilters.union}:${areaFilters.ward}`}
            cases={areaCases}
          />
        </div>
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

function AreaFilterSelect({
  allLabel,
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  allLabel: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: { id: string; bn: string; en: string }[];
  value: string;
}) {
  const { L } = useApp();

  return (
    <label className="min-w-0 space-y-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <select
        className="h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-base font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {L(option.bn, option.en)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AreaReportRecords({ cases }: { cases: RegCase[] }) {
  const { L, n } = useApp();
  const { address, date } = useCaseHelpers();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? cases.filter((item) =>
            [item.id, item.name.bn, item.name.en, item.nid].some((value) =>
              value.toLocaleLowerCase().includes(normalizedQuery),
            ),
          )
        : cases,
    [cases, normalizedQuery],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="area-report-records-title"
    >
      <h2 id="area-report-records-title" className="font-semibold">
        {L("এলাকাভিত্তিক নিবন্ধন রেকর্ড", "Area-wise registration records")}
      </h2>
      <label className="relative mt-3 block max-w-xl">
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
          placeholder={L("নাম, রেকর্ড আইডি বা NID দিয়ে খুঁজুন", "Search by name, record ID or NID")}
          aria-label={L("নিবন্ধন খুঁজুন", "Search registrations")}
        />
      </label>
      <p className="my-3 text-sm text-muted-foreground">
        {L(`${n(filtered.length)}টি রেকর্ড`, `${n(filtered.length)} records`)}
      </p>
      {visible.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">{L("নাম", "Name")}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{L("ধরন", "Type")}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{L("ঠিকানা", "Address")}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{L("আবেদনের তারিখ", "Filed")}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{L("অবস্থা", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{L(item.name.bn, item.name.en)}</td>
                  <td className="px-3 py-2">
                    {item.type === "birth" ? L("জন্ম", "Birth") : L("মৃত্যু", "Death")}
                  </td>
                  <td className="px-3 py-2">{address(item)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{date(item.createdAt)}</td>
                  <td className="px-3 py-2"><StatusBadge s={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {L("নির্বাচিত এলাকায় কোনো রেকর্ড পাওয়া যায়নি।", "No records found in the selected area.")}
        </p>
      )}
      {filtered.length > pageSize && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {L("আগের", "Previous")}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {n(currentPage + 1)} / {n(pageCount)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            {L("পরের", "Next")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </section>
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
