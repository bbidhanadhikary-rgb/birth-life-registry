import { useState } from "react";
import { toast } from "sonner";
import { Check, Paperclip, ShieldCheck } from "lucide-react";
import { getDhakaMonthYear } from "@/lib/monthly-targets";
import { incrementStationCompletedCount } from "@/lib/station-local-metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleLabel, useApp } from "@/lib/store";
import type { RegCase, Status } from "@/lib/types";
import { StatusBadge, useCaseHelpers } from "../shared";

/** Case card for Admin (full control) and UNO (remarks only). Original worker inputs are never editable. */
export function CaseReview({
  c,
  mode,
  dedicatedCompletion = false,
}: {
  c: RegCase;
  mode: "admin" | "uno";
  dedicatedCompletion?: boolean;
}) {
  const { L, n, patchCase, addRemark, state, user } = useApp();
  const { address, date } = useCaseHelpers();
  const [remark, setRemark] = useState(""); const [regNo, setRegNo] = useState(c.regNo ?? "");
  const [savingStatus, setSavingStatus] = useState(false);
  const worker = state.users.find((u) => u.id === c.createdBy);

  const setStatus = async (s: Status) => {
    if (savingStatus) return;
    if (s === "completed" && !/^\d{17}$/.test(regNo)) {
      toast.error(L("সম্পন্ন করতে ১৭ অঙ্কের নিবন্ধন নম্বর দিন", "Enter the 17-digit registration number to complete"));
      return;
    }
    setSavingStatus(true);
    try {
      const updated = s === "completed"
        ? await patchCase(c.id, { status: s, regNo })
        : await patchCase(c.id, { status: s });
      if (updated) {
        if (s === "completed" && c.status !== "completed") {
          const upazilaId = user?.upazilaId ?? c.upazilaId;
          const stationId = user?.stationId ?? user?.unionId ?? c.stationId ?? c.unionId;
          if (upazilaId && stationId) {
            const monthYear = getDhakaMonthYear();
            const monthPrefix = monthYear.slice(0, 7);
            const databaseCompletedCount = state.cases.filter((item) => {
              if (
                item.status !== "completed" ||
                item.id === c.id ||
                item.upazilaId !== upazilaId ||
                (item.stationId ?? item.unionId) !== stationId
              ) return false;
              const completedTime = item.completedAt ?? item.createdAt;
              const itemMonth = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Dhaka",
                year: "numeric",
                month: "2-digit",
              }).format(new Date(completedTime));
              return itemMonth === monthPrefix;
            }).length;
            incrementStationCompletedCount(upazilaId, stationId, monthYear, c.id, databaseCompletedCount);
          }
        }
        toast.success(L("অবস্থা হালনাগাদ হয়েছে", "Status updated"));
      }
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{L(c.name.bn, c.name.en)}</span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs">{c.type === "birth" ? L("জন্ম", "Birth") : L("মৃত্যু", "Death")}</span>
        <span className="ml-auto"><StatusBadge s={c.status} /></span>
      </div>
      <div className="mt-1 grid gap-x-4 text-sm text-muted-foreground sm:grid-cols-2">
        <div>{L("পিতা", "Father")}: {L(c.father.bn, c.father.en)} · {L("মাতা", "Mother")}: {L(c.mother.bn, c.mother.en)}</div>
        <div>NID: {c.nid} · {date(c.createdAt)}</div>
        <div>{address(c)} · {L("ওয়ার্ড", "Ward")} {n(c.ward)}</div>
        <div>{L("কর্মী", "Worker")}: {worker ? L(worker.name.bn, worker.name.en) : "—"}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {c.filesPurged ? <span className="rounded bg-muted px-2 py-0.5">{L("ফাইল ৯০ দিন পর মুছে ফেলা হয়েছে", "Files auto-purged after 90 days")}</span>
          : c.files.map((f) => <span key={f.name} className="flex items-center gap-1 rounded bg-muted px-2 py-0.5"><Paperclip className="h-3 w-3" />{f.name}</span>)}
        {c.police && (
          <span className={`flex items-center gap-1 rounded px-2 py-0.5 ${c.police.collected ? "bg-success/15 text-success" : "bg-info/15 text-info"}`}>
            <ShieldCheck className="h-3 w-3" />{c.police.collected ? L("গ্রাম পুলিশ কাগজ সংগ্রহ করেছে", "Village Police collected documents") : L("গ্রাম পুলিশ যাচাই চলছে", "Village Police verifying")}
          </span>
        )}
        {c.regNo && <span className="rounded bg-success/15 px-2 py-0.5 text-success">{L("নিবন্ধন নং", "Reg. No")}: {c.regNo}</span>}
      </div>
      {c.remarks.length > 0 && (
        <div className="mt-2 space-y-1">
          {c.remarks.map((r, i) => (
            <div key={i} className={`rounded p-2 text-sm ${r.role === "uno" ? "border-l-4 border-primary bg-primary/10" : "bg-muted"}`}>
              <b>{roleLabel(r.role, L)}:</b> {r.text}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Input className="min-w-48 flex-1" maxLength={500} placeholder={mode === "uno" ? L("ইউএনও মন্তব্য (আবশ্যক)", "UNO remark (mandatory)") : L("মন্তব্য লিখুন", "Add a remark")} value={remark} onChange={(e) => setRemark(e.target.value)} />
        <Button variant="secondary" onClick={async () => { if (!remark.trim()) return; await addRemark(c.id, remark.trim()); setRemark(""); toast.success(L("মন্তব্য যুক্ত হয়েছে", "Remark added")); }}>{L("মন্তব্য", "Remark")}</Button>
      </div>
      {mode === "admin" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Select value={c.status} onValueChange={(s) => setStatus(s as Status)} disabled={savingStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{L("অপেক্ষমাণ", "Pending")}</SelectItem>
              <SelectItem value="progress">{L("চলমান", "In Progress")}</SelectItem>
              {(!dedicatedCompletion || c.status === "completed") && <SelectItem value="completed">{L("সম্পন্ন", "Completed")}</SelectItem>}
              {(!dedicatedCompletion || c.status === "rejected") && <SelectItem value="rejected">{L("বাতিল", "Rejected")}</SelectItem>}
            </SelectContent>
          </Select>
          <Input className="w-56" inputMode="numeric" maxLength={17} placeholder={L("নিবন্ধন নং (১৭ অঙ্ক)", "Reg. No (17 digits)")} value={regNo} onChange={(e) => setRegNo(e.target.value.replace(/\D/g, ""))} disabled={savingStatus} />
          {c.status !== "completed" && c.status !== "rejected" && (
            <Button
              className="bg-emerald-800 text-white hover:bg-emerald-900"
              onClick={() => setStatus("completed")}
              disabled={savingStatus}
            >
              <Check className="h-4 w-4" />
              {dedicatedCompletion
                ? L("বিডিআরআইএস-এ সম্পন্ন হিসেবে চিহ্নিত করুন", "Mark as Completed (BDRIS Status Done)")
                : L("নিবন্ধন সম্পন্ন", "Complete registration")}
            </Button>
          )}
          {!c.police && c.status !== "completed" && c.status !== "rejected" && (
            <Button variant="outline" onClick={async () => { if (!(await patchCase(c.id, { police: { epiCard: false, parentNid: false, collected: false }, status: "progress" }))) return; toast.success(L("গ্রাম পুলিশকে কাজ দেওয়া হয়েছে", "Task sent to Village Police")); }}>
              <ShieldCheck className="mr-1 h-4 w-4" />{L("গ্রাম পুলিশকে যাচাই দিন", "Send to Village Police")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
