import { useState } from "react";
import { AlertTriangle, Download, FileText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scopedCases, useApp } from "@/lib/store";
import { downloadCSV, printPDF } from "@/lib/report";
import { TARGET } from "@/lib/types";
import { PageTitle, Stat, monthCount, redFlags, useCaseHelpers } from "../shared";
import { CaseReview } from "./CaseReview";
import { MonitoringTargetEntry } from "./MonitoringTargetEntry";
import { getStationsForUpazila } from "@/lib/monirampur-stations";
import { UnifiedStationDashboardTop } from "./UnifiedStationDashboardTop";

export function UnoDashboard() {
  const { L, n, user, state } = useApp();
  const { rows } = useCaseHelpers();
  const [unionId, setUnionId] = useState("all");
  const cases = scopedCases(state, user);
  const up = state.upazilas.find((u) => u.id === user!.upazilaId)!;
  const stations = getStationsForUpazila(up.id, up.unions);
  const flags = redFlags(state, up.id);
  const data = stations.map((u) => {
    const cs = cases.filter((c) => (c.stationId ?? c.unionId) === u.id);
    return { name: L(u.bn, u.en).replace(/^(\S+ (নং|No\.) )/, ""), births: monthCount(cs, "birth"), deaths: monthCount(cs, "death"), flagged: flags.some((f) => f.unionId === u.id) };
  });
  const shown = cases.filter((c) => unionId === "all" || c.unionId === unionId);

  return (
    <>
      <UnifiedStationDashboardTop stationId={unionId !== "all" ? unionId : undefined} />
      <PageTitle title={L(`${up.bn} উপজেলা — মাস্টার ভিউ`, `${up.en} Upazila — Master View`)} sub={L(`${up.districtBn} · ${n(stations.length)}টি ইউনিয়ন/পৌরসভা`, `${up.districtEn} · ${stations.length} unions/municipality`)}
        actions={<>
          <Button variant="outline" onClick={() => downloadCSV(rows(cases), "master-report.csv")}><Download className="mr-1 h-4 w-4" />{L("মাস্টার রিপোর্ট", "Master Report")}</Button>
          <Button variant="outline" onClick={() => printPDF(`Master Report — ${up.en}`, rows(cases))}><FileText className="mr-1 h-4 w-4" />PDF</Button>
        </>} />
      <div className="mb-6">
        <MonitoringTargetEntry />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={L("এ মাসে জন্ম", "Births this month")} value={`${n(monthCount(cases, "birth"))} / ${n(TARGET.birth * stations.length)}`} />
        <Stat label={L("এ মাসে মৃত্যু", "Deaths this month")} value={`${n(monthCount(cases, "death"))} / ${n(TARGET.death * stations.length)}`} />
        <Stat label={L("সম্পন্ন", "Completed")} value={n(cases.filter((c) => c.status === "completed").length)} />
        <Stat label={L("লাল চিহ্নিত", "Red flags")} value={n(flags.length)} tone={flags.length ? "danger" : undefined} />
      </div>
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">{L("ইউনিয়নভিত্তিক মাসিক লক্ষ্যমাত্রা", "Monthly target by union")}</h2>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <ReferenceLine y={TARGET.birth} stroke="var(--color-primary)" strokeDasharray="4 4" />
              <ReferenceLine y={TARGET.death} stroke="var(--color-destructive)" strokeDasharray="4 4" />
              <Bar dataKey="births" name={L("জন্ম", "Births")} fill="var(--color-primary)" />
              <Bar dataKey="deaths" name={L("মৃত্যু", "Deaths")} fill="var(--color-chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {flags.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />{L("১৫ দিন ধরে শূন্য এন্ট্রি", "Zero entries for 15 days")}</div>
          <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
            {flags.map((u) => { const un = up.unions.find((x) => x.id === u.unionId); return <li key={u.id}>{L(u.name.bn, u.name.en)} — {un && L(un.bn, un.en)}, {L("ওয়ার্ড", "Ward")} {n(u.ward ?? 1)}</li>; })}
          </ul>
        </div>
      )}
      <div className="mb-3 flex items-center gap-2">
        <Select value={unionId} onValueChange={setUnionId}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{L("সব ইউনিয়ন", "All unions")}</SelectItem>
            {stations.map((u) => <SelectItem key={u.id} value={u.id}>{L(u.bn, u.en)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">{shown.map((c) => <CaseReview key={c.id} c={c} mode="uno" />)}</div>
    </>
  );
}
