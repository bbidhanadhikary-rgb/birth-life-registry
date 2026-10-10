import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Baby,
  CalendarCheck2,
  ChartNoAxesCombined,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
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
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Footer } from "@/components/Footer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCaseDeadline } from "@/lib/compliance";
import { BANGLADESH_ADMINISTRATIVE_AREAS, filterCasesByAdministrativeArea, getAdministrativeWards } from "@/lib/geography";
import type { RegCase, Role } from "@/lib/types";
import { useApp } from "@/lib/store";

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

const publicActions: RoleAction[] = [
  { id: "dashboard", titleBn: "ড্যাশবোর্ড", titleEn: "Dashboard", descriptionBn: "জাতীয় ও স্থানীয় অগ্রগতি দেখুন", descriptionEn: "View national and local progress", Icon: MapPinned },
  { id: "reports", titleBn: "এলাকাভিত্তিক প্রতিবেদন", titleEn: "Regional reports", descriptionBn: "প্রশাসনিক এলাকার সারসংক্ষেপ", descriptionEn: "Administrative area summaries", Icon: ClipboardCheck },
  { id: "deadlines", titleBn: "সময়সীমা পর্যবেক্ষণ", titleEn: "Deadline monitoring", descriptionBn: "৩৬৫ দিনের সম্মতি ও সতর্কতা", descriptionEn: "365-day compliance and alerts", Icon: CalendarCheck2, filter: "urgent" },
  { id: "security", titleBn: "নিরাপদ প্রবেশ", titleEn: "Secure access", descriptionBn: "ভূমিকা-ভিত্তিক লগইন ও সেশন ব্যবস্থাপনা", descriptionEn: "Role-based sign-in and session management", Icon: ShieldCheck },
];

const roleActions: Record<Exclude<DashboardRole, "public" | "super">, RoleAction[]> = {
  worker: [
    { id: "birth-entry", titleBn: "জন্ম এন্ট্রি", titleEn: "Birth entry", descriptionBn: "নতুন জন্ম নিবন্ধনের তথ্য দিন", descriptionEn: "Start a new birth registration", Icon: Baby, filter: "birth" },
    { id: "death-entry", titleBn: "মৃত্যু এন্ট্রি", titleEn: "Death entry", descriptionBn: "নতুন মৃত্যু নিবন্ধনের তথ্য দিন", descriptionEn: "Start a new death registration", Icon: HeartPulse, filter: "death" },
    { id: "epi-followup", titleBn: "EPI ফলোআপ", titleEn: "EPI follow-up", descriptionBn: "টিকা সেশনের অনিবন্ধিত শিশু দেখুন", descriptionEn: "Review unregistered children from EPI sessions", Icon: ClipboardList, filter: "birth" },
    { id: "birth-list", titleBn: "জন্ম তালিকা", titleEn: "Birth entries", descriptionBn: "জমা দেওয়া জন্ম এন্ট্রি দেখুন", descriptionEn: "Review submitted birth entries", Icon: FileText, filter: "birth" },
    { id: "death-list", titleBn: "মৃত্যু তালিকা", titleEn: "Death entries", descriptionBn: "জমা দেওয়া মৃত্যু এন্ট্রি দেখুন", descriptionEn: "Review submitted death entries", Icon: FileCheck2, filter: "death" },
    { id: "corrections", titleBn: "সংশোধন", titleEn: "Corrections", descriptionBn: "অমীমাংসিত এন্ট্রি সংশোধন করুন", descriptionEn: "Review entries that can still be corrected", Icon: PencilLine, filter: "pending" },
    { id: "urgency", titleBn: "জরুরি কেস", titleEn: "Urgent cases", descriptionBn: "সময়সীমার কাছাকাছি কেস দেখুন", descriptionEn: "Review cases approaching the deadline", Icon: Clock3, filter: "urgent" },
    { id: "messages", titleBn: "কর্মকর্তার বার্তা", titleEn: "Officer messages", descriptionBn: "প্রশাসনিক মতামতসহ কেস দেখুন", descriptionEn: "Review cases with officer feedback", Icon: MessageSquareWarning, filter: "pending" },
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
    { id: "upazila-pending", titleBn: "অপেক্ষমাণ কেস", titleEn: "Pending cases", descriptionBn: "বিভিন্ন ইউনিয়নের অপেক্ষমাণ কেস", descriptionEn: "Pending cases across unions", Icon: Inbox, filter: "pending" },
    { id: "compliance-audit", titleBn: "সম্মতি নিরীক্ষা", titleEn: "Compliance audit", descriptionBn: "৩৬৫ দিনের সম্মতি ও জরুরি সতর্কতা", descriptionEn: "365-day compliance and urgency alerts", Icon: ShieldCheck, filter: "urgent" },
    { id: "upazila-progress-cases", titleBn: "চলমান নিবন্ধন", titleEn: "Registrations in progress", descriptionBn: "চলমান জন্ম ও মৃত্যু নিবন্ধন", descriptionEn: "Birth and death registrations in progress", Icon: Clock3, filter: "progress" },
    { id: "upazila-completed", titleBn: "সম্পন্ন কেস", titleEn: "Completed cases", descriptionBn: "চূড়ান্ত নিবন্ধন সম্পন্ন কেস", descriptionEn: "Cases with completed registration", Icon: CheckCheck, filter: "completed" },
    { id: "master-report", titleBn: "মাস্টার প্রতিবেদন", titleEn: "Master report", descriptionBn: "উপজেলাভিত্তিক জন্ম ও মৃত্যু সারসংক্ষেপ", descriptionEn: "Upazila birth and death summary", Icon: FileText },
  ],
};

export function RegistrationDashboard({ role = "public" }: { role?: DashboardRole }) {
  const { state, L, n } = useApp();
  const [division, setDivision] = useState("all");
  const [district, setDistrict] = useState("all");
  const [upazila, setUpazila] = useState("all");
  const [union, setUnion] = useState("all");
  const [ward, setWard] = useState("all");
  const [activeCard, setActiveCard] = useState<{ kind: "metric" | "action"; id: string } | null>(
    null,
  );
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
  const roleConfig = role === "super" ? "uno" : role;
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
    () =>
      getAdministrativeWards(
        selectedCityCorporation && selectedUpazila
          ? selectedUpazila.id
          : selectedUnion?.id ?? "",
      ),
    [selectedCityCorporation, selectedUnion, selectedUpazila],
  );
  const filteredCases = useMemo(() => {
    return filterCasesByAdministrativeArea(state.cases, state.upazilas, {
      division,
      district,
      upazila,
      union,
      ward,
    });
  }, [state.cases, state.upazilas, division, district, upazila, union, ward]);
  const openCases = filteredCases.filter((item) => item.status !== "completed");
  const urgency = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0, expired: 0, review: 0 };
    for (const item of openCases) {
      const deadline = getCaseDeadline(item);
      if (!deadline) {
        counts.review += 1;
      } else if (deadline.elapsedDays <= 30) {
        counts.green += 1;
      } else if (deadline.elapsedDays <= 180) {
        counts.yellow += 1;
      } else if (deadline.elapsedDays <= 365) {
        counts.red += 1;
      } else {
        counts.expired += 1;
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
        return item.status !== "completed" && !!deadline && deadline.elapsedDays > 180;
      })
    : filteredCases;
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

  const openCaseDialog = (kind: "metric" | "action", id: string) => setActiveCard({ kind, id });
  const renderCaseSummary = (cases: RegCase[]) => (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: L("মোট কেস", "Total cases"), value: cases.length },
        {
          label: L("অপেক্ষমাণ", "Open"),
          value: cases.filter((item) => item.status !== "completed").length,
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
      { label: L("০–৩০ দিন", "0–30 days"), value: urgency.green, color: "bg-emerald-500" },
      { label: L("৩১–১৮০ দিন", "31–180 days"), value: urgency.yellow, color: "bg-amber-400" },
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
    <section className="flex h-[calc(100svh-6.6rem)] flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-[#f3f7f8] to-teal-50/60 text-[#102a43]">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-2.5 max-[360px]:gap-1.5 max-[360px]:px-3 max-[360px]:py-1.5 sm:gap-3 sm:px-6 sm:py-3">
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
              className="h-8 min-w-0 border-emerald-200 bg-white/90 px-2 text-[10px] sm:text-xs"
              aria-label={L("বিভাগ নির্বাচন", "Select division")}
            >
              <SelectValue placeholder={L("বিভাগ", "Division")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("সব বিভাগ", "All divisions")}</SelectItem>
              {divisions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
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
              className="h-8 min-w-0 border-emerald-200 bg-white/90 px-2 text-[10px] sm:text-xs"
              aria-label={L("জেলা নির্বাচন", "Select district")}
            >
              <SelectValue placeholder={L("জেলা", "District")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("সব জেলা", "All districts")}</SelectItem>
              {districts.map((item) => (
                <SelectItem key={item.id} value={item.id}>
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
              className="h-8 min-w-0 border-emerald-200 bg-white/90 px-2 text-[10px] sm:text-xs"
              aria-label={L("উপজেলা / সিটি কর্পোরেশন নির্বাচন", "Select upazila / city corporation")}
            >
              <SelectValue placeholder={L("উপজেলা / সিটি কর্পোরেশন", "Upazila / City Corporation")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("সব উপজেলা / সিটি কর্পোরেশন", "All upazilas / city corporations")}</SelectItem>
              {matchingUpazilas.map((item) => (
                <SelectItem key={item.id} value={item.id}>
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
              className="h-8 min-w-0 border-emerald-200 bg-white/90 px-2 text-[10px] sm:text-xs"
              aria-label={L("ইউনিয়ন / পৌরসভা নির্বাচন", "Select union / municipality")}
            >
              <SelectValue placeholder={L("ইউনিয়ন / পৌরসভা", "Union / Municipality")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {selectedCityCorporation
                  ? L("সিটি কর্পোরেশনে প্রযোজ্য নয়", "Not applicable to city corporations")
                  : L("সব ইউনিয়ন / পৌরসভা", "All unions / municipalities")}
              </SelectItem>
              {unions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {L(item.bn, item.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ward} onValueChange={setWard} disabled={wards.length === 0}>
            <SelectTrigger
              className="h-8 min-w-0 border-emerald-200 bg-white/90 px-2 text-[10px] sm:text-xs"
              aria-label={L("ওয়ার্ড নির্বাচন", "Select ward")}
            >
              <SelectValue placeholder={L("ওয়ার্ড", "Ward")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("সব ওয়ার্ড", "All wards")}</SelectItem>
              {wards.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {L(item.bn, item.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <section
          className="flex shrink-0 flex-wrap items-center gap-1.5 text-[9px] sm:gap-2 sm:text-[10px]"
          aria-label={L("নিবন্ধন জরুরিতা", "Registration urgency")}
        >
          <span className="mr-1 font-semibold text-slate-600">{L("জরুরিতা", "Urgency")} ·</span>
          <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">
            {L("০–৩০ দিন: সবুজ", "0–30 days: green")} · {n(urgency.green)}
          </span>
          <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800">
            {L("৩১–১৮০ দিন: হলুদ", "31–180 days: yellow")} · {n(urgency.yellow)}
          </span>
          <span className="rounded-full bg-red-100 px-2 py-1 font-medium text-red-800">
            {L("১৮১–৩৬৫ দিন: লাল এলার্ট", "181–365 days: red alert")} · {n(urgency.red)}
          </span>
          {urgency.expired > 0 && (
            <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700">
              {L("সময়সীমা পেরিয়েছে", "Past deadline")} · {n(urgency.expired)}
            </span>
          )}
        </section>
        <div className="grid min-h-0 flex-1 gap-2 sm:gap-4 lg:-translate-y-3 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8">
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
            className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-4 max-[360px]:gap-1 sm:gap-3"
            aria-label={L("জাতীয় মূল সূচক", "National key indicators")}
          >
            {metrics.map(({ id, value, label, detail, Icon }) => (
              <button
                type="button"
                key={label}
                onClick={() => openCaseDialog("metric", id)}
                className="group flex min-h-24 cursor-pointer flex-col justify-between rounded-xl border border-teal-200/80 bg-gradient-to-br from-white via-teal-50/70 to-white p-3 text-left shadow-[0_8px_24px_-16px_rgba(13,148,136,0.38)] transition-all hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 max-[360px]:min-h-16 max-[360px]:rounded-lg max-[360px]:p-2 sm:min-h-32 sm:rounded-2xl sm:p-4"
                aria-label={`${label}: ${value}. ${detail}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 max-[360px]:text-[9px] sm:text-xs">
                    {label}
                  </span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal-100 to-emerald-50 text-teal-700 max-[360px]:hidden">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-1 font-display text-2xl font-bold leading-none text-[#102a43] max-[360px]:mt-0 max-[360px]:text-base sm:text-3xl">
                  {value}
                </div>
                <p className="mt-1 text-[10px] leading-tight text-slate-500 max-[360px]:hidden sm:text-xs">
                  {detail}
                </p>
              </button>
            ))}
          </section>
        </div>

        <section aria-labelledby="quick-actions-heading">
          <div className="mb-2 flex items-center justify-between">
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
                className={`group flex min-h-[4.25rem] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition-all hover:scale-[1.02] hover:border-teal-600/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 max-[360px]:min-h-14 max-[360px]:gap-1.5 max-[360px]:px-2 sm:min-h-[4.75rem] sm:gap-3 sm:px-4 ${roleConfig !== "public" ? "role-action-card max-sm:min-h-12 max-sm:flex-col max-sm:justify-center max-sm:px-1 max-sm:py-1 max-sm:text-center" : ""}`}
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
          if (!open) setActiveCard(null);
        }}
      >
        <DialogContent className="max-h-[85svh] max-w-xl overflow-y-auto rounded-2xl border-emerald-100 p-4 sm:p-6">
          {currentCard && (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle className="font-display text-xl text-emerald-950">
                  {currentCard.title}
                </DialogTitle>
                <DialogDescription>{currentCard.description}</DialogDescription>
              </DialogHeader>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
