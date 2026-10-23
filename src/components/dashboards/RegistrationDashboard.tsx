import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
  ChevronDown,
  Download,
  Eye,
  FileCheck2,
  FileText,
  HeartPulse,
  Home,
  Inbox,
  MapPinned,
  Megaphone,
  MessageSquare,
  MessageSquareWarning,
  PencilLine,
  Printer,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCaseDeadline, getDeadlineBand } from "@/lib/compliance";
import { TARGET, type RegCase, type Role } from "@/lib/types";
import { getDemoAttachmentPreview, scopedCases, useApp } from "@/lib/store";
import { RegForm } from "@/components/dashboards/Worker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, useCaseHelpers } from "@/components/shared";
import { downloadCSV, printPDF } from "@/lib/report";
import { seedState } from "@/lib/seed";
import {
  MonthlyProgressCard,
  type MonthlyProgressCounts,
} from "@/components/dashboards/MonthlyProgressCard";
import { LoginDialog } from "@/components/Header";
import { WorkerApplicationListPage } from "@/components/modules/WorkerApplicationListPage";

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
type AdminRecord = {
  id: string;
  caseId: string;
  upazilaId: string;
  unionId: string;
  kind: "greeting" | "legal";
  title: string;
  text: string;
  createdAt: number;
  signatureProofName?: string;
  signatureProofDataUrl?: string;
};

const ADMIN_RECORDS_KEY = "uert-admin-records";

function readAdminRecords(): AdminRecord[] {
  const stored = localStorage.getItem(ADMIN_RECORDS_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error("Stored administrative records must be an array");
  return parsed.filter(
    (record): record is AdminRecord =>
      typeof record === "object" &&
      record !== null &&
      "id" in record &&
      typeof record.id === "string" &&
      "caseId" in record &&
      typeof record.caseId === "string" &&
      "upazilaId" in record &&
      typeof record.upazilaId === "string" &&
      "unionId" in record &&
      typeof record.unionId === "string" &&
      "kind" in record &&
      (record.kind === "greeting" || record.kind === "legal") &&
      "title" in record &&
      typeof record.title === "string" &&
      "text" in record &&
      typeof record.text === "string" &&
      "createdAt" in record &&
      typeof record.createdAt === "number",
  );
}

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
  const { L, n, demoMode } = useApp();
  const { address, rows } = useCaseHelpers();
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "approved">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<(string | undefined)[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
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

  useEffect(() => {
    const selectedCase = cases.find((item) => item.id === expandedId);
    if (!selectedCase || selectedCase.files.length === 0) {
      setAttachmentPreviews([]);
      setAttachmentsLoading(false);
      return;
    }
    let cancelled = false;
    const objectUrls: string[] = [];
    setAttachmentPreviews([]);
    setAttachmentsLoading(true);
    void Promise.all(selectedCase.files.map(async (file, index) => {
      if (file.url || file.dataUrl) return file.url ?? file.dataUrl;
      if (!file.path) return getDemoAttachmentPreview(selectedCase.id, index);
      if (demoMode) return getDemoAttachmentPreview(selectedCase.id, index);
      const { data, error } = await supabase.storage.from("case-files").download(file.path);
      if (error) {
        toast.error(`${L("সংযুক্তি লোড করা যায়নি", "Could not load attachment")}: ${file.name} · ${error.message}`);
        return undefined;
      }
      const objectUrl = URL.createObjectURL(data);
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        return undefined;
      }
      objectUrls.push(objectUrl);
      return objectUrl;
    })).then((previews) => {
      if (cancelled) return;
      setAttachmentPreviews(previews);
      setAttachmentsLoading(false);
    });
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [cases, demoMode, expandedId, L]);

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
              {[L("ক্রমিক নং", "SL"), L("আবেদন নং", "App No"), L("নাম", "Name"), L("পিতার নাম", "Father's Name"), L("মাতার নাম", "Mother's Name"), L("সংযুক্তি", "Attachments"), L("অবস্থা", "Status"), L("কার্যক্রম", "Action")].map((heading) => <th key={heading} className="whitespace-nowrap border-b border-emerald-100 px-3 py-2.5 font-semibold">{heading}</th>)}
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
                  <td className="px-3 py-2.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      disabled={item.files.length === 0}
                      onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
                    >
                      {n(item.files.length)}
                    </Button>
                  </td>
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
                    <td colSpan={8} className="px-4 py-3 text-sm">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <span>{L("জন্ম তারিখ", "Date of birth")}: {item.dob}</span>
                        {item.dod && <span>{L("মৃত্যুর তারিখ", "Date of death")}: {item.dod}</span>}
                        <span>{L("মোবাইল", "Mobile")}: {item.parentMobile ?? "—"}</span>
                        <span className="sm:col-span-2">{L("ঠিকানা", "Address")}: {address(item) || "—"}</span>
                        <span>{L("NID", "NID")}: {item.nid || "—"}</span>
                      </div>
                      {attachmentsLoading && expandedId === item.id && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {L("সংযুক্তি লোড হচ্ছে…", "Loading attachments…")}
                        </p>
                      )}
                      {item.files.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {item.files.map((file, fileIndex) => {
                            const preview = attachmentPreviews[fileIndex];
                            return (
                              <article key={`${file.path ?? file.name}-${fileIndex}`} className="overflow-hidden rounded-lg border border-emerald-100 bg-white">
                                <div className="flex h-40 items-center justify-center bg-slate-50 p-2">
                                  {preview ? (
                                    <img src={preview} alt={file.name} className="max-h-full max-w-full object-contain" />
                                  ) : (
                                    <span className="text-xs text-slate-500">{file.name}</span>
                                  )}
                                </div>
                                <div className="space-y-1 p-2 text-xs">
                                  <p className="break-all font-medium">{file.name}</p>
                                  {file.fieldVisit && (
                                    <>
                                      <p className="font-semibold text-emerald-900">{L("বাড়ি পরিদর্শনের ছবি", "House visit photo")}</p>
                                      <p>{L("ছবির সময়", "Photo time")}: {new Date(file.fieldVisit.capturedAt).toLocaleString()}</p>
                                      {file.fieldVisit.latitude !== undefined && file.fieldVisit.longitude !== undefined && (
                                        <p>GPS: {file.fieldVisit.latitude.toFixed(6)}, {file.fieldVisit.longitude.toFixed(6)}</p>
                                      )}
                                    </>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!visible.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{L("কোনো আবেদন পাওয়া যায়নি", "No applications found")}</td></tr>}
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

function createLocalAdminPreviewCases(seedCases: RegCase[]) {
  const cases = seedCases.filter(
    (item) => item.upazilaId === "manirampur" && item.unionId === "mn-rohita",
  ).map((item) => ({
    ...item,
    details: {
      ...item.details,
      ...(item.type === "birth"
        ? { birthPlace: { bn: `রোহিতা · ওয়ার্ড ${item.ward}`, en: `Rohita · Ward ${item.ward}` } }
        : { deathPlace: { bn: `রোহিতা · ওয়ার্ড ${item.ward}`, en: `Rohita · Ward ${item.ward}` } }),
    },
  }));
  const birthTemplate = cases.find((item) => item.type === "birth");
  const deathTemplate = cases.find((item) => item.type === "death");
  if (!birthTemplate || !deathTemplate) return cases;
  const now = Date.now();
  return [
    ...cases,
    {
      ...birthTemplate,
      id: "preview-birth-ward-2",
      name: { bn: "নমুনা জন্ম আবেদন - ওয়ার্ড ২", en: "Sample birth application - Ward 2" },
      villageId: "mn-rohita-v2",
      ward: 2,
      createdBy: "local-preview",
      createdAt: now,
      details: {
        ...birthTemplate.details,
        birthPlace: { bn: "রোহিতা · ওয়ার্ড ২", en: "Rohita · Ward 2" },
      },
    },
    {
      ...deathTemplate,
      id: "preview-death-ward-3",
      name: { bn: "নমুনা মৃত্যু আবেদন - ওয়ার্ড ৩", en: "Sample death application - Ward 3" },
      villageId: "mn-rohita-v3",
      ward: 3,
      createdBy: "local-preview",
      createdAt: now - 1,
      details: {
        ...deathTemplate.details,
        deathPlace: { bn: "রোহিতা · ওয়ার্ড ৩", en: "Rohita · Ward 3" },
      },
    },
  ];
}

const publicActions: RoleAction[] = [
  { id: "reports", titleBn: "এলাকাভিত্তিক প্রতিবেদন", titleEn: "Area-wise report", descriptionBn: "প্রশাসনিক এলাকার সারসংক্ষেপ", descriptionEn: "Administrative area summaries", Icon: MapPinned },
  { id: "deadlines", titleBn: "সময়সীমা পর্যবেক্ষণ", titleEn: "Deadline monitoring", descriptionBn: "৩৬৫ দিনের সম্মতি ও সতর্কতা", descriptionEn: "365-day compliance and alerts", Icon: CalendarCheck2, filter: "urgent" },
  { id: "worker-report", titleBn: "রিপোর্ট", titleEn: "Reports", descriptionBn: "সকল ধরনের প্রতিবেদন দেখুন", descriptionEn: "View all types of reports", Icon: FileText },
  { id: "feedback", titleBn: "অভিযোগ জানান বা পরামর্শ দিন", titleEn: "Submit complaint or suggestion", descriptionBn: "আইসিটি সহায়তা ও পরামর্শ দিন", descriptionEn: "Request ICT support or share a suggestion", Icon: MessageSquare },
];

const roleActions: Record<Exclude<DashboardRole, "public" | "super" | "district">, RoleAction[]> = {
  worker: [
    { id: "birth-entry", titleBn: "শিশুর জন্ম তথ্য ও ডকুমেন্টস আপলোড", titleEn: "Child birth info & documents upload", descriptionBn: "নতুন জন্ম তথ্য ও ৩টি ডকুমেন্ট জমা দিন", descriptionEn: "Submit new birth details with documents", Icon: Baby, filter: "birth" },
    { id: "death-entry", titleBn: "মৃত ব্যক্তির তথ্য ও ডকুমেন্টস আপলোড", titleEn: "Deceased person info & documents upload", descriptionBn: "নতুন মৃত্যু তথ্য ও ডকুমেন্ট জমা দিন", descriptionEn: "Submit new death details with documents", Icon: HeartPulse, filter: "death" },
    { id: "birth-list", titleBn: "জন্ম নিবন্ধনের আবেদন তালিকা দেখুন", titleEn: "View birth registration application list", descriptionBn: "জমা দেওয়া জন্ম আবেদন ও মন্তব্য", descriptionEn: "Submitted birth applications and remarks", Icon: FileText, filter: "birth" },
    { id: "death-list", titleBn: "মৃত্যু নিবন্ধনের আবেদন তালিকা দেখুন", titleEn: "View death registration application list", descriptionBn: "জমা দেওয়া মৃত্যু আবেদন ও মন্তব্য", descriptionEn: "Submitted death applications and remarks", Icon: FileCheck2, filter: "death" },
    { id: "worker-report", titleBn: "রিপোর্ট", titleEn: "Reports", descriptionBn: "আমার রিপোর্ট ডাউনলোড করুন (Excel/PDF)", descriptionEn: "Download my report (Excel/PDF)", Icon: Download },
    { id: "feedback", titleBn: "অভিযোগ জানান বা পরামর্শ দিন", titleEn: "Submit complaint or suggestion", descriptionBn: "উপজেলা আইসিটি সহায়তা দলকে জানান", descriptionEn: "Reach the Upazila ICT support team", Icon: MessageSquareWarning },
  ],
  police: [
    { id: "birth-entry", titleBn: "শিশুর জন্ম তথ্য ও ডকুমেন্টস আপলোড", titleEn: "Child birth info & documents upload", descriptionBn: "নতুন জন্ম তথ্য ও পরিদর্শনের ছবি জমা দিন", descriptionEn: "Submit birth details and a visit photo", Icon: Baby, filter: "birth" },
    { id: "death-entry", titleBn: "মৃত ব্যক্তির তথ্য ও ডকুমেন্টস আপলোড", titleEn: "Deceased person info & documents upload", descriptionBn: "নতুন মৃত্যু তথ্য ও পরিদর্শনের ছবি জমা দিন", descriptionEn: "Submit death details and a visit photo", Icon: HeartPulse, filter: "death" },
    { id: "birth-list", titleBn: "জন্ম নিবন্ধনের আবেদন তালিকা দেখুন", titleEn: "View birth registration application list", descriptionBn: "ওয়ার্ডের জন্ম আবেদন ও পরিদর্শন ছবি", descriptionEn: "Ward birth applications and visit photos", Icon: FileText, filter: "birth" },
    { id: "death-list", titleBn: "মৃত্যু নিবন্ধনের আবেদন তালিকা দেখুন", titleEn: "View death registration application list", descriptionBn: "ওয়ার্ডের মৃত্যু আবেদন ও পরিদর্শন ছবি", descriptionEn: "Ward death applications and visit photos", Icon: FileCheck2, filter: "death" },
  ],
  admin: [
    { id: "birth-list", titleBn: "জন্ম নিবন্ধনের আবেদন তালিকা", titleEn: "Birth Registration Application List", descriptionBn: "ইউনিয়নের সব ওয়ার্ডের জন্ম আবেদন ও প্রশাসনিক কার্যক্রম", descriptionEn: "Birth applications and administrative actions across all union wards", Icon: FileText, filter: "birth" },
    { id: "death-list", titleBn: "মৃত্যু নিবন্ধনের আবেদন তালিকা", titleEn: "Death Registration Application List", descriptionBn: "ইউনিয়নের সব ওয়ার্ডের মৃত্যু আবেদন ও প্রশাসনিক কার্যক্রম", descriptionEn: "Death applications and administrative actions across all union wards", Icon: FileCheck2, filter: "death" },
    { id: "legal-tracker", titleBn: "ইস্যুকৃত আইনি নোটিশ ট্র্যাকার", titleEn: "Issued Legal Notice Tracker", descriptionBn: "ধারা ৭(২)-এর নোটিশের খসড়া ও রেকর্ড", descriptionEn: "Section 7(2) notice drafts and records", Icon: ShieldAlert },
    { id: "message-tracker", titleBn: "প্রেরিত বার্তা ও পরিদর্শন ট্র্যাকার", titleEn: "Messages & Inspection Tracker", descriptionBn: "শুভেচ্ছা, সমবেদনা ও মাঠ পরিদর্শনের তথ্য", descriptionEn: "Greetings, condolences, and field inspection details", Icon: MessageSquare },
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
    { id: "notice-management", titleBn: "জরুরি ঘোষণা ও নোটিশ বোর্ড", titleEn: "Emergency announcements and notice board", descriptionBn: "বিজ্ঞপ্তি দেখুন ও পরিচালনা করুন", descriptionEn: "View and manage official notices", Icon: Megaphone },
  ],
};

function QuickAccessCard({
  item,
  publicDashboard,
  onActivate,
}: {
  item: { id: string; title: string; description: string; Icon: RoleAction["Icon"] };
  publicDashboard: boolean;
  onActivate: () => void;
}) {
  const className =
    "role-action-card group flex min-h-[3.5rem] cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-left shadow-sm transition-all hover:scale-[1.02] hover:border-emerald-500 hover:bg-emerald-50/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 max-[360px]:min-h-12 max-[360px]:gap-1.5 max-[360px]:px-2 sm:min-h-[3.75rem] sm:gap-3 sm:px-4 max-sm:flex-col max-sm:justify-center max-sm:px-1 max-sm:py-1 max-sm:text-center";
  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white transition-colors group-hover:bg-emerald-800 max-sm:hidden">
        <item.Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex-1 max-sm:w-full">
        <span className="flex items-start gap-1 text-xs font-bold text-[#102a43] sm:text-sm max-sm:justify-center max-sm:text-[10px]">
          <span className="truncate">{item.title}</span>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500 max-[360px]:hidden sm:text-xs max-sm:hidden">
          {item.description}
        </span>
      </span>
    </>
  );

  if (publicDashboard) {
    switch (item.id) {
      case "reports":
        return (
          <Link to="/dashboard/$section" params={{ section: "unions" }} className={className}>
            {content}
          </Link>
        );
      case "deadlines":
        return (
          <Link to="/dashboard/$section" params={{ section: "compliance" }} className={className}>
            {content}
          </Link>
        );
      case "national-summary":
        return (
          <Link to="/monitoring" className={className}>
            {content}
          </Link>
        );
      case "announcements":
        return (
          <Link to="/announcements" className={className}>
            {content}
          </Link>
        );
      case "notice-management":
        return (
          <Link to="/monitoring" className={className}>
            {content}
          </Link>
        );
      case "worker-report":
      case "feedback":
        return (
          <button type="button" onClick={onActivate} className={className}>
            {content}
          </button>
        );
    }
    return null;
  }

  return (
    <button type="button" onClick={onActivate} className={className}>
      {content}
    </button>
  );
}

export function RegistrationDashboard({
  role = "public",
  localAdminPreview = false,
  initialAction,
  onActionDismiss,
}: {
  role?: DashboardRole;
  localAdminPreview?: boolean;
  initialAction?: "worker-report" | "feedback";
  onActionDismiss?: () => void;
}) {
  const { state, L, n, user, demoMode, patchCase } = useApp();
  const [localPreviewSeed] = useState(seedState);
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);
  const isLocalAdminPreview =
    localAdminPreview &&
    clientReady &&
    import.meta.env.DEV &&
    role === "admin" &&
    !user &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const navigate = useNavigate();
  const { rows } = useCaseHelpers();
  const [editEntry, setEditEntry] = useState<RegCase | null>(null);
  const [localPreviewCases, setLocalPreviewCases] = useState<RegCase[]>(() =>
    createLocalAdminPreviewCases(localPreviewSeed.cases),
  );
  const [previewEditingCase, setPreviewEditingCase] = useState<RegCase | null>(null);
  const [previewEditName, setPreviewEditName] = useState("");
  const [activeCard, setActiveCard] = useState<{ kind: "metric" | "action"; id: string } | null>(
    null,
  );
  const [correctionSearch, setCorrectionSearch] = useState("");
  const [wardMonthlyCounts, setWardMonthlyCounts] = useState<{
    pending: number;
    progress: number;
    completed: number;
    total: number;
    birth: { pending: number; progress: number; completed: number; total: number };
    death: { pending: number; progress: number; completed: number; total: number };
  } | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<"complaint" | "suggestion">("suggestion");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackLoginOpen, setFeedbackLoginOpen] = useState(false);
  const [adminDraft, setAdminDraft] = useState<{
    kind: "greeting" | "legal";
    item: RegCase;
    stage: "first" | "second" | "final";
  } | null>(null);
  const [adminDraftText, setAdminDraftText] = useState("");
  const [adminSignatureProof, setAdminSignatureProof] = useState<File | null>(null);
  const [adminRecords, setAdminRecords] = useState<AdminRecord[]>([]);
  const [adminDraftSaving, setAdminDraftSaving] = useState(false);
  useEffect(() => {
    if (user?.role !== "admin" && !isLocalAdminPreview) return;
    try {
      setAdminRecords(
        readAdminRecords().filter(
          (record) =>
            record.upazilaId === (user?.upazilaId ?? "manirampur") &&
            record.unionId === (user?.unionId ?? "mn-rohita"),
        ),
      );
    } catch (cause) {
      console.error("Failed to load administrative records", cause);
      toast.error(L("প্রশাসনিক রেকর্ড লোড করা যায়নি", "Could not load administrative records"));
    }
  }, [L, isLocalAdminPreview, user]);
  useEffect(() => {
    if (initialAction) setActiveCard({ kind: "action", id: initialAction });
  }, [initialAction]);
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
  const roleActionItems = roleConfig === "public"
    ? publicActions
    : [
        ...roleActions[roleConfig],
        ...(roleConfig === "worker"
          ? []
          : [
              { id: "worker-report", titleBn: "রিপোর্ট", titleEn: "Reports", descriptionBn: "নিবন্ধন প্রতিবেদন ডাউনলোড বা প্রিন্ট করুন", descriptionEn: "Download or print registration reports", Icon: Download },
              { id: "feedback", titleBn: "অভিযোগ ও পরামর্শ", titleEn: "Complaints and feedback", descriptionBn: "অভিযোগ বা পরামর্শ জমা দিন", descriptionEn: "Submit a complaint or suggestion", Icon: MessageSquareWarning },
            ]),
      ];
  const actions = roleActionItems.map(
    ({ titleBn, titleEn, descriptionBn, descriptionEn, ...action }) => ({
      ...action,
      title: L(titleBn, titleEn),
      description: L(descriptionBn, descriptionEn),
    }),
  );
  const roleScopedCases = useMemo(
    () => {
      if (isLocalAdminPreview) return localPreviewCases;
      if (!user) return roleConfig === "public" ? state.cases : [];
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
    [demoMode, isLocalAdminPreview, localPreviewCases, roleConfig, state, user],
  );
  const filteredCases = useMemo(() => {
    return user && (user.role === "worker" || user.role === "police")
      ? roleScopedCases.filter((item) => item.ward === user.ward)
      : roleScopedCases;
  }, [roleScopedCases, user]);
  const currentMonth = monthKey(Date.now());
  const monthCases = filteredCases.filter((item) => monthKey(item.createdAt) === currentMonth);
  useEffect(() => {
    setWardMonthlyCounts(null);
    if (demoMode || !user || (user.role !== "worker" && user.role !== "police")) {
      return;
    }
    let active = true;
    void supabase.rpc("monthly_ward_case_type_counts").then(({ data, error }) => {
      if (!active) return;
      const row = data?.[0];
      if (error) {
        console.error("Failed to load role-scoped monthly case counts", error);
        toast.error(L("এলাকাভিত্তিক মাসিক পরিসংখ্যান লোড করা যায়নি", "Could not load area-scoped monthly statistics"));
        setWardMonthlyCounts(null);
        return;
      }
      if (!row) {
        setWardMonthlyCounts(null);
        return;
      }
      const birth = {
        pending: Number(row.birth_pending_count),
        progress: Number(row.birth_progress_count),
        completed: Number(row.birth_completed_count),
        total: Number(row.birth_total_count),
      };
      const death = {
        pending: Number(row.death_pending_count),
        progress: Number(row.death_progress_count),
        completed: Number(row.death_completed_count),
        total: Number(row.death_total_count),
      };
      setWardMonthlyCounts({
        pending: birth.pending + death.pending,
        progress: birth.progress + death.progress,
        completed: birth.completed + death.completed,
        total: birth.total + death.total,
        birth,
        death,
      });
    }, (error: unknown) => {
      if (!active) return;
      console.error("Failed to load role-scoped monthly case counts", error);
      toast.error(L("এলাকাভিত্তিক মাসিক পরিসংখ্যান লোড করা যায়নি", "Could not load area-scoped monthly statistics"));
      setWardMonthlyCounts(null);
    });
    return () => {
      active = false;
    };
  }, [L, demoMode, user]);
  const hasWardAggregate = !demoMode && (user?.role === "worker" || user?.role === "police");
  const localMonthlyCounts: MonthlyProgressCounts = {
    birth: {
      pending: monthCases.filter((item) => item.type === "birth" && item.status === "pending").length,
      progress: monthCases.filter((item) => item.type === "birth" && item.status === "progress").length,
      completed: monthCases.filter((item) => item.type === "birth" && item.status === "completed").length,
    },
    death: {
      pending: monthCases.filter((item) => item.type === "death" && item.status === "pending").length,
      progress: monthCases.filter((item) => item.type === "death" && item.status === "progress").length,
      completed: monthCases.filter((item) => item.type === "death" && item.status === "completed").length,
    },
  };
  const monthlyCounts: MonthlyProgressCounts =
    hasWardAggregate && wardMonthlyCounts
      ? { birth: wardMonthlyCounts.birth, death: wardMonthlyCounts.death }
      : localMonthlyCounts;
  const scopeUpazilaId = user?.upazilaId ?? (isLocalAdminPreview ? "manirampur" : undefined);
  const scopeUnionId = user?.unionId ?? (isLocalAdminPreview ? "mn-rohita" : undefined);
  const assignedUpazila = scopeUpazilaId
    ? (isLocalAdminPreview ? localPreviewSeed.upazilas : state.upazilas).find((item) => item.id === scopeUpazilaId)
    : undefined;
  const assignedUnion = assignedUpazila?.unions.find((item) => item.id === scopeUnionId);
  const assignedWardCount = assignedUnion
    ? new Set(assignedUnion.villages.map((village) => village.ward)).size || 9
    : 9;
  const scopedUpazilas = (isLocalAdminPreview ? localPreviewSeed.upazilas : state.upazilas).filter((item) => {
    if (!user || user.role === "super") return true;
    if (user.role === "district") return item.districtEn === user.districtId;
    return item.id === user.upazilaId;
  });
  const selectedUnionCount = scopedUpazilas.reduce((count, item) => count + item.unions.length, 0);
  const monthlyTargetScale =
    roleConfig !== "public" && !user && !isLocalAdminPreview
      ? 0
      : roleConfig === "uno" && user?.role === "uno"
      ? assignedUpazila?.unions.length ?? 1
      : roleConfig === "admin" && (user?.role === "admin" || isLocalAdminPreview)
        ? 1
        : roleConfig === "worker" && user?.role === "worker"
          ? 1 / assignedWardCount
          : roleConfig === "police" && user?.role === "police"
            ? 1 / assignedWardCount
            : roleConfig === "uno"
              ? Math.max(1, selectedUnionCount)
              : roleConfig === "worker" || roleConfig === "police"
                ? 1 / 9
                : Math.max(1, selectedUnionCount);
  const monthlyTargets = {
    birth: Math.ceil(TARGET.birth * monthlyTargetScale),
    death: Math.ceil(TARGET.death * monthlyTargetScale),
  };
  const monthlyTarget = monthlyTargets.birth + monthlyTargets.death;
  const monthlyReceived =
    hasWardAggregate && wardMonthlyCounts ? wardMonthlyCounts.total : monthCases.length;
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
  const scopeUpazila = state.upazilas.find((item) => item.id === user?.upazilaId);
  const scopeUnion = scopeUpazila?.unions.find((item) => item.id === user?.unionId);
  const scopeLabel = isLocalAdminPreview
    ? `${L("মণিরামপুর", "Manirampur")} · ${L("০১ নং রোহিতা", "01 No. Rohita")} · ${L("লোকাল নমুনা ডেটা", "Local mock data")}`
    : !user || user.role === "super"
    ? L("জাতীয় পর্যায়", "National scope")
    : user.role === "district"
      ? `${scopeUpazila?.districtBn ?? user.districtId} ${L("জেলা", "District")}`
      : [
          scopeUpazila && L(scopeUpazila.bn, scopeUpazila.en),
          scopeUnion && L(scopeUnion.bn, scopeUnion.en),
          (user.role === "worker" || user.role === "police") && user.ward
            ? L(`ওয়ার্ড ${user.ward}`, `Ward ${user.ward}`)
            : null,
        ].filter(Boolean).join(" · ");

  const quickAccessActions = actions.slice(0, 4);
  const isEntryCard = activeCard?.id === "birth-entry" || activeCard?.id === "death-entry";
  const formType: "birth" | "death" | null =
    editEntry?.type ?? (activeCard?.id === "birth-entry" || activeCard?.id === "birth-correction"
      ? "birth"
      : activeCard?.id === "death-entry" || activeCard?.id === "death-correction"
        ? "death"
        : null);
  const correctable = formType
    ? state.cases.filter((item) => {
        if (item.type !== formType || item.createdBy !== user?.id || item.status === "completed" || item.status === "rejected") return false;
        const query = correctionSearch.trim().toLocaleLowerCase();
        return !query || [item.id, item.name.bn, item.name.en, item.father.bn, item.father.en, item.nid]
          .some((value) => value.toLocaleLowerCase().includes(query));
      })
    : [];
  const dismissActiveCard = () => {
    setActiveCard(null);
    setEditEntry(null);
    if (initialAction) onActionDismiss?.();
  };
  const closeDialog = dismissActiveCard;
  const openCaseDialog = (kind: "metric" | "action", id: string) => {
    if (roleConfig === "worker" && (id === "birth-list" || id === "death-list")) {
      void navigate({
        to: "/worker-applications/$type",
        params: { type: id === "birth-list" ? "birth" : "death" },
      });
      return;
    }
    setActiveCard({ kind, id });
  };
  const rejectApplication = async (item: RegCase) => {
    if (user?.role !== "admin") return;
    if (!window.confirm(L("এই আবেদনটি বাতিল করবেন?", "Reject this application?"))) return;
    if (await patchCase(item.id, { status: "rejected" })) {
      toast.success(L("আবেদন বাতিল হয়েছে", "Application rejected"));
    }
  };
  const openAdminDraft = (
    kind: "greeting" | "legal",
    item: RegCase,
    stage: "first" | "second" | "final" = "first",
  ) => {
    if (user?.role !== "admin" && !isLocalAdminPreview) return;
    const personName = L(item.name.bn, item.name.en);
    const stageLabel = stage === "first" ? "১ম" : stage === "second" ? "২য়" : "চূড়ান্ত";
    setAdminDraft({ kind, item, stage });
    setAdminSignatureProof(null);
    setAdminDraftText(
      kind === "greeting"
        ? item.type === "birth"
          ? `${personName}-এর জন্ম উপলক্ষে শুভেচ্ছা।\\n\\nচেয়ারম্যান\\nইউনিয়ন পরিষদ`
          : `${personName}-এর মৃত্যুতে গভীর সমবেদনা। শোকসন্তপ্ত পরিবারের প্রতি সমবেদনা জানাই।\\n\\nচেয়ারম্যান\\nইউনিয়ন পরিষদ`
        : `${stageLabel} নোটিশ — জন্ম ও মৃত্যু নিবন্ধন আইন, ২০০৪-এর ধারা ৭(২) অনুসারে ${personName}-এর নিবন্ধন সংক্রান্ত প্রয়োজনীয় ব্যবস্থা গ্রহণের জন্য অনুরোধ করা হচ্ছে।`,
    );
  };
  const saveAdminDraft = async () => {
    if (
      (user?.role !== "admin" && !isLocalAdminPreview) ||
      (!user?.unionId && !isLocalAdminPreview) ||
      !adminDraft ||
      !adminDraftText.trim()
    ) return;
    setAdminDraftSaving(true);
    try {
      let signatureProofDataUrl: string | undefined;
      if (adminSignatureProof) {
        signatureProofDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Could not read the signature proof file"));
          reader.onload = () => {
            if (typeof reader.result !== "string") {
              reject(new Error("Signature proof did not produce a readable file"));
              return;
            }
            resolve(reader.result);
          };
          reader.readAsDataURL(adminSignatureProof);
        });
      }
      const stageTitle = adminDraft.stage === "first" ? "১ম" : adminDraft.stage === "second" ? "২য়" : "চূড়ান্ত";
      const record: AdminRecord = {
        id: crypto.randomUUID(),
        caseId: adminDraft.item.id,
        upazilaId: user?.upazilaId ?? "manirampur",
        unionId: user?.unionId ?? "mn-rohita",
        kind: adminDraft.kind,
        title: adminDraft.kind === "greeting"
          ? adminDraft.item.type === "birth" ? "শুভেচ্ছা বার্তা" : "সমবেদনা বার্তা"
          : `${stageTitle} ধারা ৭(২) নোটিশ`,
        text: adminDraftText.trim(),
        createdAt: Date.now(),
        ...(adminSignatureProof
          ? {
              signatureProofName: adminSignatureProof.name,
              ...(signatureProofDataUrl ? { signatureProofDataUrl } : {}),
            }
          : {}),
      };
      const records = [...adminRecords, record];
      localStorage.setItem(ADMIN_RECORDS_KEY, JSON.stringify(records));
      setAdminRecords(records);
      setAdminDraft(null);
      setAdminDraftText("");
      setAdminSignatureProof(null);
      toast.success(L("খসড়াটি এই ব্রাউজারে সংরক্ষিত হয়েছে", "Draft saved in this browser"));
    } catch (cause) {
      console.error("Failed to save administrative draft", cause);
      toast.error(cause instanceof Error ? cause.message : L("খসড়া সংরক্ষণ করা যায়নি", "Could not save the draft"));
    } finally {
      setAdminDraftSaving(false);
    }
  };
  const toggleRegistered = async (item: RegCase) => {
    if (user?.role !== "admin" && !isLocalAdminPreview) return;
    if (item.status === "completed") {
      if (isLocalAdminPreview) {
        setLocalPreviewCases((current) => current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, status: "progress", regNo: undefined, completedAt: undefined }
            : candidate,
        ));
        toast.success(L("লোকাল নমুনা থেকে নিবন্ধিত অবস্থা সরানো হয়েছে", "Registered status removed from local mock data"));
        return;
      }
      if (await patchCase(item.id, { status: "progress", regNo: "" })) {
        toast.success(L("নিবন্ধিত অবস্থা প্রত্যাহার করা হয়েছে", "Registered status was removed"));
      }
      return;
    }
    const regNo = window.prompt(L("১৭ সংখ্যার নিবন্ধন নম্বর লিখুন", "Enter the 17-digit registration number"));
    if (regNo === null) return;
    if (!/^\d{17}$/.test(regNo.trim())) {
      toast.error(L("নিবন্ধন নম্বরটি ১৭ সংখ্যার হতে হবে", "Registration number must contain exactly 17 digits"));
      return;
    }
    if (isLocalAdminPreview) {
      setLocalPreviewCases((current) => current.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, status: "completed", regNo: regNo.trim(), completedAt: Date.now() }
          : candidate,
      ));
      toast.success(L("লোকাল নমুনা নিবন্ধিত হয়েছে · কোনো বাস্তব নোটিফিকেশন পাঠানো হয়নি", "Local mock marked registered · no real notification was sent"));
      return;
    }
    if (await patchCase(item.id, { status: "completed", regNo: regNo.trim() })) {
      toast.success(L("নিবন্ধিত হয়েছে · কর্মীদের পুশ নোটিফিকেশনটি মক", "Registered · field-staff push notification is mocked"));
    }
  };
  const administrativeList = (user?.role === "admin" || isLocalAdminPreview) && applicationListType
    ? {
        cases: actionCases,
        localPreview: isLocalAdminPreview,
        onHome: dismissActiveCard,
        onRegister: (item: RegCase) => void toggleRegistered(item),
        actions: (item: RegCase, onReviewPhotos: () => void) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="whitespace-nowrap border-emerald-200 text-emerald-900 hover:bg-emerald-50"
              >
                {L("প্রশাসনিক কার্যক্রম", "Administrative actions")}
                <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-60">
              <DropdownMenuItem onSelect={() => openAdminDraft("greeting", item)}>
                <MessageSquare className="text-emerald-700" />
                {item.type === "birth" ? L("শুভেচ্ছা বার্তা", "Greeting message") : L("শোক বার্তা", "Condolence message")}
              </DropdownMenuItem>
              {([
                ["first", L("১ম নোটিশ", "1st notice")],
                ["second", L("২য় নোটিশ", "2nd notice")],
                ["final", L("চূড়ান্ত নোটিশ", "Final notice")],
              ] as const).map(([stage, label]) => (
                <DropdownMenuItem key={stage} onSelect={() => openAdminDraft("legal", item, stage)}>
                  <ShieldAlert className="text-amber-700" />
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onReviewPhotos}>
                <Eye />
                {L("GPS ছবি দেখুন", "Review GPS photos")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={item.status === "completed" || item.status === "rejected"}
                onSelect={() => {
                  if (isLocalAdminPreview) {
                    setPreviewEditingCase(item);
                    setPreviewEditName(item.name.bn);
                  } else {
                    setEditEntry(item);
                    setActiveCard({ kind: "action", id: item.type === "birth" ? "birth-list" : "death-list" });
                  }
                }}
              >
                <PencilLine />
                {L("আবেদন সম্পাদনা", "Edit application")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => printPDF(item.type === "birth" ? L("জন্ম আবেদন ফর্ম", "Birth application form") : L("মৃত্যু আবেদন ফর্ম", "Death application form"), rows([item]))}>
                <Printer />
                {L("আবেদন ফর্ম প্রিন্ট", "Print application form")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        onEdit: (item: RegCase) => {
          if (isLocalAdminPreview) {
            setPreviewEditingCase(item);
            setPreviewEditName(item.name.bn);
          } else {
            setEditEntry(item);
            setActiveCard({ kind: "action", id: item.type === "birth" ? "birth-list" : "death-list" });
          }
        },
      }
    : undefined;
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
      dismissActiveCard();
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
    <section className="dashboard-content flex h-full min-h-0 flex-col overflow-y-auto bg-gradient-to-br from-slate-50 via-[#f3f7f8] to-teal-50/60 text-[#102a43]">
      {applicationListType && roleConfig === "admin" && !editEntry ? (
        <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col gap-2 px-4 py-2 sm:px-6 lg:px-6">
          {administrativeList ? (
            <WorkerApplicationListPage
              type={applicationListType}
              administrative={administrativeList}
            />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {L("এই তালিকা দেখতে অনুমোদিত প্রশাসনিক অ্যাকাউন্টে প্রবেশ করুন।", "Sign in with an authorized administrative account to view this list.")}
            </div>
          )}
        </div>
      ) : (
      <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col gap-1 px-4 py-1 max-[360px]:gap-1 max-[360px]:py-1 sm:gap-1.5 sm:px-6 sm:py-1.5 lg:px-8">
        <div className="grid min-h-0 flex-1 gap-1 sm:gap-2 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-3">
          <div className="flex min-h-0 flex-col justify-center">
            <span className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-teal-700/15 bg-white px-3 py-1 text-xs font-semibold text-teal-800 shadow-[0_0_18px_-8px_rgba(13,148,136,0.55)] max-[360px]:mb-1">
              <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
              {L("জাতীয় প্রশাসনিক অগ্রগতি", "National administrative progress")}
            </span>
            <h1 className="max-w-3xl font-display text-2xl font-bold leading-tight tracking-tight text-[#102a43] max-[360px]:text-xl sm:text-3xl lg:text-4xl">
              ই-নিবন্ধন ট্র্যাকার
            </h1>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-snug text-teal-800 max-[360px]:text-[11px] sm:text-sm lg:text-base">
              Birth &amp; Death Registration 365-Day Compliance System
            </p>
            <p className="mt-1 max-w-3xl text-[11px] font-medium leading-snug text-slate-700 sm:text-xs">
              {L(
                "জন্মের ৩৬৫ দিনের মধ্যে জন্ম ও মৃত্যু নিবন্ধন নিশ্চিতকরণ ব্যবস্থা",
                "A system to ensure birth and death registration within 365 days",
              )}
            </p>
          </div>

          <MonthlyProgressCard
            counts={monthlyCounts}
            received={monthlyReceived}
            targets={monthlyTargets}
            featured
            {...(hasWardAggregate && !wardMonthlyCounts
              ? {
                  warning: L(
                    "ওয়ার্ডের সামগ্রিক তথ্য লোড করা যায়নি",
                    "Ward aggregate could not be loaded",
                  ),
                }
              : {})}
          />
        </div>

        <section className="shrink-0" aria-labelledby="quick-actions-heading">
          <div className="mb-1">
            <h2
              id="quick-actions-heading"
              className="font-display text-sm font-bold text-[#102a43]"
            >
              {L("দ্রুত প্রবেশ", "Quick actions")}
            </h2>
          </div>
          <div
            className={
              "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
            }
          >
            {quickAccessActions.map(({ id, title, description, Icon }) => (
              <QuickAccessCard
                key={id}
                item={{ id, title, description, Icon }}
                publicDashboard={roleConfig === "public"}
                onActivate={() => openCaseDialog("action", id)}
              />
            ))}
          </div>
        </section>
      </div>
      )}
      <Dialog
        open={activeCard !== null && !(applicationListType && roleConfig === "admin" && !editEntry)}
        onOpenChange={(open) => {
          if (!open) {
            dismissActiveCard();
          }
        }}
      >
        <DialogContent className={`left-0 top-0 h-[100svh] max-h-[100svh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-background sm:rounded-none ${formType ? "p-2 sm:p-3 lg:px-6" : applicationListType && roleConfig === "admin" ? "p-4 sm:px-6 lg:px-6" : "p-4 sm:p-8 lg:px-[max(2rem,calc((100vw-72rem)/2))]"}`}>
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
              ) : applicationListType && roleConfig === "admin" ? (
                null
              ) : applicationListType ? (
                <ApplicationList
                  type={applicationListType}
                  cases={actionCases}
                  canReject={user?.role === "admin"}
                  {...(user?.role === "worker" || user?.role === "police" ? { onNew: () => openCaseDialog("action", `${applicationListType}-entry`) } : {})}
                  onReject={rejectApplication}
                />
              ) : activeCard?.id === "legal-tracker" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {L("এই ব্রাউজারে সংরক্ষিত ধারা ৭(২) নোটিশের খসড়া", "Section 7(2) notice drafts saved in this browser")}
                  </p>
                  {adminRecords.filter((record) => record.kind === "legal").length === 0 ? (
                    <p className="rounded-lg border p-4 text-sm text-muted-foreground">{L("এখনও কোনো নোটিশের খসড়া নেই। আবেদন তালিকা থেকে নোটিশ তৈরি করুন।", "No notice drafts yet. Create one from an application list.")}</p>
                  ) : (
                    <div className="space-y-2">
                      {adminRecords.filter((record) => record.kind === "legal").map((record) => {
                        const relatedCase = roleScopedCases.find((item) => item.id === record.caseId);
                        return (
                          <article key={record.id} className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                            <div className="flex flex-wrap justify-between gap-2 text-sm">
                              <strong>{record.title} · {relatedCase ? L(relatedCase.name.bn, relatedCase.name.en) : record.caseId}</strong>
                              <span className="text-muted-foreground">{new Date(record.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm">{record.text}</p>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : activeCard?.id === "message-tracker" ? (
                <div className="space-y-4">
                  <section className="space-y-2">
                    <h3 className="font-semibold text-emerald-900">{L("সংরক্ষিত শুভেচ্ছা ও সমবেদনা বার্তা", "Saved greeting and condolence drafts")}</h3>
                    {adminRecords.filter((record) => record.kind === "greeting").length === 0 ? (
                      <p className="rounded-lg border p-3 text-sm text-muted-foreground">{L("এখনও কোনো বার্তার খসড়া নেই।", "No message drafts yet.")}</p>
                    ) : adminRecords.filter((record) => record.kind === "greeting").map((record) => {
                      const relatedCase = roleScopedCases.find((item) => item.id === record.caseId);
                      return (
                        <article key={record.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap justify-between gap-2 text-sm">
                            <strong>{record.title} · {relatedCase ? L(relatedCase.name.bn, relatedCase.name.en) : record.caseId}</strong>
                            <span className="text-muted-foreground">{new Date(record.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm">{record.text}</p>
                          {record.signatureProofName && <p className="mt-1 text-xs text-muted-foreground">{L("স্বাক্ষর প্রমাণ", "Signature proof")}: {record.signatureProofName}</p>}
                        </article>
                      );
                    })}
                  </section>
                  <section className="space-y-2">
                    <h3 className="font-semibold text-emerald-900">{L("GPS পরিদর্শনের রেকর্ড", "GPS inspection records")}</h3>
                    {roleScopedCases.flatMap((item) =>
                      item.files.filter((file) => file.fieldVisit).map((file, index) => (
                        <article key={`${item.id}-${index}`} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm">
                          <span>{L(item.name.bn, item.name.en)} · {file.name}</span>
                          <span className="text-muted-foreground">
                            {file.fieldVisit?.capturedAt}
                            {file.fieldVisit?.latitude !== undefined && file.fieldVisit.longitude !== undefined
                              ? ` · ${file.fieldVisit.latitude}, ${file.fieldVisit.longitude}`
                              : ""}
                          </span>
                        </article>
                      )),
                    ).length === 0 && (
                      <p className="rounded-lg border p-3 text-sm text-muted-foreground">{L("কোনো GPS পরিদর্শন সংরক্ষিত নেই।", "No GPS inspection records are available.")}</p>
                    )}
                  </section>
                </div>
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
                !user ? (
                  <div className="max-w-xl space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {L("অভিযোগ বা পরামর্শ জমা দিতে প্রথমে লগইন করুন।", "Please sign in to submit a complaint or suggestion.")}
                    </p>
                    <Button type="button" onClick={() => setFeedbackLoginOpen(true)}>
                      {L("লগইন করুন", "Sign in")}
                    </Button>
                  </div>
                ) : (
                  <form className="max-w-2xl space-y-4" onSubmit={submitFeedback}>
                    <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
                      <label htmlFor="support-category" className="text-sm font-semibold">
                        {L("বার্তার ধরন", "Message type")}
                      </label>
                      <Select
                        value={feedbackCategory}
                        onValueChange={(value) =>
                          setFeedbackCategory(value as "complaint" | "suggestion")
                        }
                      >
                        <SelectTrigger id="support-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="complaint">{L("অভিযোগ", "Complaint")}</SelectItem>
                          <SelectItem value="suggestion">{L("পরামর্শ", "Suggestion")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
                      <label htmlFor="support-subject" className="text-sm font-semibold">
                        {L("বিষয়", "Subject")}
                      </label>
                      <Input
                        id="support-subject"
                        maxLength={160}
                        minLength={3}
                        required
                        value={feedbackSubject}
                        onChange={(event) => setFeedbackSubject(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
                      <label htmlFor="support-message" className="pt-2 text-sm font-semibold">
                        {L("বিস্তারিত", "Details")}
                      </label>
                      <Textarea
                        id="support-message"
                        className="min-h-32"
                        maxLength={4000}
                        minLength={10}
                        required
                        value={feedbackMessage}
                        onChange={(event) => setFeedbackMessage(event.target.value)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={feedbackSaving}>
                        {feedbackSaving
                          ? L("জমা হচ্ছে…", "Submitting…")
                          : L("জমা দিন", "Submit")}
                      </Button>
                    </div>
                  </form>
                )
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
                    : {n(scopedUpazilas.length)} {L("উপজেলা", "upazilas")} · {n(selectedUnionCount)}{" "}
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
      <Dialog
        open={adminDraft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdminDraft(null);
            setAdminSignatureProof(null);
          }
        }}
      >
        <DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto border-emerald-200">
          {adminDraft && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="font-display text-xl text-emerald-950">
                  {adminDraft.kind === "legal"
                    ? L("ধারা ৭(২) আইনি নোটিশের খসড়া", "Section 7(2) legal notice draft")
                    : adminDraft.item.type === "birth"
                      ? L("শুভেচ্ছা বার্তা তৈরি করুন", "Create a greeting")
                      : L("সমবেদনা বার্তা তৈরি করুন", "Create a condolence message")}
                </DialogTitle>
                <DialogDescription>
                  {L("আবেদনকারী", "Applicant")}: {L(adminDraft.item.name.bn, adminDraft.item.name.en)}
                  {" · "}
                  {L("খসড়া ব্রাউজারে সংরক্ষিত হবে; কোনো বার্তা পাঠানো হবে না", "Draft is saved locally; no message will be sent")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  aria-label={L("বার্তার খসড়া", "Draft message")}
                  className="min-h-48"
                  maxLength={5000}
                  value={adminDraftText}
                  onChange={(event) => setAdminDraftText(event.target.value)}
                />
                {adminDraft.kind === "greeting" && (
                  <div className="space-y-2">
                    <label htmlFor="chairman-signature-proof" className="text-sm font-semibold">
                      {L("চেয়ারম্যানের স্বাক্ষর প্রমাণ (ঐচ্ছিক)", "Chairman signature proof (optional)")}
                    </label>
                    <Input
                      id="chairman-signature-proof"
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        if (file && file.size > 1024 * 1024) {
                          toast.error(L("ফাইলের আকার ১ MB-এর বেশি হতে পারবে না", "File must be 1 MB or smaller"));
                          event.currentTarget.value = "";
                          setAdminSignatureProof(null);
                          return;
                        }
                        setAdminSignatureProof(file);
                      }}
                    />
                    {adminSignatureProof && (
                      <p className="text-xs text-muted-foreground">{adminSignatureProof.name}</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => printPDF(
                      adminDraft.kind === "legal" ? L("ধারা ৭(২) নোটিশ", "Section 7(2) notice") : L("বার্তার খসড়া", "Message draft"),
                      [[L(adminDraft.item.name.bn, adminDraft.item.name.en), adminDraftText]],
                    )}
                  >
                    <Printer className="mr-2 h-4 w-4" />{L("প্রিন্ট", "Print")}
                  </Button>
                  <Button
                    type="button"
                    disabled={!adminDraftText.trim() || adminDraftSaving}
                    onClick={() => void saveAdminDraft()}
                  >
                    {adminDraftSaving ? L("সংরক্ষণ হচ্ছে…", "Saving…") : L("খসড়া সংরক্ষণ", "Save draft")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={previewEditingCase !== null}
        onOpenChange={(open) => !open && setPreviewEditingCase(null)}
      >
        <DialogContent className="max-w-lg border-emerald-200">
          {previewEditingCase && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="text-emerald-950">
                  {L("নমুনা আবেদন সম্পাদনা", "Edit mock application")}
                </DialogTitle>
                <DialogDescription>
                  {L("এই পরিবর্তন শুধু এই স্থানীয় প্রিভিউর নমুনা ডেটায় প্রযোজ্য হবে।", "Changes apply only to mock data in this local preview.")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block space-y-1 text-sm font-medium" htmlFor="preview-applicant-name">
                  {L("আবেদনকারীর নাম", "Applicant name")}
                  <Input
                    id="preview-applicant-name"
                    value={previewEditName}
                    onChange={(event) => setPreviewEditName(event.target.value)}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setPreviewEditingCase(null)}>
                    {L("বাতিল", "Cancel")}
                  </Button>
                  <Button
                    type="button"
                    disabled={!previewEditName.trim()}
                    onClick={() => {
                      setLocalPreviewCases((current) => current.map((item) =>
                        item.id === previewEditingCase.id
                          ? { ...item, name: { ...item.name, bn: previewEditName.trim() } }
                          : item,
                      ));
                      setPreviewEditingCase(null);
                      toast.success(L("নমুনা আবেদন আপডেট হয়েছে", "Mock application updated"));
                    }}
                  >
                    {L("নমুনা সংরক্ষণ", "Save mock")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <LoginDialog open={feedbackLoginOpen} onClose={() => setFeedbackLoginOpen(false)} />
    </section>
  );
}
