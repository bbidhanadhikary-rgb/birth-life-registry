import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDhakaMonthYear } from "@/lib/monthly-targets";
import { useApp } from "@/lib/store";
import { TARGET } from "@/lib/types";
import { getTargetEntryStations } from "@/lib/monirampur-stations";
import {
  readDemoRegistrationTargets,
  writeDemoRegistrationTargets,
  type DemoRegistrationTarget,
  type SavedRegistrationTarget,
} from "@/lib/registration-targets";
import {
  loadUpazilaRegistrationTargets,
  saveUpazilaRegistrationTargets,
} from "@/lib/registration-targets.functions";

type TargetRow = {
  unionId: string;
  name: string;
  birth: string;
  death: string;
};

type TargetTotals = { birth: number; death: number };
function targetValue(value: string) {
  return Number(value) || 0;
}

export function MonitoringTargetEntry({
  onSubmittedTargets,
}: {
  onSubmittedTargets?: (totals: TargetTotals) => void;
}) {
  const { L, n, state, user, demoMode } = useApp();
  const upazila = state.upazilas.find((item) => item.id === user?.upazilaId);
  const [monthYear, setMonthYear] = useState(getDhakaMonthYear);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);

  useEffect(() => {
    if (user?.role !== "uno" || !upazila) {
      setRows([]);
      setLoading(false);
      setLoadError(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(false);

    void (async () => {
      const savedTargets: SavedRegistrationTarget[] = demoMode
        ? readDemoRegistrationTargets(upazila.id, monthYear)
        : (await loadUpazilaRegistrationTargets({ data: { monthYear } })).targets;

      if (!active) return;

      const grouped = new Map<string, { draft?: SavedRegistrationTarget; submitted?: SavedRegistrationTarget }>();
      for (const record of savedTargets) {
        const target = grouped.get(record.union_id) ?? {};
        if (record.status === "draft") target.draft = record;
        if (record.status === "submitted") target.submitted = record;
        grouped.set(record.union_id, target);
      }

      const stations = getTargetEntryStations(upazila.id, upazila.unions);
      const nextRows = stations.map((union) => {
        const targets = grouped.get(union.id);
        const draft = targets?.draft;
        const submitted = targets?.submitted;
        const latest = draft && submitted
          ? Date.parse(draft.updated_at) > Date.parse(submitted.updated_at)
            ? draft
            : submitted
          : draft ?? submitted;
        return {
          unionId: union.id,
          name: L(union.bn, union.en),
          birth: String(latest?.birth_target ?? TARGET.birth),
          death: String(latest?.death_target ?? TARGET.death),
        };
      });
      const submittedTotals = stations.reduce(
        (totals, union) => {
          const submitted = grouped.get(union.id)?.submitted;
          totals.birth += submitted?.birth_target ?? 0;
          totals.death += submitted?.death_target ?? 0;
          return totals;
        },
        { birth: 0, death: 0 },
      );

      setRows(nextRows);
      onSubmittedTargets?.(submittedTotals);
    })()
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Failed to load registration targets", error);
        setRows([]);
        setLoadError(true);
        toast.error(L("লক্ষ্যমাত্রা লোড করা যায়নি", "Could not load registration targets"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [L, demoMode, monthYear, onSubmittedTargets, upazila, user]);

  if (user?.role !== "uno") return null;

  const birthTotal = rows.reduce((total, row) => total + targetValue(row.birth), 0);
  const deathTotal = rows.reduce((total, row) => total + targetValue(row.death), 0);

  const updateTarget = (unionId: string, field: "birth" | "death", value: string) => {
    setRows((current) =>
      current.map((row) => row.unionId === unionId ? { ...row, [field]: value } : row),
    );
  };

  const saveTargets = async (status: "draft" | "submitted") => {
    if (!upazila || saving || !rows.length || loadError) return;
    if (rows.some((row) =>
      !/^\d+$/.test(row.birth) || !/^\d+$/.test(row.death) ||
      !Number.isSafeInteger(Number(row.birth)) || !Number.isSafeInteger(Number(row.death)) ||
      Number(row.birth) > 2_147_483_647 || Number(row.death) > 2_147_483_647,
    )) {
      toast.error(L("প্রতিটি লক্ষ্যমাত্রা পূর্ণসংখ্যা হতে হবে", "Targets must be whole numbers"));
      return;
    }

    setSaving(status);
    const savedAt = new Date().toISOString();
    const savedRows = rows.map((row) => ({
      unionId: row.unionId,
      birthTarget: Number(row.birth),
      deathTarget: Number(row.death),
    }));

    try {
      if (demoMode) {
        const previousTargets = readDemoRegistrationTargets(upazila.id, monthYear);
        const localRows: DemoRegistrationTarget[] = savedRows.map((row) => ({
          union_id: row.unionId,
          union_name: upazila.unions.find((union) => union.id === row.unionId)?.bn ?? row.unionId,
          birth_target: row.birthTarget,
          death_target: row.deathTarget,
          status,
          updated_at: savedAt,
        }));
        const nextTargets = [
          ...previousTargets.filter((target) =>
            !localRows.some((row) => row.union_id === target.union_id && target.status === status),
          ),
          ...localRows,
        ];
        if (!writeDemoRegistrationTargets(upazila.id, monthYear, nextTargets)) {
          throw new Error("Could not persist monitoring targets on this device");
        }
      } else {
        await saveUpazilaRegistrationTargets({
          data: { monthYear, status, targets: savedRows },
        });
      }

      if (status === "submitted") onSubmittedTargets?.({ birth: birthTotal, death: deathTotal });
      toast.success(status === "draft"
        ? L("খসড়া সফলভাবে সংরক্ষণ করা হয়েছে", "Draft saved successfully")
        : L("লক্ষ্যমাত্রা সফলভাবে জমা দেওয়া হয়েছে", "Targets submitted successfully"));
    } catch (error) {
      console.error(`Failed to save ${status} monitoring targets`, error);
      toast.error(L("লক্ষ্যমাত্রা সংরক্ষণ করা যায়নি", "Could not save targets"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="shrink-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">{L("ইউনিয়ন/পৌরসভাভিত্তিক লক্ষ্যমাত্রা", "Union/Municipality targets")}</h2>
          <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {L("মাস", "Month")}
            <Input
              aria-label={L("লক্ষ্যমাত্রার মাস", "Target month")}
              className="h-8 w-40"
              type="month"
              value={monthYear.slice(0, 7)}
              onChange={(event) => {
                if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) {
                  setMonthYear(`${event.target.value}-01`);
                }
              }}
            />
          </label>
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-800">
            <tr>
              <th scope="col" className="px-3 py-2.5">{L("ক্রমিক নং", "Sl No")}</th>
              <th scope="col" className="px-3 py-2.5">{L("ইউনিয়ন/পৌরসভার নাম", "Union/Municipality Name")}</th>
              <th scope="col" className="px-3 py-2.5">{L("জন্ম নিবন্ধন টার্গেট", "Birth Registration Target")}</th>
              <th scope="col" className="px-3 py-2.5">{L("মৃত্যু নিবন্ধন টার্গেট", "Death Registration Target")}</th>
              <th scope="col" className="px-3 py-2.5">{L("মোট সম্মিলিত টার্গেট", "Total Combined Target")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.unionId} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-3 py-2.5 tabular-nums">{n(index + 1)}</td>
                <th scope="row" className="px-3 py-2.5 text-left font-medium">{row.name}</th>
                <td className="px-3 py-2">
                  <Input
                    aria-label={`${L("জন্ম নিবন্ধন টার্গেট", "Birth registration target")}: ${row.name}`}
                    className="h-9 w-32 tabular-nums"
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    value={row.birth}
                    disabled={loading || saving !== null}
                    onChange={(event) => updateTarget(row.unionId, "birth", event.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    aria-label={`${L("মৃত্যু নিবন্ধন টার্গেট", "Death registration target")}: ${row.name}`}
                    className="h-9 w-32 tabular-nums"
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    value={row.death}
                    disabled={loading || saving !== null}
                    onChange={(event) => updateTarget(row.unionId, "death", event.target.value)}
                  />
                </td>
                <td className="px-3 py-2.5 font-semibold tabular-nums">{n(targetValue(row.birth) + targetValue(row.death))}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {L("কোনো ইউনিয়ন/পৌরসভা পাওয়া যায়নি", "No unions or municipalities found")}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {L("লক্ষ্যমাত্রা লোড হচ্ছে…", "Loading targets…")}
                </td>
              </tr>
            )}
            {loadError && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-destructive">
                  {L("লক্ষ্যমাত্রা লোড করা যায়নি", "Targets could not be loaded")}
                </td>
              </tr>
            )}
          </tbody>
          {!!rows.length && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold dark:border-slate-600 dark:bg-slate-800">
              <tr>
                <th scope="row" colSpan={2} className="px-3 py-2.5 text-left">{L("সর্বমোট", "Column totals")}</th>
                <td className="px-3 py-2.5 tabular-nums">{n(birthTotal)}</td>
                <td className="px-3 py-2.5 tabular-nums">{n(deathTotal)}</td>
                <td className="px-3 py-2.5 tabular-nums">{n(birthTotal + deathTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={loading || loadError || saving !== null || !rows.length} onClick={() => void saveTargets("draft")}>
          {saving === "draft" ? L("সংরক্ষণ হচ্ছে…", "Saving…") : L("খসড়া সংরক্ষণ", "Save Draft")}
        </Button>
        <Button disabled={loading || loadError || saving !== null || !rows.length} onClick={() => void saveTargets("submitted")}>
          {saving === "submitted" ? L("জমা হচ্ছে…", "Submitting…") : L("চূড়ান্ত জমা", "Final Submit")}
        </Button>
      </div>
    </section>
  );
}