import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Download, FileText, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { scopedCases, useApp } from "@/lib/store";
import { downloadCSV, printPDF } from "@/lib/report";
import { TARGET, type Status, type Upazila, type Union, type Village } from "@/lib/types";
import { PageTitle, Stat, monthCount, redFlags, useCaseHelpers } from "../shared";
import { CaseReview } from "./CaseReview";
import { UnionStatisticsPanel } from "./UnionStatisticsPanel";
import { useAssignedRegistrationTarget } from "@/lib/use-assigned-registration-target";

function VillageManager({ upazila, union }: { upazila: Upazila; union: Union }) {
  const { L, saveUnionVillages } = useApp();
  const [villages, setVillages] = useState(union.villages);
  const [newVillage, setNewVillage] = useState({ bn: "", en: "", ward: "1" });
  const [saving, setSaving] = useState(false);

  useEffect(() => setVillages(union.villages), [union.villages]);

  const updateVillage = (id: string, patch: Partial<Village>) => {
    setVillages((current) =>
      current.map((village) => village.id === id ? { ...village, ...patch } : village),
    );
  };

  const addVillage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ward = Number(newVillage.ward);
    if (
      !newVillage.bn.trim() ||
      !newVillage.en.trim() ||
      !Number.isInteger(ward) ||
      ward < 1 ||
      ward > 99
    ) {
      toast.error(L("গ্রামের বাংলা ও ইংরেজি নাম এবং ১–৯৯-এর মধ্যে ওয়ার্ড দিন", "Enter the village name in Bangla and English and a ward from 1 to 99"));
      return;
    }
    setVillages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        bn: newVillage.bn.trim(),
        en: newVillage.en.trim(),
        ward,
        poBn: "",
        poEn: "",
      },
    ]);
    setNewVillage({ bn: "", en: "", ward: "1" });
  };

  const save = async () => {
    setSaving(true);
    try {
      if (await saveUnionVillages(villages)) {
        toast.success(L("গ্রাম ও ওয়ার্ডের তথ্য সংরক্ষিত হয়েছে", "Village and ward details saved"));
      }
    } catch (cause) {
      console.error("Could not save union village setup", cause);
      toast.error(L("গ্রাম ও ওয়ার্ডের তথ্য সংরক্ষণ করা যায়নি", "Could not save village and ward details"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-emerald-200 bg-card p-4">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-emerald-950">{L("গ্রাম ও ওয়ার্ড ব্যবস্থাপনা", "Village & Ward Manager")}</h2>
        <p className="text-sm text-muted-foreground">
          {L(`${union.bn} · ${upazila.bn} উপজেলা · ${upazila.districtBn} জেলা`, `${union.en} · ${upazila.en} Upazila · ${upazila.districtEn} District`)}
        </p>
      </div>

      <form onSubmit={addVillage} className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_auto]">
        <Input required value={newVillage.bn} maxLength={160} placeholder={L("গ্রামের নাম (বাংলা)", "Village name (Bangla)")} onChange={(event) => setNewVillage((current) => ({ ...current, bn: event.target.value }))} />
        <Input required value={newVillage.en} maxLength={160} placeholder={L("গ্রামের নাম (ইংরেজি)", "Village name (English)")} onChange={(event) => setNewVillage((current) => ({ ...current, en: event.target.value }))} />
        <Input required type="number" min={1} max={99} value={newVillage.ward} placeholder={L("ওয়ার্ড নং", "Ward no.")} onChange={(event) => setNewVillage((current) => ({ ...current, ward: event.target.value }))} />
        <Button type="submit" className="w-full lg:w-auto" aria-label={L("গ্রাম যোগ করুন", "Add village")}><Plus className="mr-2 h-4 w-4" />{L("যোগ করুন", "Add")}</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="hidden min-w-[720px] grid-cols-[1fr_1fr_8rem_3rem] gap-2 border-b bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-950 sm:grid">
          <span>{L("গ্রামের নাম বাংলায়", "Village name in Bangla")}</span>
          <span>{L("গ্রামের নাম ইংরেজিতে", "Village name in English")}</span>
          <span>{L("ওয়ার্ড নং", "Ward number")}</span>
          <span className="text-center">{L("মুছুন", "Delete")}</span>
        </div>
        <div className="max-h-80 min-w-0 space-y-2 overflow-y-auto p-2 sm:min-w-[720px]">
        {villages.map((village) => (
          <div key={village.id} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_auto]">
            <Input aria-label={L("গ্রামের নাম বাংলা", "Village name in Bangla")} value={village.bn} maxLength={160} onChange={(event) => updateVillage(village.id, { bn: event.target.value })} />
            <Input aria-label={L("গ্রামের নাম ইংরেজি", "Village name in English")} value={village.en} maxLength={160} onChange={(event) => updateVillage(village.id, { en: event.target.value })} />
            <Input aria-label={L("ওয়ার্ড নং", "Ward number")} type="number" min={1} max={99} value={village.ward} onChange={(event) => updateVillage(village.id, { ward: Number(event.target.value) })} />
            <Button type="button" variant="outline" aria-label={L("গ্রাম মুছুন", "Remove village")} onClick={() => setVillages((current) => current.filter((item) => item.id !== village.id))}>
              <Trash2 className="h-4 w-4 text-red-700" />
            </Button>
          </div>
        ))}
        {villages.length === 0 && <p className="text-sm text-muted-foreground">{L("এখনও কোনো গ্রাম যোগ করা হয়নি", "No villages have been added yet")}</p>}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? L("সংরক্ষণ হচ্ছে…", "Saving…") : L("গ্রাম ও ওয়ার্ড সংরক্ষণ", "Save village setup")}
        </Button>
      </div>
    </section>
  );
}

export function AdminDashboard() {
  const { L, n, user, state } = useApp();
  const stationTarget = useAssignedRegistrationTarget();
  const { rows } = useCaseHelpers();
  const [filter, setFilter] = useState<Status | "all">("all");
  const cases = scopedCases(state, user);
  const up = state.upazilas.find((u) => u.id === user!.upazilaId)!;
  const un = up.unions.find((u) => u.id === user!.unionId)!;
  const b = stationTarget?.counts.birth.total ?? monthCount(cases, "birth");
  const d = stationTarget?.counts.death.total ?? monthCount(cases, "death");
  const flags = redFlags(state, user!.upazilaId, user!.unionId);
  const shown = cases.filter((c) => filter === "all" || c.status === filter);
  const targets = stationTarget?.target &&
    stationTarget.target.unionId === (user!.stationId ?? user!.unionId)
    ? stationTarget.target
    : { birth: TARGET.birth, death: TARGET.death };

  return (
    <>
      <PageTitle title={L(un.bn, un.en)} sub={L(`${up.bn} উপজেলা · প্রশাসনিক কর্মকর্তা`, `${up.en} Upazila · Administrative Officer`)}
        actions={<>
          <Button variant="outline" onClick={() => downloadCSV(rows(cases), "union-report.csv")}><Download className="mr-1 h-4 w-4" />{L("ইউনিয়ন রিপোর্ট", "Union Report")}</Button>
          <Button variant="outline" onClick={() => printPDF(`Union Report — ${un.en}`, rows(cases))}><FileText className="mr-1 h-4 w-4" />PDF</Button>
        </>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {([["birth", b, targets.birth, L("এ মাসে জন্ম", "Births this month")], ["death", d, targets.death, L("এ মাসে মৃত্যু", "Deaths this month")]] as const).map(([k, v, t, lbl]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <div className="flex justify-between text-sm"><span>{lbl}</span><b>{n(v)} / {n(t)}</b></div>
            <Progress value={Math.min(100, (v / t) * 100)} className="mt-2 h-3" />
          </div>
        ))}
      </div>
      <VillageManager upazila={up} union={un} />
      <UnionStatisticsPanel
        upazila={up}
        cases={cases}
        unions={[un]}
        selectedUnionId={un.id}
        showUnionFilter={false}
      />
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
