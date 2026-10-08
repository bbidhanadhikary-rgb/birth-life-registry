import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import type { AppState, RegCase, Status, User } from "@/lib/types";

export function StatusBadge({ s }: { s: Status }) {
  const { L } = useApp();
  const m = {
    pending: ["bg-warning text-warning-foreground", L("অপেক্ষমাণ", "Pending")],
    progress: ["bg-info text-info-foreground", L("চলমান", "In Progress")],
    completed: ["bg-success text-success-foreground", L("সম্পন্ন", "Completed")],
  }[s];
  return <Badge className={`${m[0]} border-0`}>{m[1]}</Badge>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "danger" | undefined }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "danger" ? "border-destructive/50 bg-destructive/10" : "border-border bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function useCaseHelpers() {
  const { L, n, findVillage } = useApp();
  const address = (c: RegCase) => {
    const f = findVillage(c.villageId); if (!f) return "";
    return L(`${f.v.bn}, ${f.un.bn}, ${f.up.bn}, ${f.up.districtBn}`, `${f.v.en}, ${f.un.en}, ${f.up.en}, ${f.up.districtEn}`);
  };
  const date = (t: number) => n(new Date(t).toLocaleDateString(L("bn-BD", "en-GB")));
  const rows = (cases: RegCase[]) => [
    ["ID", "Type", "Name (BN)", "Name (EN)", "NID/BRN", "Address", "Status", "Reg. No", "Created", "Remarks"],
    ...cases.map((c) => [c.id, c.type, c.name.bn, c.name.en, c.nid, address(c), c.status, c.regNo ?? "",
      new Date(c.createdAt).toISOString().slice(0, 10), c.remarks.map((r) => r.text).join(" | ")]),
  ];
  return { address, date, rows };
}

const thisMonth = (t: number) => { const d = new Date(t), now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
export const monthCount = (cases: RegCase[], type: "birth" | "death") => cases.filter((c) => c.type === type && thisMonth(c.createdAt)).length;

/** Workers with zero entries in the last 15 days. */
export function redFlags(state: AppState, upazilaId: string, unionId?: string): User[] {
  const cutoff = Date.now() - 15 * 86400000;
  return state.users.filter((u) => u.role === "worker" && u.upazilaId === upazilaId && (!unionId || u.unionId === unionId))
    .filter((u) => !state.cases.some((c) => c.createdBy === u.id && c.createdAt > cutoff));
}
