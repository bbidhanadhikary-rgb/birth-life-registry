import { useState } from "react";
import { AlertTriangle, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { scopedCases, useApp } from "@/lib/store";
import { downloadCSV, printPDF } from "@/lib/report";
import { TARGET, type Status } from "@/lib/types";
import { PageTitle, Stat, monthCount, redFlags, useCaseHelpers } from "../shared";
import { CaseReview } from "./CaseReview";

export function AdminDashboard() {
  const { L, n, user, state } = useApp();
  const { rows } = useCaseHelpers();
  const [filter, setFilter] = useState<Status | "all">("all");
  const cases = scopedCases(state, user);
  const up = state.upazilas.find((u) => u.id === user!.upazilaId)!;
  const un = up.unions.find((u) => u.id === user!.unionId)!;
  const b = monthCount(cases, "birth"), d = monthCount(cases, "death");
  const flags = redFlags(state, user!.upazilaId, user!.unionId);
  const shown = cases.filter((c) => filter === "all" || c.status === filter);

  return (
    <>
      <PageTitle title={L(un.bn, un.en)} sub={L(`${up.bn} উপজেলা · প্রশাসনিক কর্মকর্তা`, `${up.en} Upazila · Administrative Officer`)}
        actions={<>
          <Button variant="outline" onClick={() => downloadCSV(rows(cases), "union-report.csv")}><Download className="mr-1 h-4 w-4" />{L("ইউনিয়ন রিপোর্ট", "Union Report")}</Button>
          <Button variant="outline" onClick={() => printPDF(`Union Report — ${un.en}`, rows(cases))}><FileText className="mr-1 h-4 w-4" />PDF</Button>
        </>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {([["birth", b, TARGET.birth, L("এ মাসে জন্ম", "Births this month")], ["death", d, TARGET.death, L("এ মাসে মৃত্যু", "Deaths this month")]] as const).map(([k, v, t, lbl]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <div className="flex justify-between text-sm"><span>{lbl}</span><b>{n(v)} / {n(t)}</b></div>
            <Progress value={Math.min(100, (v / t) * 100)} className="mt-2 h-3" />
          </div>
        ))}
      </div>
      {flags.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />{L("১৫ দিন ধরে কোনো এন্ট্রি নেই", "No entries for 15 days")}</div>
          <ul className="mt-1 text-sm">{flags.map((u) => <li key={u.id}>{L(u.name.bn, u.name.en)} · {L("ওয়ার্ড", "Ward")} {n(u.ward ?? 1)}</li>)}</ul>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={L("মোট", "Total")} value={n(cases.length)} />
        <Stat label={L("অপেক্ষমাণ", "Pending")} value={n(cases.filter((c) => c.status === "pending").length)} />
        <Stat label={L("চলমান", "In Progress")} value={n(cases.filter((c) => c.status === "progress").length)} />
        <Stat label={L("সম্পন্ন", "Completed")} value={n(cases.filter((c) => c.status === "completed").length)} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "pending", "progress", "completed"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {{ all: L("সব", "All"), pending: L("অপেক্ষমাণ", "Pending"), progress: L("চলমান", "In Progress"), completed: L("সম্পন্ন", "Completed") }[f]}
          </Button>
        ))}
      </div>
      <div className="space-y-3">{shown.map((c) => <CaseReview key={c.id} c={c} mode="admin" />)}</div>
    </>
  );
}
