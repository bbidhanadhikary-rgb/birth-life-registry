import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardClock } from "lucide-react";
import { roleLabel, useApp } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { ModuleNavigation } from "./ModuleNavigation";

type AuditRow = Database["public"]["Tables"]["audit_logs"]["Row"];
type AuditChange = { old: Json; new: Json };
type JsonRecord = { [key: string]: Json | undefined };

const fieldLabels: Record<string, string> = {
  name_bn: "নাম (বাংলা) / Name (Bangla)",
  name_en: "Name (English)",
  father_bn: "পিতার নাম (বাংলা) / Father's name (Bangla)",
  father_en: "Father's name (English)",
  mother_bn: "মাতার নাম (বাংলা) / Mother's name (Bangla)",
  mother_en: "Mother's name (English)",
  nid: "NID / BRN",
  parent_mobile: "মোবাইল / Mobile",
  gender: "লিঙ্গ / Gender",
  dob: "জন্মতারিখ / Date of birth",
  child_order: "সন্তানের ক্রম / Birth order",
  dod: "মৃত্যুর তারিখ / Date of death",
  cause_bn: "মৃত্যুর কারণ (বাংলা) / Cause (Bangla)",
  cause_en: "Cause of death (English)",
  village_id: "গ্রাম / Village",
  details: "অতিরিক্ত তথ্য / Additional details",
  status: "অবস্থা / Status",
  reg_no: "নিবন্ধন নম্বর / Registration number",
  police_task: "যাচাইয়ের কাজ / Police task",
};

function isRecord(value: Json | null | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formattedValue(value: Json | undefined, L: (bn: string, en: string) => string) {
  if (value === undefined || value === null || value === "") return L("নেই", "Not set");
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(" → ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseChanges(details: Json | null): [string, AuditChange][] {
  if (!isRecord(details)) return [];
  const changes = details["changes"];
  if (!isRecord(changes)) return [];
  return Object.entries(changes).flatMap(([field, change]) => {
    if (!isRecord(change)) return [];
    const oldValue = change["old"];
    const newValue = change["new"];
    if (oldValue === undefined || newValue === undefined) return [];
    return [[field, { old: oldValue, new: newValue }]];
  });
}

export function CorrectionLogPage() {
  const { L, state } = useApp();
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from("audit_logs")
          .select("*")
          .order("at", { ascending: false })
          .limit(200);
        if (queryError) throw queryError;
        if (active) setEntries(data ?? []);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : L("সংশোধন লগ লোড করা যায়নি", "Could not load correction history"),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [L]);

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6">
      <ModuleNavigation />
      <header className="mb-5">
        <p className="text-sm font-semibold text-emerald-800">
          {L("নিরাপদ নিরীক্ষা ট্রেইল", "Secure audit trail")}
        </p>
        <h1 className="font-display text-2xl font-bold text-emerald-950">
          {L("সংশোধন ও কার্যক্রমের ইতিহাস", "Correction & activity history")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {L(
            "সর্বশেষ ২০০টি কার্যক্রম; পুরোনো ও পরিবর্তিত মানসহ।",
            "Most recent 200 activities, including before-and-after values.",
          )}
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border bg-white p-6 text-sm text-muted-foreground" role="status">
          {L("লগ লোড হচ্ছে…", "Loading audit history…")}
        </p>
      ) : entries.length ? (
        <div className="space-y-3">
          {entries.map((entry) => {
            const editor = state.users.find((person) => person.id === entry.user_id);
            const changes = parseChanges(entry.details);
            const targetCase = entry.case_id
              ? state.cases.find((item) => item.id === entry.case_id)
              : undefined;
            return (
              <article
                key={entry.id}
                className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <ClipboardClock className="mt-0.5 h-5 w-5 text-emerald-800" />
                    <div>
                      <h2 className="font-semibold text-emerald-950">
                        {entry.action}
                        {targetCase ? ` · ${L(targetCase.name.bn, targetCase.name.en)}` : ""}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {editor
                          ? L(editor.name.bn, editor.name.en)
                          : (entry.user_id ?? L("অজানা ব্যবহারকারী", "Unknown user"))}
                        {" · "}
                        {editor
                          ? roleLabel(editor.role, L)
                          : L("ভূমিকা পাওয়া যায়নি", "Role unavailable")}
                      </p>
                    </div>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={entry.at}>
                    {new Intl.DateTimeFormat(L("bn-BD", "en-GB"), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Dhaka",
                    }).format(new Date(entry.at))}
                  </time>
                </div>

                {changes.length ? (
                  <div className="mt-3 overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <thead className="bg-emerald-50 text-emerald-950">
                        <tr>
                          <th className="px-3 py-2 font-semibold">
                            {L("পরিবর্তিত ক্ষেত্র", "Changed field")}
                          </th>
                          <th className="px-3 py-2 font-semibold">
                            {L("আগের তথ্য", "Previous value")}
                          </th>
                          <th className="px-3 py-2 font-semibold">
                            {L("পরিবর্তিত তথ্য", "Updated value")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map(([field, change]) => (
                          <tr key={field} className="border-t">
                            <th scope="row" className="px-3 py-2 font-medium">
                              {fieldLabels[field] ?? field}
                            </th>
                            <td className="max-w-md break-words px-3 py-2 text-muted-foreground">
                              {formattedValue(change.old, L)}
                            </td>
                            <td className="max-w-md break-words px-3 py-2">
                              {formattedValue(change.new, L)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
                    {L(
                      "এই পুরোনো লগে ক্ষেত্রভিত্তিক পরিবর্তনের তথ্য সংরক্ষিত ছিল না।",
                      "This older log does not contain field-level before-and-after values.",
                    )}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {L("এখনও কোনো নিরীক্ষা লগ নেই।", "No audit records are available yet.")}
        </p>
      )}
    </main>
  );
}
