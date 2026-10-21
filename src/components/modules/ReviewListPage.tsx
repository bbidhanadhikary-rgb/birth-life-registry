import { useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { CaseReview } from "@/components/dashboards/CaseReview";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { scopedCases, useApp } from "@/lib/store";
import { downloadCSV, printPDF } from "@/lib/report";
import { ModuleNavigation } from "./ModuleNavigation";
import type { RegCase } from "@/lib/types";

function searchCase(item: RegCase, query: string, workerNames: string[]) {
  const fields = [
    item.id,
    item.name.bn,
    item.name.en,
    item.father.bn,
    item.father.en,
    item.mother.bn,
    item.mother.en,
    item.nid,
    item.parentMobile ?? "",
    item.details?.fatherBrn ?? "",
    item.details?.motherBrn ?? "",
    item.details?.childBrn ?? "",
    ...workerNames,
  ];
  return fields.some((field) => field.toLocaleLowerCase().includes(query));
}

export function ReviewListPage() {
  const { L, user, state } = useApp();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"birth" | "death">("birth");
  const cases = useMemo(() => (user ? scopedCases(state, user) : []), [state, user]);
  const workerNames = useMemo(
    () => new Map(state.users.map((person) => [person.id, [person.name.bn, person.name.en]])),
    [state.users],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return cases
      .filter((item) => item.type === tab)
      .filter((item) => !query || searchCase(item, query, workerNames.get(item.createdBy) ?? []))
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [cases, search, tab, workerNames]);
  const reportRows = useMemo(
    () => [
      [
        L("Դাখিলকৃত আবেদন", "Application"),
        L("নাম", "Name"),
        L("মোবাইল", "Mobile"),
        L("NID / BRN", "NID / BRN"),
        L("কর্মী", "Field worker"),
        L("অবস্থা", "Status"),
      ],
      ...filtered.map((item) => {
        const names = workerNames.get(item.createdBy);
        return [
          item.id,
          L(item.name.bn, item.name.en),
          item.parentMobile ?? "",
          item.nid,
          names ? L(names[0] ?? "", names[1] ?? "") : "",
          item.status,
        ];
      }),
    ],
    [L, filtered, workerNames],
  );

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6">
      <ModuleNavigation />
      <header className="mb-5">
        <p className="text-sm font-semibold text-emerald-800">
          {L("৩৬৫ দিনের নিবন্ধন কার্যক্রম", "365-day registration workflow")}
        </p>
        <h1 className="font-display text-2xl font-bold text-emerald-950">
          {L("পর্যালোচনা ও কার্যতালিকা", "Review & action list")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {L(
            "নাম, মোবাইল, NID/BRN অথবা মাঠকর্মীর নাম দিয়ে আবেদন খুঁজুন।",
            "Search applications by name, mobile, NID/BRN, or field worker.",
          )}
        </p>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={L(
              "নাম, মোবাইল, NID/BRN বা কর্মীর নাম",
              "Name, mobile, NID/BRN, or worker",
            )}
            aria-label={L("আবেদন অনুসন্ধান", "Search applications")}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            onClick={() => downloadCSV(reportRows, `${tab}-applications.csv`)}
          >
            <Download className="h-4 w-4" />
            {L("CSV / Excel", "Export CSV / Excel")}
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            onClick={() => printPDF(L("নিবন্ধন আবেদন", "Registration applications"), reportRows)}
          >
            <Printer className="h-4 w-4" />
            {L("প্রিন্ট / PDF", "Print / PDF")}
          </button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "birth" | "death")}>
        <TabsList className="h-auto w-full justify-start bg-emerald-50 sm:w-auto">
          <TabsTrigger value="birth" className="min-h-10">
            {L("জন্ম আবেদন", "Birth applications")}
          </TabsTrigger>
          <TabsTrigger value="death" className="min-h-10">
            {L("মৃত্যু আবেদন", "Death applications")}
          </TabsTrigger>
        </TabsList>
        {(["birth", "death"] as const).map((type) => (
          <TabsContent key={type} value={type} className="space-y-3">
            {filtered.length ? (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className="space-y-2 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4"
                >
                  <CaseReview
                    c={item}
                    mode={user?.role === "admin" ? "admin" : "uno"}
                    dedicatedCompletion={user?.role === "admin"}
                  />
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {L("কোনো আবেদন পাওয়া যায়নি।", "No applications found.")}
              </p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
