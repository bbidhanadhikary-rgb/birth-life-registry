import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Baby,
  CalendarCheck2,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  HeartPulse,
  Home,
  Inbox,
  MapPinned,
  MessageSquareWarning,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Footer } from "@/components/Footer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCaseDeadline, getDeadlineBand } from "@/lib/compliance";
import { BANGLADESH_ADMINISTRATIVE_AREAS, filterCasesByAdministrativeArea, getAdministrativeWards, sameAdministrativeName } from "@/lib/geography";
import { TARGET, type RegCase, type Role } from "@/lib/types";
import { scopedCases, useApp } from "@/lib/store";
import { RegForm } from "@/components/dashboards/Worker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, useCaseHelpers } from "@/components/shared";
import { downloadCSV, printPDF } from "@/lib/report";

type DashboardRole = Role | "public";
type ActionFilter = "birth" | "death" | "pending" | "progress" | "completed" | "urgent";
type RoleAction = {
  id: string;
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
  Icon: typeof MapPinned;
  filter?: ActionFilter;
};

function ApplicationList({
  type,
  cases,
  canReject,
  onNew,
  onReject,
}: {
  type: "birth" | "death";
  cases: RegCase[];
  canReject: boolean;
  onNew?: () => void;
  onReject: (item: RegCase) => void;
}) {
  const { L, n } = useApp();
  const { address, rows } = useCaseHelpers();
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "approved">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const completed = cases.filter((item) => item.status === "completed");
  const filtered = cases.filter((item) => {
    if (view === "approved" && item.status !== "completed") return false;
    const query = search.trim().toLocaleLowerCase();
    return !query || [item.id, item.name.bn, item.name.en, item.father.bn, item.father.en, item.mother.bn, item.mother.en]
      .some((value) => value.toLocaleLowerCase().includes(query));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const first = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const last = Math.min(currentPage * pageSize, filtered.length);
  const title = type === "birth" ? L("জন্ম নিবন্ধনের আবেদন", "Birth Registration Applications") : L("মৃত্যু নিবন্ধনের আবেদন", "Death Registration Applications");

  return (
    <section className="space-y-4" aria-label={title}>
      <nav className="flex flex-wrap gap-2" aria-label={L("আবেদন তালিকা কার্যক্রম", "Application list actions")}>
        <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={onNew} disabled={!onNew}>
          {L("নতুন আবেদন", "New Application")}
        </Button>
        <Button className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => printPDF(L("অনুমোদিত আবেদন", "Approved applications"), rows(completed))}>
          {L("প্রিন্ট অনুমোদিত", "Print Approved")}
        </Button>
        <Button className={view === "approved" ? "bg-slate-800 text-white hover:bg-slate-900" : "bg-slate-600 text-white hover:bg-slate-700"} onClick={() => { setView((current) => current === "approved" ? "all" : "approved"); setPage(1); }}>
          {L("পুরাতন সনদ", "Old Certificate")}
        </Button>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2">
          {L("দেখুন", "Show")}
          <select className="h-9 rounded-md border border-input bg-background px-2" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
            {[10, 25, 50].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
          {L("টি এন্ট্রি", "entries")}
        </label>
        <label className="flex items-center gap-2">
          {L("খুঁজুন:", "Search:")}
          <Input className="h-9 w-48" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-emerald-100">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead className="bg-emerald-50 text-emerald-950">
            <tr>
              {[L("ক্রমিক নং", "SL"), L("আবেদন নং", "App No"), L("নাম", "Name"), L("পিতার নাম", "Father's Name"), L("মাতার নাম", "Mother's Name"), L("অবস্থা", "Status"), L("কার্যক্রম", "Action")].map((heading) => <th key={heading} className="whitespace-nowrap border-b border-emerald-100 px-3 py-2.5 font-semibold">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((item, index) => (
              <Fragment key={item.id}>
                <tr className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                  <td className="px-3 py-2.5">{n(first + index)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{item.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-3 py-2.5 font-medium">{L(item.name.bn, item.name.en)}</td>
                  <td className="px-3 py-2.5">{L(item.father.bn, item.father.en)}</td>
                  <td className="px-3 py-2.5">{L(item.mother.bn, item.mother.en)}</td>
                  <td className="px-3 py-2.5"><StatusBadge s={item.status} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-8 bg-emerald-700 px-2 text-white hover:bg-emerald-800" onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}>
                        <Eye className="mr-1 h-3.5 w-3.5" />{L("দেখুন", "View")}
                      </Button>
                      {canReject && item.status !== "completed" && item.status !== "rejected" && (
                        <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => onReject(item)}>
                          <X className="mr-1 h-3.5 w-3.5" />{L("বাতিল", "Reject")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === item.id && (
                  <tr className="border-b border-emerald-100 bg-emerald-50/60">
                    <td colSpan={7} className="px-4 py-3 text-sm">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <span>{L("জন্ম তারিখ", "Date of birth")}: {item.dob}</span>
                        {item.dod && <span>{L("মৃত্যুর তারিখ", "Date of death")}: {item.dod}</span>}
                        <span>{L("মোবাইল", "Mobile")}: {item.parentMobile ?? "—"}</span>
                        <span className="sm:col-span-2">{L("ঠিকানা", "Address")}: {address(item) || "—"}</span>
                        <span>{L("NID", "NID")}: {item.nid || "—"}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!visible.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{L("কোনো আবেদন পাওয়া যায়নি", "No applications found")}</td></tr>}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{L(`দেখানো হচ্ছে ${n(first)} থেকে ${n(last)} / ${n(filtered.length)}টি এন্ট্রি`, `Showing ${first} to ${last} of ${filtered.length} entries`)}</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{L("আগের", "Previous")}</Button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 3).map((number) => <Button key={number} size="sm" variant={number === currentPage ? "default" : "outline"} onClick={() => setPage(number)}>{n(number)}</Button>)}
          <Button size="sm" variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>{L("পরের", "Next")}</Button>
        </div>
      </footer>
    </section>
  );
}

function monthKey(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).format(timestamp);
}

const publicActions: RoleAction[] = [
  { id: "dashboard", titleBn: "ড্যাশবোর্ড", titleEn: "Dashboard", descriptionBn: "জাতীয় ও স্থানীয় অগ্রগতি দেখুন", descriptionEn: "View national and local progress", Icon: MapPinned },
  { id: "reports", titleBn: "এলাকাভিত্তিক প্রতিবেদন", titleEn: "Regional reports", descriptionBn: "প্রশাসনিক এলাকার সারসংক্ষেপ", descriptionEn: "Administrative area summaries", Icon: ClipboardCheck },
  { id: "deadlines", titleBn: "সময়সীমা পর্যবেক্ষণ", titleEn: "Deadline monitoring", descriptionBn: "৩৬৫ দিনের সম্মতি ও সতর্কতা", descriptionEn: "365-day compliance and alerts", Icon: CalendarCheck2, filter: "urgent" },
  { id: "security", titleBn: "নিরাপদ প্রবেশ", titleEn: "Secure access", descriptionBn: "ভূমিকা-ভিত্তিক লগইন ও সেশন ব্যবস্থাপনা", descriptionEn: "Role-based sign-in and session management", Icon: ShieldCheck },
];

const roleActions: Record<Exclude<DashboardRole, "public" | "super" | "district">, RoleAction[]> = {
  worker: [
    { id: "birth-entry", titleBn: "শিশুর জন্ম তথ্য ও ডকুমেন্টস আপলোড", titleEn: "Child birth info & documents upload", descriptionBn: "নতুন জন্ম তথ্য ও ৩টি ডকুমেন্ট জমা দিন", descriptionEn: "Submit new birth details with documents", Icon: Baby, filter: "birth" },
    { id: "death-entry", titleBn: "মৃত ব্যক্তির তথ্য ও ডকুমেন্টস আপলোড", titleEn: "Deceased person info & documents upload", descriptionBn: "নতুন মৃত্যু তথ্য ও ডকুমেন্ট জমা দিন", descriptionEn: "Submit new death details with documents", Icon: HeartPulse, filter: "death" },
    { id: "birth-correction", titleBn: "শিশুর জন্ম তথ্য সংশোধন", titleEn: "Correction of child birth info", descriptionBn: "অমীমাংসিত জন্ম এন্ট্রি সংশোধন করুন", descriptionEn: "Correct pending birth entries", Icon: PencilLine, filter: "birth" },
    { id: "death-correction", titleBn: "মৃত ব্যক্তির তথ্য সংশোধন", titleEn: "Correction of deceased person info", descriptionBn: "অমীমাংসিত মৃত্যু এন্ট্রি সংশোধন করুন", descriptionEn: "Correct pending death entries", Icon: PencilLine, filter: "death" },
    { id: "birth-list", titleBn: "জন্ম নিবন্ধনের আবেদন তালিকা দেখুন", titleEn: "View birth registration application list", descriptionBn: "জমা দেওয়া জন্ম আবেদন ও মন্তব্য", descriptionEn: "Submitted birth applications and remarks", Icon: FileText, filter: "birth" },
    { id: "death-list", titleBn: "মৃত্যু নিবন্ধনের আবেদন তালিকা দেখুন", titleEn: "View death registration application list", descriptionBn: "জমা দেওয়া মৃত্যু আবেদন ও মন্তব্য", descriptionEn: "Submitted death applications and remarks", Icon: FileCheck2, filter: "death" },
    { id: "worker-report", titleBn: "রিপোর্ট", titleEn: "Reports", descriptionBn: "আমার রিপোর্ট ডাউনলোড করুন (Excel/PDF)", descriptionEn: "Download my report (Excel/PDF)", Icon: Download },
    { id: "feedback", titleBn: "অভিযোগ জানান বা পরামর্শ দিন", titleEn: "Submit complaint or suggestion", descriptionBn: "উপজেলা আইসিটি সহায়তা দলকে জানান", descriptionEn: "Reach the Upazila ICT support team", Icon: MessageSquareWarning },
  ],
  police: [
    { id: "assigned", titleBn: "নির্ধারিত যাচাই", titleEn: "Assigned checks", descriptionBn: "আপনার ওয়ার্ডের যাচাইযোগ্য কেস", descriptionEn: "Cases assigned in your ward", Icon: Home, filter: "pending" },
    { id: "birth-checks", titleBn: "জন্ম যাচাই", titleEn: "Birth checks", descriptionBn: "জন্ম নিবন্ধনের কাগজ যাচাই করুন", descriptionEn: "Check documents for birth registration", Icon: Baby, filter: "birth" },
    { id: "death-checks", titleBn: "মৃত্যু যাচাই", titleEn: "Death checks", descriptionBn: "মৃত্যু নিবন্ধনের তথ্য যাচাই করুন", descriptionEn: "Verify death registration information", Icon: HeartPulse, filter: "death" },
    { id: "epi-cards", titleBn: "EPI কার্ড", titleEn: "EPI cards", descriptionBn: "EPI কার্ড যাচাইয়ের কেস দেখুন", descriptionEn: "Review cases requiring EPI card checks", Icon: ClipboardCheck, filter: "birth" },
    { id: "nid-checks", titleBn: "NID যাচাই", titleEn: "NID checks", descriptionBn: "অভিভাবকের NID যাচাইয়ের কেস", descriptionEn: "Review cases requiring parent NID checks", Icon: UserRoundCheck, filter: "pending" },
    { id: "collection-pending", titleBn: "সংগ্রহ বাকি", titleEn: "Collection pending", descriptionBn: "যেসব কাগজ সংগ্রহ বাকি", descriptionEn: "Documents still waiting to be collected", Icon: Inbox, filter: "pending" },
    { id: "collection-done", titleBn: "যাচাই সম্পন্ন", titleEn: "Checks completed", descriptionBn: "সম্পন্ন যাচাইয়ের কেস", descriptionEn: "Cases with completed verification", Icon: CheckCheck, filter: "completed" },
    { id: "ward-report", titleBn: "ওয়ার্ড প্রতিবেদন", titleEn: "Ward report", descriptionBn: "ওয়ার্ডের জন্ম ও মৃত্যু কেস", descriptionEn: "Birth and death cases in your ward", Icon: ChartNoAxesCombined },
  ],
  admin: [
    { id: "birth-review", titleBn: "জন্ম পর্যালোচনা", titleEn: "Birth review", descriptionBn: "জন্ম নিবন্ধনের আবেদন পর্যালোচনা করুন", descriptionEn: "Review birth registration applications", Icon: Baby, filter: "birth" },
    { id: "death-review", titleBn: "মৃত্যু পর্যালোচনা", titleEn: "Death review", descriptionBn: "মৃত্যু নিবন্ধনের আবেদন পর্যালোচনা করুন", descriptionEn: "Review death registration applications", Icon: HeartPulse, filter: "death" },
    { id: "birth-list", titleBn: "জন্ম আবেদনের তালিকা", titleEn: "Birth applications", descriptionBn: "জন্ম আবেদন দেখুন ও সিদ্ধান্ত নিন", descriptionEn: "View and process birth applications", Icon: FileText, filter: "birth" },
    { id: "death-list", titleBn: "মৃত্যু আবেদনের তালিকা", titleEn: "Death applications", descriptionBn: "মৃত্যু আবেদন দেখুন ও সিদ্ধান্ত নিন", descriptionEn: "View and process death applications", Icon: FileCheck2, filter: "death" },
    { id: "pending-cases", titleBn: "অপেক্ষমাণ আবেদন", titleEn: "Pending applications", descriptionBn: "পর্যালোচনার অপেক্ষায় থাকা কেস", descriptionEn: "Cases awaiting review", Icon: Inbox, filter: "pending" },
    { id: "progress-cases", titleBn: "চলমান কেস", titleEn: "Cases in progress", descriptionBn: "চলমান নিবন্ধন কার্যক্রম", descriptionEn: "Registration work in progress", Icon: Clock3, filter: "progress" },
    { id: "police-tasks", titleBn: "পুলিশ যাচাই", titleEn: "Police verification", descriptionBn: "ওয়ার্ড যাচাইয়ের জন্য পাঠানো কেস", descriptionEn: "Cases assigned for ward verification", Icon: UserRoundCheck, filter: "pending" },
    { id: "urgent-cases", titleBn: "সময়সীমা সতর্কতা", titleEn: "Deadline alerts", descriptionBn: "৩৬৫ দিনের সময়সীমার কাছাকাছি কেস", descriptionEn: "Cases approaching the 365-day deadline", Icon: ShieldAlert, filter: "urgent" },
    { id: "completed-cases", titleBn: "সম্পন্ন নিবন্ধন", titleEn: "Completed registrations", descriptionBn: "চূড়ান্ত নিবন্ধন সম্পন্ন কেস", descriptionEn: "Cases with completed registration", Icon: CheckCheck, filter: "completed" },
    { id: "union-report", titleBn: "ইউনিয়ন প্রতিবেদন", titleEn: "Union report", descriptionBn: "ইউনিয়নের জন্ম ও মৃত্যু অগ্রগতি", descriptionEn: "Birth and death progress for the union", Icon: Download },
  ],
  uno: [
    { id: "upazila-progress", titleBn: "উপজেলা অগ্রগতি", titleEn: "Upazila progress", descriptionBn: "সামগ্রিক নিবন্ধন অগ্রগতি দেখুন", descriptionEn: "Review overall registration progress", Icon: MapPinned },
    { id: "upazila-births", titleBn: "জন্ম নিবন্ধন", titleEn: "Birth registrations", descriptionBn: "উপজেলার জন্ম নিবন্ধনের কেস", descriptionEn: "Birth registration cases across the upazila", Icon: Baby, filter: "birth" },
    { id: "upazila-deaths", titleBn: "মৃত্যু নিবন্ধন", titleEn: "Death registrations", descriptionBn: "উপজেলার মৃত্যু নিবন্ধনের কেস", descriptionEn: "Death registration cases across the upazila", Icon: HeartPulse, filter: "death" },
    { id: "birth-list", titleBn: "জন্ম আবেদনের তালিকা", titleEn: "Birth applications", descriptionBn: "উপজেলার জন্ম আবেদন দেখুন", descriptionEn: "View upazila birth applications", Icon: FileText, filter: "birth" },
    { id: "death-list", titleBn: "মৃত্যু আবেদনের তালিকা", titleEn: "Death applications", descriptionBn: "উপজেলার মৃত্যু আবেদন দেখুন", descriptionEn: "View upazila death applications", Icon: FileCheck2, filter: "death" },
    { id: "upazila-pending", titleBn: "অপেক্ষমাণ কেস", titleEn: "Pending cases", descriptionBn: "বিভিন্ন ইউনিয়নের অপেক্ষমাণ কেস", descriptionEn: "Pending cases across unions", Icon: Inbox, filter: "pending" },
    { id: "compliance-audit", titleBn: "সম্মতি নিরীক্ষা", titleEn: "Compliance audit", descriptionBn: "৩৬৫ দিনের সম্মতি ও জরুরি সতর্কতা", descriptionEn: "365-day compliance and urgency alerts", Icon: ShieldCheck, filter: "urgent" },
    { id: "upazila-progress-cases", titleBn: "চলমান নিবন্ধন", titleEn: "Registrations in progress", descriptionBn: "চলমান জন্ম ও মৃত্যু নিবন্ধন", descriptionEn: "Birth and death registrations in progress", Icon: Clock3, filter: "progress" },
    { id: "upazila-completed", titleBn: "সম্পন্ন কেস", titleEn: "Completed cases", descriptionBn: "চূড়ান্ত নিবন্ধন সম্পন্ন কেস", descriptionEn: "Cases with completed registration", Icon: CheckCheck, filter: "completed" },
    { id: "master-report", titleBn: "মাস্টার প্রতিবেদন", titleEn: "Master report", descriptionBn: "উপজেলাভিত্তিক জন্ম ও মৃত্যু সারসংক্ষেপ", descriptionEn: "Upazila birth and death summary", Icon: FileText },
  ],
};

export function RegistrationDashboard({ role = "public" }: { role?: DashboardRole }) {
  const { state, L, n, user, demoMode, patchCase } = useApp();
  const { rows } = useCaseHelpers();
  const [editEntry, setEditEntry] = useState<RegCase | null>(null);
  const [division, setDivision] = useState("all");
  const [district, setDistrict] = useState("all");
  const [upazila, setUpazila] = useState("all");
  const [union, setUnion] = useState("all");
  const [ward, setWard] = useState("all");
  const [activeCard, setActiveCard] = useState<{ kind: "metric" | "action"; id: string } | null>(
    null,
  );
  const [correctionSearch, setCorrectionSearch] = useState("");
  const [wardMonthlyCounts, setWardMonthlyCounts] = useState<{
    pending: number;
    progress: number;
    completed: number;
    total: number;
  } | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<"complaint" | "suggestion">("suggestion");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const metrics = [
    {
      id: "districts",
      value: "64",
      label: L("জেলা", "Districts"),
      detail: L("দেশজুড়ে প্রশাসনিক এলাকা", "Administrative areas nationwide"),
      Icon: MapPinned,
    },
    {
      id: "compliance",
      value: "365",
      label: L("দিনের সম্মতি", "Day Compliance"),
      detail: L("আইনি নিবন্ধন সময়সীমা", "Statutory registration window"),
      Icon: CalendarCheck2,
    },
    {
      id: "tiers",
      value: "8",
      label: L("প্রশাসনিক স্তর", "Administrative Tiers"),
      detail: L("জাতীয় থেকে ওয়ার্ড পর্যায়", "National to ward level"),
      Icon: ClipboardCheck,
    },
    {
      id: "target",
      value: "100%",
      label: L("লক্ষ্যমাত্রা", "Target"),
      detail: L("প্রতিটি জন্ম ও মৃত্যু নিবন্ধিত", "Every birth and death registered"),
      Icon: ShieldCheck,
    },
  ];
  const roleConfig = role === "super" || role === "district" ? "uno" : role;
  const actions = (roleConfig === "public" ? publicActions : roleActions[roleConfig]).map(
    ({ titleBn, titleEn, descriptionBn, descriptionEn, ...action }) => ({
      ...action,
      title: L(titleBn, titleEn),
      description: L(descriptionBn, descriptionEn),
    }),
  );
  const divisions = useMemo(
    () => BANGLADESH_ADMINISTRATIVE_AREAS.filter((area) => area.level === "division"),
    [],
  );
  const districts = useMemo(() => {
    return BANGLADESH_ADMINISTRATIVE_AREAS.filter(
      (area) => area.level === "district" && (division === "all" || area.divisionId === division),
    );
  }, [division]);
  const selectedDistrict = districts.find((area) => area.id === district);
  const matchingUpazilas = useMemo(() => {
    const districtsInScope = new Set(districts.map((area) => area.id));
    return BANGLADESH_ADMINISTRATIVE_AREAS.filter(
      (area) =>
        (area.level === "upazila" || area.level === "city_corporation") &&
        districtsInScope.has(area.districtId ?? "") &&
        (!selectedDistrict || area.districtId === selectedDistrict.id),
    );
  }, [districts, selectedDistrict]);
  const selectedUpazila = matchingUpazilas.find((area) => area.id === upazila);
  const selectedCityCorporation = selectedUpazila?.level === "city_corporation";
  const unions = useMemo(
    () =>
      BANGLADESH_ADMINISTRATIVE_AREAS.filter(
        (area) =>
          (area.level === "union" || area.level === "municipality") &&
          !selectedCityCorporation &&
          area.parentId === selectedUpazila?.id,
      ),
    [selectedCityCorporation, selectedUpazila],
  );
  const selectedUnion = unions.find((area) => area.id === union);
  const wards = useMemo(
    () => {
      if (selectedCityCorporation && selectedUpazila) {
        return getAdministrativeWards(selectedUpazila.id);
      }
      if (selectedUnion) return getAdministrativeWards(selectedUnion.id);
      return Array.from({ length: 9 }, (_, index) => ({
        id: `ward-${index + 1}`,
        level: "ward" as const,
        bn: `ওয়ার্ড ${index + 1}`,
        en: `Ward ${index + 1}`,
        parentId: null,
        divisionId: "",
        districtId: null,
        municipalityId: null,
        upazilaId: null,
        unionId: null,
        wardNumber: index + 1,
      }));
    },
    [selectedCityCorporation, selectedUnion, selectedUpazila],
  );
  const roleScopedCases = useMemo(
    () => {
      if (!user) return state.cases;
      if (demoMode && (user.role === "worker" || user.role === "police")) {
        return state.cases.filter(
          (item) =>
            item.upazilaId === user.upazilaId &&
            item.unionId === user.unionId &&
            item.ward === user.ward,
        );
      }
      return scopedCases(state, user);
    },
    [demoMode, state, user],
  );
  const filteredCases = useMemo(() => {
    const areaCases = filterCasesByAdministrativeArea(roleScopedCases, state.upazilas, {
      division,
      district,
      upazila,
      union,
      ward,
    });
    return user && (user.role === "worker" || user.role === "police")
      ? areaCases.filter((item) => item.ward === user.ward)
      : areaCases;
  }, [roleScopedCases, state.upazilas, division, district, upazila, union, ward, user]);
  const currentMonth = monthKey(Date.now());
  const monthCases = filteredCases.filter((item) => monthKey(item.createdAt) === currentMonth);
  const localMonthlyCounts = {
    pending: monthCases.filter((item) => item.status === "pending").length,
    progress: monthCases.filter((item) => item.status === "progress").length,
    completed: monthCases.filter((item) => item.status === "completed").length,
  };
  useEffect(() => {
    if (demoMode || !user || (user.role !== "worker" && user.role !== "police")) {
      setWardMonthlyCounts(null);
      return;
    }
    let active = true;
    void supabase.rpc("monthly_ward_case_counts").then(({ data, error }) => {
      if (!active) return;
      const row = data?.[0];
      setWardMonthlyCounts(error || !row ? null : {
        pending: Number(row.pending_count),
        progress: Number(row.progress_count),
        completed: Number(row.completed_count),
        total: Number(row.total_count),
      });
    }, () => {
      if (active) setWardMonthlyCounts(null);
    });
    return () => {
      active = false;
    };
  }, [demoMode, user]);
  const hasWardAggregate = !demoMode && (user?.role === "worker" || user?.role === "police");
  const hasAreaFilter = division !== "all" || district !== "all" || upazila !== "all" || union !== "all" || ward !== "all";
  const monthlyCounts = hasWardAggregate && !hasAreaFilter
    ? wardMonthlyCounts ?? { pending: 0, progress: 0, completed: 0, total: 0 }
    : localMonthlyCounts;
  const matchingRegisteredUpazilas = state.upazilas.filter((registered) =>
    matchingUpazilas.some(
      (area) => sameAdministrativeName(registered.en, area.en) || sameAdministrativeName(registered.bn, area.bn),
    ),
  );
  const assignedUpazila = user && state.upazilas.find((item) => item.id === user.upazilaId);
  const assignedUnion = assignedUpazila?.unions.find((item) => item.id === user?.unionId);
  const assignedWardCount = assignedUnion
    ? new Set(assignedUnion.villages.map((village) => village.ward)).size || 9
    : 9;
  const selectedUnionCount = selectedUnion
    ? 1
    : matchingRegisteredUpazilas.reduce((count, item) => count + item.unions.length, 0);
  const monthlyTarget = Math.max(
    1,
    roleConfig === "uno" && user?.role === "uno"
      ? (assignedUpazila?.unions.length ?? 1) * (TARGET.birth + TARGET.death)
      : roleConfig === "admin" && user?.role === "admin"
        ? TARGET.birth + TARGET.death
        : (roleConfig === "worker" || roleConfig === "police") && user?.role === roleConfig
          ? Math.ceil((TARGET.birth + TARGET.death) / assignedWardCount)
          : roleConfig === "uno"
            ? Math.max(1, selectedUnionCount) * (TARGET.birth + TARGET.death)
            : roleConfig === "worker" || roleConfig === "police"
              ? Math.ceil((TARGET.birth + TARGET.death) / 9)
              : Math.max(1, selectedUnionCount) * (TARGET.birth + TARGET.death),
  );
  const monthlyReceived = hasWardAggregate && !hasAreaFilter
    ? wardMonthlyCounts?.total ?? 0
    : monthCases.length;
  const donutTotal = Math.max(monthlyTarget, monthlyReceived, 1);
  const donutCircumference = 2 * Math.PI * 88;
  const donutSegments = [
    { id: "completed", value: monthlyCounts.completed, color: "#10b981" },
    { id: "pending", value: monthlyCounts.pending, color: "#3b82f6" },
    { id: "progress", value: monthlyCounts.progress, color: "#f59e0b" },
  ];
  const monthlyCompletion = Math.min(100, Math.round((monthlyCounts.completed / monthlyTarget) * 100));
  const openCases = filteredCases.filter((item) => item.status !== "completed" && item.status !== "rejected");
  const urgency = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0, expired: 0, review: 0 };
    for (const item of openCases) {
      const deadline = getCaseDeadline(item);
      if (!deadline) {
        counts.review += 1;
      } else {
        const band = getDeadlineBand(deadline.elapsedDays);
        if (band === "safe") counts.green += 1;
        else if (band === "warning") counts.yellow += 1;
        else if (band === "near-deadline") counts.red += 1;
        else counts.expired += 1;
      }
    }
    return counts;
  }, [openCases]);
  const currentCard =
    activeCard &&
    (activeCard.kind === "metric"
      ? metrics.map((item) => ({ id: item.id, title: item.label, description: item.detail }))
      : actions.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
        }))
    ).find((item) => item.id === activeCard.id);
  const activeAction =
    activeCard?.kind === "action" ? actions.find((item) => item.id === activeCard.id) : undefined;
  const actionCases = activeAction?.filter
    ? filteredCases.filter((item) => {
        if (activeAction.filter === "birth" || activeAction.filter === "death") {
          return item.type === activeAction.filter;
        }
        if (activeAction.filter === "pending" || activeAction.filter === "progress" || activeAction.filter === "completed") {
          return item.status === activeAction.filter;
        }
        const deadline = getCaseDeadline(item);
        return item.status !== "completed" && item.status !== "rejected" && !!deadline && deadline.elapsedDays > 180;
      })
    : filteredCases;
  const applicationListType =
    activeAction?.id === "birth-list" ? "birth" : activeAction?.id === "death-list" ? "death" : null;
  const completionPercent =
    filteredCases.length === 0
      ? 0
      : Math.round(
          (filteredCases.filter((item) => item.status === "completed").length /
            filteredCases.length) *
            100,
        );
  const selectedAreas = [
    division !== "all" && divisions.find((item) => item.id === division)?.bn,
    selectedDistrict?.bn,
    upazila !== "all" && selectedUpazila?.bn,
    union !== "all" && selectedUnion?.bn,
    ward !== "all" && wards.find((item) => item.id === ward)?.bn,
  ].filter(Boolean);
  const scopeLabel = selectedAreas.length
    ? selectedAreas.join(" · ")
    : L("জাতীয় পর্যায়", "National scope");

  const isEntryCard = activeCard?.id === "birth-entry" || activeCard?.id === "death-entry";
  const formType: "birth" | "death" | null =
    activeCard?.id === "birth-entry" || activeCard?.id === "birth-correction"
      ? "birth"
      : activeCard?.id === "death-entry" || activeCard?.id === "death-correction"
        ? "death"
        : null;
  const correctable = formType
    ? state.cases.filter((item) => {
        if (item.type !== formType || item.createdBy !== user?.id || item.status === "completed" || item.status === "rejected") return false;
        const query = correctionSearch.trim().toLocaleLowerCase();
        return !query || [item.id, item.name.bn, item.name.en, item.father.bn, item.father.en, item.nid]
          .some((value) => value.toLocaleLowerCase().includes(query));
      })
    : [];
  const closeDialog = () => {
    setActiveCard(null);
    setEditEntry(null);
  };
  const openCaseDialog = (kind: "metric" | "action", id: string) => setActiveCard({ kind, id });
  const rejectApplication = async (item: RegCase) => {
    if (user?.role !== "admin") return;
    if (!window.confirm(L("এই আবেদনটি বাতিল করবেন?", "Reject this application?"))) return;
    if (await patchCase(item.id, { status: "rejected" })) {
      toast.success(L("আবেদন বাতিল হয়েছে", "Application rejected"));
    }
  };
  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !feedbackSubject.trim() || feedbackMessage.trim().length < 10) return;
    setFeedbackSaving(true);
    try {
      if (demoMode) {
        const stored = JSON.parse(localStorage.getItem("uert-support-requests") || "[]") as unknown[];
        stored.push({
          id: crypto.randomUUID(),
          userId: user.id,
          upazilaId: user.upazilaId,
          category: feedbackCategory,
          subject: feedbackSubject.trim(),
          message: feedbackMessage.trim(),
          createdAt: Date.now(),
        });
        localStorage.setItem("uert-support-requests", JSON.stringify(stored));
      } else {
        const { error } = await supabase.from("support_requests").insert({
          user_id: user.id,
          upazila_id: user.upazilaId,
          category: feedbackCategory,
          subject: feedbackSubject.trim(),
          message: feedbackMessage.trim(),
        });
        if (error) throw error;
      }
      toast.success(L("আপনার বার্তা জমা হয়েছে", "Your message has been submitted"));
      setFeedbackSubject("");
      setFeedbackMessage("");
      setActiveCard(null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : L("বার্তা জমা দেওয়া যায়নি", "Could not submit your message"));
    } finally {
      setFeedbackSaving(false);
    }
  };
  const renderCaseSummary = (cases: RegCase[]) => (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: L("মোট কেস", "Total cases"), value: cases.length },
        {
          label: L("অপেক্ষমাণ", "Open"),
          value: cases.filter((item) => item.status !== "completed" && item.status !== "rejected").length,
        },
        {
          label: L("সম্পন্ন", "Completed"),
          value: cases.filter((item) => item.status === "completed").length,
        },
      ].map((stat) => (
        <div key={stat.label} className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-xl font-bold text-emerald-900">{n(stat.value)}</p>
        </div>
      ))}
    </div>
  );
  const renderUrgencySummary = () => {
    const buckets = [
      { label: L("০–৯০ দিন", "0–90 days"), value: urgency.green, color: "bg-emerald-500" },
      { label: L("৯১–১৮০ দিন", "91–180 days"), value: urgency.yellow, color: "bg-amber-400" },
      { label: L("১৮১–৩৬৫ দিন", "181–365 days"), value: urgency.red, color: "bg-red-500" },
      {
        label: L("সময়সীমা পেরিয়েছে", "Past deadline"),
        value: urgency.expired,
        color: "bg-slate-500",
      },
    ];
    const max = Math.max(1, ...buckets.map((item) => item.value));
    return (
      <div className="space-y-3">
        {buckets.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{item.label}</span>
              <span className="font-semibold">{n(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`${item.color} h-full rounded-full`}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {urgency.review > 0 && (
          <p className="text-xs text-muted-foreground">
            {L("তারিখ যাচাই প্রয়োজন", "Date review needed")}: {n(urgency.review)}
          </p>
        )}
      </div>
    );
  };

  return (
    <section className="flex min-h-[calc(100svh-var(--app-header-height,9rem))] flex-col bg-gradient-to-br from-slate-50 via-[#f3f7f8] to-teal-50/60 text-[#102a43]">
      <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col gap-2 px-4 py-1.5 max-[360px]:gap-1 max-[360px]:py-1 sm:gap-2 sm:px-6 sm:py-2 lg:px-8">
        <div
          className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 xl:grid-cols-5"
          aria-label={L("এলাকা বাছাই", "Location filters")}
        >
          <Select
            value={division}
            onValueChange={(value) => {
              setDivision(value);
              setDistrict("all");
              setUpazila("all");
              setUnion("all");
              setWard("all");
            }}
          >
            <SelectTrigger
              className="h-10 min-w-0 border-emerald-200 bg-white/90 px-3 text-sm font-bold sm:h-11 sm:text-base"
              aria-label={L("বিভাগ নির্বাচন", "Select division")}
            >
              <SelectValue placeholder={L("বিভাগ", "Division")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-sm font-semibold sm:text-base" value="all">{L("সব বিভাগ", "All divisions")}</SelectItem>
              {divisions.map((item) => (
                <SelectItem className="text-sm sm:text-base" key={item.id} value={item.id}>
                  {L(item.bn, item.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={district}
            onValueChange={(value) => {
              setDistrict(value);
              setUpazila("all");
              setUnion("all");
              setWard("all");
            }}
          >
            <SelectTrigger
              className="h-10 min-w-0 border-emerald-200 bg-white/90 px-3 text-sm font-bold sm:h-11 sm:text-base"
              aria-label={L("জেলা নির্বাচন", "Select district")}
            >
              <SelectValue placeholder={L("জেলা", "District")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-sm font-semibold sm:text-base" value="all">{L("সব জেলা", "All districts")}</SelectItem>
              {districts.map((item) => (
                <SelectItem className="text-sm sm:text-base" key={item.id} value={item.id}>
                  {L(item.bn, item.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={upazila}
            onValueChange={(value) => {
              setUpazila(value);
              setUnion("all");
              setWard("all");
            }}
          >
            <SelectTrigger
              className="h-10 min-w-0 border-emerald-200 bg-white/90 px-3 text-sm font-bold sm:h-11 sm:text-base"
              aria-label={L("উপজেলা / সিটি কর্পোরেশন নির্বাচন", "Select upazila / city corporation")}
            >
              <SelectValue placeholder={L("উপজেলা / সিটি কর্পোরেশন", "Upazila / City Corporation")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-sm font-semibold sm:text-base" value="all">{L("সব উপজেলা / সিটি কর্পোরেশন", "All upazilas / city corporations")}</SelectItem>
              {matchingUpazilas.map((item) => (
                <SelectItem className="text-sm sm:text-base" key={item.id} value={item.id}>
                  {L(item.bn, item.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={union}
            onValueChange={(value) => {
              setUnion(value);
              setWard("all");
            }}
            disabled={!selectedUpazila || selectedCityCorporation}
          >
            <SelectTrigger
              className="h-10 min-w-0 border-emerald-200 bg-white/90 px-3 text-sm font-bold sm:h-11 sm:text-base"
              aria-label={L("ইউনিয়ন / পৌরসভা নির্বাচন", "Select union / municipality")}
            >
              <SelectValue placeholder={L("ইউনিয়ন / পৌরসভা", "Union / Municipality")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-sm font-semibold sm:text-base" value="all">
                {selectedCityCorporation
                  ? L("সিটি কর্পোরেশনে প্রযোজ্য নয়", "Not applicable to city corporations")
                  : L("সব ইউনিয়ন / পৌরসভা", "All unions / municipalities")}
              </SelectItem>
              {unions.map((item) => (
                <SelectItem className="text-sm sm:text-base" key={item.id} value={item.id}>
                  {L(item.bn, item.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ward} onValueChange={setWard} disabled={wards.length === 0}>
            <SelectTrigger
              className="h-10 min-w-0 border-emerald-200 bg-white/90 px-3 text-sm font-bold sm:h-11 sm:text-base"
              aria-label={L("ওয়ার্ড নির্বাচন", "Select ward")}
            >
              <SelectValue placeholder={L("ওয়ার্ড", "Ward")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-sm font-semibold sm:text-base" value="all">{L("সব ওয়ার্ড", "All wards")}</SelectItem>
              {wards.map((item) => (
                <SelectItem className="text-sm sm:text-base" key={item.id} value={item.id}>
                  {L(item.bn, item.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <section
          className="flex shrink-0 flex-wrap items-center gap-2 text-sm sm:gap-3 sm:text-base"
          aria-label={L("নিবন্ধন জরুরিতা", "Registration urgency")}
        >
          <span className="mr-1 font-bold text-slate-700">{L("জরুরিতা", "Urgency")} ·</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 font-bold text-emerald-800">
            {L("০–৯০ দিন: সবুজ", "0–90 days: green")} · {n(urgency.green)}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1.5 font-bold text-amber-800">
            {L("৯১–১৮০ দিন: হলুদ", "91–180 days: yellow")} · {n(urgency.yellow)}
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1.5 font-bold text-red-800">
            {L("১৮১–৩৬৫ দিন: লাল এলার্ট", "181–365 days: red alert")} · {n(urgency.red)}
          </span>
          {urgency.expired > 0 && (
            <span className="rounded-full bg-slate-200 px-3 py-1.5 font-bold text-slate-700">
              {L("সময়সীমা পেরিয়েছে", "Past deadline")} · {n(urgency.expired)}
            </span>
          )}
        </section>
        <div className="grid flex-1 gap-1 sm:gap-2 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-4">
          <div className="flex min-h-0 flex-col justify-center">
            <span className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-teal-700/15 bg-white px-3 py-1 text-xs font-semibold text-teal-800 shadow-[0_0_18px_-8px_rgba(13,148,136,0.55)] max-[360px]:mb-1">
              <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
              {L("জাতীয় প্রশাসনিক অগ্রগতি", "National administrative progress")}
            </span>
            <h1 className="max-w-3xl font-display text-3xl font-bold leading-tight tracking-tight text-[#102a43] max-[360px]:text-2xl sm:text-4xl lg:text-5xl xl:text-6xl">
              ই-নিবন্ধন ট্র্যাকার
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-snug text-teal-800 max-[360px]:text-xs sm:text-base lg:text-lg">
              Birth &amp; Death Registration 365-Day Compliance System
            </p>
            <p className="mt-2 max-w-3xl text-xs font-medium leading-relaxed text-slate-700 max-[360px]:mt-1 max-[360px]:text-[11px] sm:text-sm">
              {L(
                "জন্মের ৩৬৫ দিনের মধ্যে জন্ম ও মৃত্যু নিবন্ধন নিশ্চিতকরণ ব্যবস্থা",
                "A system to ensure birth and death registration within 365 days",
              )}
            </p>
          </div>

          <section
            className="flex min-h-[19rem] w-full flex-col rounded-2xl border border-emerald-100 bg-white p-3 shadow-md sm:min-h-[20rem] sm:p-4"
            aria-label={L("চলতি মাসের কাজের অগ্রগতি", "Current month work progress")}
          >
            <h2 className="mb-2 text-center text-base font-bold text-emerald-900 sm:text-left sm:text-lg">
              {L("চলতি মাসের কাজের অগ্রগতি (১০০%)", "Current month work progress (100%)")}
            </h2>
            <div className="grid flex-1 items-center gap-2 sm:grid-cols-[minmax(11rem,0.9fr)_minmax(0,1.1fr)] sm:gap-4">
              <div className="relative mx-auto h-44 w-44 shrink-0">
              <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90" role="img" aria-label={`${n(monthlyCompletion)}% ${L("মাসিক লক্ষ্যমাত্রা সম্পন্ন", "of monthly target completed")}`}>
                <defs>
                  <linearGradient id="monthly-progress-track" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
                    <stop offset="35%" stopColor="#3b82f6" stopOpacity="0.38" />
                    <stop offset="68%" stopColor="#f59e0b" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.38" />
                  </linearGradient>
                </defs>
                <circle cx="110" cy="110" r="88" fill="none" stroke="url(#monthly-progress-track)" strokeWidth="18" />
                {donutSegments.map((segment, index) => {
                  const length = (segment.value / donutTotal) * donutCircumference;
                  const offset = donutSegments
                    .slice(0, index)
                    .reduce((total, previous) => total + (previous.value / donutTotal) * donutCircumference, 0);
                  return segment.value > 0 ? (
                    <circle
                      key={segment.id}
                      cx="110"
                      cy="110"
                      r="88"
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="18"
                      strokeDasharray={`${length} ${donutCircumference - length}`}
                      strokeDashoffset={-offset}
                      className="transition-all duration-500"
                    />
                  ) : null;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold leading-none text-slate-800">{n(monthlyCompletion)}%</span>
                <span className="mt-0.5 text-xs font-semibold text-slate-500">{L("লক্ষ্যমাত্রা", "Monthly target")}</span>
              </div>
            </div>
              <div className="grid w-full gap-2 text-xs font-bold text-slate-700">
              {[
                { id: "pending", label: L("জমা হয়েছে", "Submitted"), value: monthlyCounts.pending, background: "bg-blue-50", border: "border-blue-200", color: "bg-blue-500", text: "text-blue-700" },
                { id: "completed", label: L("নিবন্ধন সম্পন্ন", "Completed"), value: monthlyCounts.completed, background: "bg-emerald-50", border: "border-emerald-200", color: "bg-emerald-500", text: "text-emerald-700" },
                { id: "progress", label: L("প্রক্রিয়াধীন", "In progress"), value: monthlyCounts.progress, background: "bg-amber-50", border: "border-amber-200", color: "bg-amber-400", text: "text-amber-700" },
              ].map((item) => (
                <div key={item.id} className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border p-2.5 ${item.background} ${item.border}`}>
                  <span className="flex min-w-0 items-center gap-2 font-normal text-slate-600">
                    <span className={`block h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
                    <span>{item.label}</span>
                  </span>
                  <span className={`shrink-0 text-sm font-extrabold ${item.text}`}>{n(((item.value / monthlyTarget) * 100).toFixed(1))}%</span>
                </div>
              ))}
            </div>
            </div>
            <div className="mt-3 flex w-full flex-wrap justify-between gap-x-4 gap-y-1 border-t border-slate-200 px-2 pt-2 text-xs font-semibold text-slate-600 sm:text-sm">
              <span>{L("মাসিক সম্পন্ন", "Completed this month")}: {n(monthlyCounts.completed)} / {n(monthlyTarget)}</span>
              <span>{L("মোট প্রাপ্ত আবেদন", "Total applications received")}: {n(monthlyReceived)}</span>
            </div>
            {hasWardAggregate && !wardMonthlyCounts && (
              <p className="mt-2 text-center text-[10px] text-amber-700">
                {L("ওয়ার্ডের সামগ্রিক তথ্য লোড করা যায়নি", "Ward aggregate could not be loaded")}
              </p>
            )}
          </section>
        </div>

        <section aria-labelledby="quick-actions-heading">
          <div className="mb-1 flex items-center justify-between">
            <h2
              id="quick-actions-heading"
              className="font-display text-sm font-bold text-[#102a43] sm:text-base"
            >
              {L("দ্রুত প্রবেশ", "Quick actions")}
            </h2>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-xs">
              {L("নিরাপদ সরকারি প্ল্যাটফর্ম", "Secure government platform")}
            </span>
          </div>
          <div
            className={`grid gap-1.5 sm:gap-3 ${
              roleConfig === "public" ? "grid-cols-2 lg:grid-cols-4" : "role-action-grid grid-cols-4"
            }`}
          >
            {actions.map(({ id, title, description, Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => openCaseDialog("action", id)}
                className={`group flex min-h-[3.5rem] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left shadow-sm transition-all hover:scale-[1.02] hover:border-teal-600/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 max-[360px]:min-h-12 max-[360px]:gap-1.5 max-[360px]:px-2 sm:min-h-[3.75rem] sm:gap-3 sm:px-4 ${roleConfig !== "public" ? "role-action-card max-sm:min-h-12 max-sm:flex-col max-sm:justify-center max-sm:px-1 max-sm:py-1 max-sm:text-center" : ""}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#102a43] text-teal-200 transition group-hover:bg-teal-800 max-[360px]:h-7 max-[360px]:w-7 max-sm:hidden">
                  <Icon
                    className="h-4 w-4 max-[360px]:h-3.5 max-[360px]:w-3.5"
                    aria-hidden="true"
                  />
                </span>
                <span className={`min-w-0 flex-1 ${roleConfig !== "public" ? "max-sm:w-full" : ""}`}>
                  <span className={`flex items-center gap-1 text-xs font-bold text-[#102a43] sm:text-sm ${roleConfig !== "public" ? "max-sm:justify-center max-sm:text-[10px]" : ""}`}>
                    <span className="truncate">{title}</span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 text-teal-700"
                      aria-hidden="true"
                    />
                  </span>
                  <span className={`mt-0.5 block truncate text-[10px] text-slate-500 max-[360px]:hidden sm:text-xs ${roleConfig !== "public" ? "max-sm:hidden" : ""}`}>
                    {description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <Footer compact />
      <Dialog
        open={activeCard !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveCard(null);
            setEditEntry(null);
          }
        }}
      >
        <DialogContent className={`left-0 top-0 h-[100svh] max-h-[100svh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-background sm:rounded-none ${formType ? "p-2 sm:p-3 lg:px-6" : "p-4 sm:p-8 lg:px-[max(2rem,calc((100vw-72rem)/2))]"}`}>
          {currentCard && (
            <>
              <DialogHeader className={formType ? "sr-only" : "pr-7 text-left"}>
                <DialogTitle className={formType ? "" : "font-display text-xl text-emerald-950"}>
                  {formType === "birth" ? "জন্ম নিবন্ধন ফর্ম" : formType === "death" ? "মৃত্যু নিবন্ধন ফর্ম" : currentCard.title}
                </DialogTitle>
                <DialogDescription>
                  {formType === "birth" ? "Birth registration form" : formType === "death" ? "Death registration form" : currentCard.description}
                </DialogDescription>
              </DialogHeader>
              {formType ? (
                <div className={formType === "birth" ? "w-full max-w-full space-y-1" : "space-y-3"}>
                  {isEntryCard || editEntry ? (
                    <RegForm
                      key={editEntry?.id ?? formType}
                      type={formType}
                      entry={editEntry ?? undefined}
                      onSaved={() => {
                        setEditEntry(null);
                        setActiveCard({ kind: "action", id: formType === "birth" ? "birth-list" : "death-list" });
                      }}
                      onCancel={editEntry ? () => setEditEntry(null) : closeDialog}
                      onEdit={() => setActiveCard({ kind: "action", id: formType === "birth" ? "birth-correction" : "death-correction" })}
                    />
                  ) : (
                    <div className="space-y-3">
                      <Input value={correctionSearch} onChange={(event) => setCorrectionSearch(event.target.value)} placeholder={L("নাম, NID বা আবেদন নম্বর দিয়ে খুঁজুন", "Search name, NID or application number")} />
                      {correctable.length === 0 ? (
                        <p className="rounded-lg border p-4 text-sm text-muted-foreground">{L("সংশোধনযোগ্য কোনো এন্ট্রি নেই।", "No matching entries available to edit.")}</p>
                      ) : (
                        <ul className="divide-y rounded-lg border">
                          {correctable.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-semibold">{L(item.name.bn, item.name.en)}</p>
                                <p className="text-xs text-muted-foreground">{item.dob} · {item.nid || "—"}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setEditEntry(item)}>
                                <PencilLine className="h-4 w-4" />{L("সংশোধন করুন", "Edit / Modify")}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ) : applicationListType ? (
                <ApplicationList
                  type={applicationListType}
                  cases={actionCases}
                  canReject={user?.role === "admin"}
                  {...(user?.role === "worker" ? { onNew: () => openCaseDialog("action", `${applicationListType}-entry`) } : {})}
                  onReject={rejectApplication}
                />
              ) : activeCard?.id === "worker-report" ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => downloadCSV(rows(actionCases), "registration-report.csv")}>
                    <Download className="mr-2 h-4 w-4" />{L("CSV ডাউনলোড", "Download CSV")}
                  </Button>
                  <Button variant="outline" onClick={() => printPDF(L("নিবন্ধন প্রতিবেদন", "Registration report"), rows(actionCases))}>
                    <FileText className="mr-2 h-4 w-4" />{L("PDF / প্রিন্ট", "PDF / Print")}
                  </Button>
                </div>
              ) : activeCard?.id === "feedback" ? (
                <form className="max-w-2xl space-y-4" onSubmit={submitFeedback}>
                  <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
                    <label htmlFor="support-category" className="text-sm font-semibold">{L("বার্তার ধরন", "Message type")}</label>
                    <Select value={feedbackCategory} onValueChange={(value) => setFeedbackCategory(value as "complaint" | "suggestion")}>
                      <SelectTrigger id="support-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="complaint">{L("অভিযোগ", "Complaint")}</SelectItem>
                        <SelectItem value="suggestion">{L("পরামর্শ", "Suggestion")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
                    <label htmlFor="support-subject" className="text-sm font-semibold">{L("বিষয়", "Subject")}</label>
                    <Input id="support-subject" maxLength={160} minLength={3} required value={feedbackSubject} onChange={(event) => setFeedbackSubject(event.target.value)} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
                    <label htmlFor="support-message" className="pt-2 text-sm font-semibold">{L("বিস্তারিত", "Details")}</label>
                    <Textarea id="support-message" className="min-h-32" maxLength={4000} minLength={10} required value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={feedbackSaving}>
                      {feedbackSaving ? L("জমা হচ্ছে…", "Submitting…") : L("জমা দিন", "Submit")}
                    </Button>
                  </div>
                </form>
              ) : (
              <div className="space-y-5">
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
                  {L("নির্বাচিত এলাকা", "Selected area")}: {scopeLabel}
                </div>
                {renderCaseSummary(activeAction ? actionCases : filteredCases)}
                {activeCard?.id === "compliance" || activeCard?.id === "deadlines" || activeAction?.filter === "urgent" ? (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold">
                      {L("সময়সীমা অনুযায়ী অনিবন্ধিত কেস", "Unregistered cases by deadline")}
                    </h3>
                    {renderUrgencySummary()}
                  </div>
                ) : null}
                {activeCard?.id === "districts" || activeCard?.id === "reports" || activeCard?.id === "union-report" || activeCard?.id === "ward-report" || activeCard?.id === "master-report" ? (
                  <p className="text-sm text-muted-foreground">
                    {L(
                      "নির্বাচিত এলাকায় প্রশাসনিক ইউনিট",
                      "Administrative units in the selected area",
                    )}
                    : {n(matchingUpazilas.length)} {L("উপজেলা", "upazilas")} · {n(unions.length)}{" "}
                    {L("ইউনিয়ন/পৌরসভা", "unions/municipalities")}
                  </p>
                ) : null}
                {activeCard?.id === "tiers" && (
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    {[
                      "জাতীয়",
                      "বিভাগ",
                      "জেলা",
                      "সিটি কর্পোরেশন",
                      "পৌরসভা",
                      "উপজেলা",
                      "ইউনিয়ন",
                      "ওয়ার্ড",
                    ].map((tier) => (
                      <span
                        key={tier}
                        className="rounded-md border border-emerald-100 px-2 py-2 text-center"
                      >
                        {L(tier, tier)}
                      </span>
                    ))}
                  </div>
                )}
                {activeCard?.id === "target" && (
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>{L("বর্তমান সম্পন্নতা", "Current completion")}</span>
                      <span className="font-semibold">{n(completionPercent)}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {L(
                        "লক্ষ্যমাত্রা: প্রতিটি জন্ম ও মৃত্যু নিবন্ধিত",
                        "Target: register every birth and death",
                      )}
                    </p>
                  </div>
                )}
                {activeCard?.id === "security" && (
                  <div className="rounded-lg border border-emerald-100 p-3 text-sm">
                    <p className="font-semibold">
                      {L("নিরাপদ, ভূমিকা-ভিত্তিক প্রবেশ", "Secure, role-based access")}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {L(
                        "অধিকৃত কর্মীরা লগইন করে নিজস্ব প্রশাসনিক এলাকার তথ্য ও কার্যক্রম দেখেন। প্রশাসনিক ভূমিকার জন্য বহুস্তরের যাচাইকরণ প্রয়োজন।",
                        "Authorized staff sign in to access information and actions for their administrative area. Privileged roles require multi-factor verification.",
                      )}
                    </p>
                    <p className="mt-2 text-xs text-emerald-800">
                      {L(
                        "কর্মী · প্রশাসক · পুলিশ · উপজেলা নির্বাহী কর্মকর্তা · সুপার অ্যাডমিন",
                        "Worker · Administrator · Police · Upazila Executive Officer · Super Admin",
                      )}
                    </p>
                  </div>
                )}
                {activeCard?.id === "dashboard" && (
                  <div className="rounded-lg border border-emerald-100 p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span>{L("সম্পন্ন নিবন্ধন", "Completed registrations")}</span>
                      <strong>{n(completionPercent)}%</strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
