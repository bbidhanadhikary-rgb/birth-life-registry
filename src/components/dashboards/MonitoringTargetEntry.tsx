import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getDhakaMonthYear } from "@/lib/monthly-targets";
import { useApp } from "@/lib/store";
import { TARGET } from "@/lib/types";

type TargetRow = {
  unionId: string;
  name: string;
  birth: string;
  death: string;
};

type TargetTotals = { birth: number; death: number };
type SavedTarget = {
  union_id: string;
  birth_target: number;
  death_target: number;
  status: string;
  updated_at: string;
};
type DemoTarget = SavedTarget & { union_name: string };
const DEMO_TARGETS_KEY = "monitoring-union-targets";

function targetValue(value: string) {
  return Number(value) || 0;
}

function readDemoTargets(userId: string, monthYear: string): DemoTarget[] {
  try {
    const stored = localStorage.getItem(`${DEMO_TARGETS_KEY}:${userId}:${monthYear}`);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DemoTarget =>
      typeof item === "object" && item !== null &&
      "union_id" in item && typeof item.union_id === "string" &&
      "union_name" in item && typeof item.union_name === "string" &&
      "birth_target" in item && typeof item.birth_target === "number" &&
      "death_target" in item && typeof item.death_target === "number" &&
      "status" in item && (item.status === "draft" || item.status === "submitted") &&
      "updated_at" in item && typeof item.updated_at === "string",
    );
  } catch (error) {
    console.error("Failed to read demo union targets", error);
    return [];
  }
}

function writeDemoTargets(userId: string, monthYear: string, targets: DemoTarget[]) {
  try {
    localStorage.setItem(`${DEMO_TARGETS_KEY}:${userId}:${monthYear}`, JSON.stringify(targets));
    return true;
  } catch (error) {
    console.error("Failed to save demo union targets", error);
    return false;
  }
}

export function MonitoringTargetEntry({
  onSubmittedTargets,
}: {
  onSubmittedTargets?: (totals: TargetTotals) => void;
}) {
  const { L, n, state, user, demoMode } = useApp();
  const upazila = state.upazilas.find((item) => item.id === user?.upazilaId);
  const monthYear = getDhakaMonthYear();
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [localFallback, setLocalFallback] = useState(false);
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);

  useEffect(() => {
    if (user?.role !== "uno" || !upazila) {
      setRows([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLocalFallback(demoMode);
    const unionIds = upazila.unions.map((union) => union.id);

    void (async () => {
      let savedTargets: SavedTarget[] = [];
      if (demoMode) {
        savedTargets = readDemoTargets(user.id, monthYear);
      } else {
        const { data, error } = await supabase
          .from("union_targets")
          .select("union_id, birth_target, death_target, status, updated_at")
          .eq("month_year", monthYear)
          .in("union_id", unionIds);
        if (error) {
          if (!active) return;
          console.error("Failed to load monitoring targets", error);
          savedTargets = readDemoTargets(user.id, monthYear);
          setLocalFallback(true);
        } else {
          savedTargets = data ?? [];
          setLocalFallback(false);
        }
      }

      if (!active) return;

      const grouped = new Map<string, { draft?: SavedTarget; submitted?: SavedTarget }>();
      for (const record of savedTargets) {
        const target = grouped.get(record.union_id) ?? {};
        if (record.status === "draft") target.draft = record;
        if (record.status === "submitted") target.submitted = record;
        grouped.set(record.union_id, target);
      }

      const nextRows = upazila.unions.map((union) => {
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
      const submittedTotals = upazila.unions.reduce(
        (totals, union) => {
          const submitted = grouped.get(union.id)?.submitted;
          totals.birth += submitted?.birth_target ?? TARGET.birth;
          totals.death += submitted?.death_target ?? TARGET.death;
          return totals;
        },
        { birth: 0, death: 0 },
      );

      setRows(nextRows);
      onSubmittedTargets?.(submittedTotals);
      setLoading(false);
    })();

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
    if (!upazila || saving || !rows.length) return;
    if (rows.some((row) =>
      !/^\d+$/.test(row.birth) || !/^\d+$/.test(row.death) ||
      !Number.isSafeInteger(Number(row.birth)) || !Number.isSafeInteger(Number(row.death)),
    )) {
      toast.error(L("প্রতিটি লক্ষ্যমাত্রা পূর্ণসংখ্যা হতে হবে", "Targets must be whole numbers"));
      return;
    }

    setSaving(status);
    const savedAt = new Date().toISOString();
    const savedRows = rows.map((row) => ({
      union_id: row.unionId,
      union_name: upazila.unions.find((union) => union.id === row.unionId)?.bn ?? row.name,
      birth_target: Number(row.birth),
      death_target: Number(row.death),
      status,
      updated_at: savedAt,
    }));

    try {
      let savedOnDevice = demoMode || localFallback;
      if (savedOnDevice) {
        const previousTargets = readDemoTargets(user.id, monthYear);
        const nextTargets = [
          ...previousTargets.filter((target) =>
            !savedRows.some((row) => row.union_id === target.union_id && target.status === status),
          ),
          ...savedRows,
        ];
        if (!writeDemoTargets(user.id, monthYear, nextTargets)) {
          throw new Error("Could not persist monitoring targets on this device");
        }
      } else {
        const { error } = await supabase.from("union_targets").upsert(
          savedRows.map((row) => ({ ...row, month_year: monthYear })),
          { onConflict: "union_id,month_year,status" },
        );
        if (error) {
          console.error(`Failed to save ${status} monitoring targets to Supabase`, error);
          const previousTargets = readDemoTargets(user.id, monthYear);
          const nextTargets = [
            ...previousTargets.filter((target) =>
              !savedRows.some((row) => row.union_id === target.union_id && target.status === status),
            ),
            ...savedRows,
          ];
          if (!writeDemoTargets(user.id, monthYear, nextTargets)) throw error;
          savedOnDevice = true;
          setLocalFallback(true);
        }
      }

      if (status === "submitted") onSubmittedTargets?.({ birth: birthTotal, death: deathTotal });
      toast.success(savedOnDevice && !demoMode
        ? L("সার্ভারে সংরক্ষণ হয়নি; তথ্য এই ডিভাইসে সংরক্ষিত হয়েছে", "Server unavailable; saved on this device")
        : status === "draft"
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
          <p className="text-xs text-muted-foreground">{L(`মাস: ${monthYear.slice(0, 7)}`, `Month: ${monthYear.slice(0, 7)}`)}</p>
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
        <Button variant="outline" disabled={loading || saving !== null || !rows.length} onClick={() => void saveTargets("draft")}>
          {saving === "draft" ? L("সংরক্ষণ হচ্ছে…", "Saving…") : L("খসড়া সংরক্ষণ", "Save Draft")}
        </Button>
        <Button disabled={loading || saving !== null || !rows.length} onClick={() => void saveTargets("submitted")}>
          {saving === "submitted" ? L("জমা হচ্ছে…", "Submitting…") : L("চূড়ান্ত জমা", "Final Submit")}
        </Button>
      </div>
    </section>
  );
}