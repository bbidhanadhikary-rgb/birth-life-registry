import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  Download,
  FileImage,
  FileText,
  HeartPulse,
  MessageSquareWarning,
  Pencil,
  Plus,
  Syringe,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCaseHelpers } from "@/components/shared";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { compressImage } from "@/lib/compress-image";
import { getCaseDeadline } from "@/lib/compliance";
import { downloadCSV, printPDF } from "@/lib/report";
import { roleLabel, scopedCases, useApp } from "@/lib/store";
import type { Bi, RegCase } from "@/lib/types";

const emptyBi: Bi = { bn: "", en: "" };
type CaseType = "birth" | "death";
type DialogState =
  | { kind: "form"; type: CaseType; entry?: RegCase | undefined }
  | { kind: "entries"; type: CaseType }
  | { kind: "epi" }
  | null;
type EpiVisit = Tables<"epi_visits">;

function BiField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: Bi;
  onChange: (next: Bi) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="min-w-0 space-y-1">
      <legend className="text-xs font-semibold text-slate-700">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label={`${label} — বাংলা`}
          autoComplete="off"
          maxLength={100}
          placeholder="বাংলা"
          required={required}
          value={value.bn}
          onChange={(event) => onChange({ ...value, bn: event.target.value })}
        />
        <Input
          aria-label={`${label} — English`}
          autoComplete="off"
          maxLength={100}
          placeholder="English"
          required={required}
          value={value.en}
          onChange={(event) => onChange({ ...value, en: event.target.value })}
        />
      </div>
    </fieldset>
  );
}

function RegForm({
  type,
  entry,
  onSaved,
}: {
  type: CaseType;
  entry?: RegCase | undefined;
  onSaved: () => void;
}) {
  const { L, user, state, addCase, updateCase } = useApp();
  const upazila = user ? state.upazilas.find((area) => area.id === user.upazilaId) : undefined;
  const union = upazila?.unions.find((area) => area.id === user?.unionId);
  const [name, setName] = useState<Bi>(entry?.name ?? emptyBi);
  const [father, setFather] = useState<Bi>(entry?.father ?? emptyBi);
  const [mother, setMother] = useState<Bi>(entry?.mother ?? emptyBi);
  const [cause, setCause] = useState<Bi>(entry?.cause ?? emptyBi);
  const [nid, setNid] = useState(entry?.nid ?? "");
  const [mobile, setMobile] = useState(entry?.parentMobile ?? "");
  const [gender, setGender] = useState<RegCase["gender"]>(entry?.gender ?? "male");
  const [dob, setDob] = useState(entry?.dob ?? "");
  const [dod, setDod] = useState(entry?.dod ?? "");
  const [order, setOrder] = useState(entry?.order ?? "1");
  const [villageId, setVillageId] = useState(entry?.villageId ?? "");
  const [attachments, setAttachments] = useState<(File | null)[]>([null, null, null]);
  const [filesChanged, setFilesChanged] = useState(false);
  const [compressing, setCompressing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const village = union?.villages.find((item) => item.id === villageId);
  const oldFiles = entry?.files ?? [];

  const chooseImage = async (index: number, file?: File) => {
    if (!file) return;
    setCompressing(index);
    setError("");
    try {
      const compressed = await compressImage(file);
      setAttachments((current) =>
        current.map((item, position) => (position === index ? compressed : item)),
      );
      setFilesChanged(true);
      toast.success(
        L(
          `ছবি সংকুচিত হয়েছে · ${Math.ceil(compressed.size / 1024)} KB`,
          `Image compressed · ${Math.ceil(compressed.size / 1024)} KB`,
        ),
      );
    } catch (causeError) {
      const message =
        causeError instanceof Error
          ? causeError.message
          : L("ছবি প্রস্তুত করা যায়নি", "Could not prepare image");
      setError(message);
      toast.error(message);
    } finally {
      setCompressing(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!user || !union || !upazila) {
      setError(L("আপনার নির্ধারিত এলাকা পাওয়া যায়নি", "Your assigned area could not be found"));
      return;
    }
    if (
      !name.bn.trim() ||
      !name.en.trim() ||
      !father.bn.trim() ||
      !father.en.trim() ||
      !mother.bn.trim() ||
      !mother.en.trim()
    ) {
      setError(
        L(
          "শিশু/ব্যক্তি, পিতা ও মাতার নাম বাংলা ও ইংরেজিতে দিন",
          "Enter the child/person, father and mother's names in Bangla and English",
        ),
      );
      return;
    }
    if (!/^(\d{10}|\d{13}|\d{17})$/.test(nid)) {
      setError(
        L(
          "NID/জন্ম নিবন্ধন নম্বর ১০, ১৩ বা ১৭ অঙ্কের হতে হবে",
          "NID/BRN must be 10, 13 or 17 digits",
        ),
      );
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(mobile)) {
      setError(
        L(
          "সক্রিয় ১১ অঙ্কের বাংলাদেশি মোবাইল নম্বর দিন",
          "Enter an active 11-digit Bangladesh mobile number",
        ),
      );
      return;
    }
    if (
      !dob ||
      !villageId ||
      (type === "death" && (!dod || !cause.bn.trim() || !cause.en.trim()))
    ) {
      setError(
        L(
          "তারিখ, গ্রাম এবং প্রযোজ্য মৃত্যুর কারণ পূরণ করুন",
          "Complete the dates, village and, for death entries, cause of death",
        ),
      );
      return;
    }
    if (type === "birth" && (!/^\d+$/.test(order) || Number(order) < 1 || Number(order) > 20)) {
      setError(L("সন্তানের ক্রম ১ থেকে ২০-এর মধ্যে দিন", "Child order must be between 1 and 20"));
      return;
    }

    setSaving(true);
    try {
      const data = {
        type,
        name,
        father,
        mother,
        nid,
        parentMobile: mobile,
        gender,
        dob,
        order: type === "birth" ? order : undefined,
        dod: type === "death" ? dod : undefined,
        cause: type === "death" ? cause : undefined,
        villageId,
      };
      if (entry) {
        const updated = await updateCase(entry.id, {
          ...data,
          ...(filesChanged
            ? { files: attachments.filter((file): file is File => file !== null) }
            : {}),
        });
        if (!updated) return;
        toast.success(L("এন্ট্রি সংশোধন হয়েছে", "Entry corrected"));
      } else {
        const addError = await addCase({
          ...data,
          files: attachments.filter((file): file is File => file !== null),
        });
        if (addError) {
          setError(addError);
          toast.error(addError);
          return;
        }
        toast.success(L("এন্ট্রি জমা হয়েছে", "Entry submitted"));
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!upazila || !union) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        {L(
          "এই কর্মী অ্যাকাউন্টের জন্য উপজেলা/ইউনিয়ন নির্ধারিত নেই। প্রশাসককে জানান।",
          "No upazila/union is assigned to this worker account. Contact an administrator.",
        )}
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <BiField
          label={
            type === "birth"
              ? L("শিশুর নাম", "Baby's name")
              : L("মৃত ব্যক্তির নাম", "Deceased person's name")
          }
          value={name}
          onChange={setName}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              {L("NID / জন্ম নিবন্ধন নং", "NID / birth registration no.")}
            </Label>
            <Input
              autoComplete="off"
              inputMode="numeric"
              maxLength={17}
              required
              value={nid}
              onChange={(event) => setNid(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">{L("লিঙ্গ", "Gender")}</Label>
            <Select value={gender} onValueChange={(value) => setGender(value as RegCase["gender"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{L("পুরুষ", "Male")}</SelectItem>
                <SelectItem value="female">{L("মহিলা", "Female")}</SelectItem>
                <SelectItem value="other">{L("অন্যান্য", "Other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <BiField
          label={L("পিতার নাম", "Father's name")}
          value={father}
          onChange={setFather}
          required
        />
        <BiField
          label={L("মাতার নাম", "Mother's name")}
          value={mother}
          onChange={setMother}
          required
        />
        <div className="space-y-1">
          <Label className="text-xs font-semibold">
            {L("সক্রিয় মোবাইল নম্বর", "Active mobile number")}
          </Label>
          <Input
            autoComplete="tel"
            inputMode="tel"
            maxLength={11}
            placeholder="01XXXXXXXXX"
            required
            value={mobile}
            onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 11))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">{L("জন্ম তারিখ", "Date of birth")}</Label>
          <Input
            type="date"
            required
            value={dob}
            onChange={(event) => setDob(event.target.value)}
          />
        </div>
        {type === "birth" ? (
          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              {L("কত তম সন্তান", "Child order / number")}
            </Label>
            <Input
              type="number"
              min={1}
              max={20}
              required
              value={order}
              onChange={(event) => setOrder(event.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{L("মৃত্যুর তারিখ", "Date of death")}</Label>
              <Input
                type="date"
                required
                value={dod}
                onChange={(event) => setDod(event.target.value)}
              />
            </div>
            <BiField
              label={L("মৃত্যুর কারণ", "Cause of death")}
              value={cause}
              onChange={setCause}
              required
            />
          </>
        )}
        <div className="space-y-1">
          <Label className="text-xs font-semibold">{L("গ্রামের নাম", "Village name")}</Label>
          <Select value={villageId} onValueChange={setVillageId}>
            <SelectTrigger aria-label={L("গ্রাম নির্বাচন", "Select village")}>
              <SelectValue placeholder={L("শুধু গ্রাম বেছে নিন", "Select village only")} />
            </SelectTrigger>
            <SelectContent>
              {union.villages.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.bn} / {item.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {village && (
        <div className="grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-950 sm:grid-cols-2">
          <p>
            ডাকঘর: {village.poBn} · ওয়ার্ড {village.ward} · {union.bn} · {upazila.bn} ·{" "}
            {upazila.districtBn} · {upazila.divisionBn} · বাংলাদেশ
          </p>
          <p>
            Post Office: {village.poEn} · Ward {village.ward} · {union.en} · {upazila.en} ·{" "}
            {upazila.districtEn} · {upazila.divisionEn} · Bangladesh
          </p>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-slate-700">
          {L("ছবি সংযুক্তি · প্রতিটি সর্বোচ্চ ১৫০ KB", "Photo attachments · maximum 150 KB each")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {attachments.map((file, index) => (
            <label
              key={index}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-white px-3 py-2 text-xs hover:bg-emerald-50"
            >
              <FileImage className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="min-w-0 flex-1 truncate">
                {compressing === index
                  ? L("সংকুচিত হচ্ছে…", "Compressing…")
                  : file
                    ? `${file.name} · ${Math.ceil(file.size / 1024)} KB`
                    : (oldFiles[index]?.name ??
                      L(`ছবি ${index + 1} বাছুন`, `Choose image ${index + 1}`))}
              </span>
              {file && (
                <button
                  type="button"
                  className="font-bold text-red-700"
                  aria-label={L("ছবি সরান", "Remove image")}
                  onClick={(event) => {
                    event.preventDefault();
                    setAttachments((current) =>
                      current.map((item, position) => (position === index ? null : item)),
                    );
                    setFilesChanged(true);
                  }}
                >
                  ×
                </button>
              )}
              <input
                accept="image/*"
                className="sr-only"
                disabled={compressing !== null}
                type="file"
                onChange={(event) => void chooseImage(index, event.target.files?.[0])}
              />
            </label>
          ))}
        </div>
        {entry && oldFiles.length > 0 && !filesChanged && (
          <p className="text-[11px] text-slate-500">
            {L(
              "সংরক্ষিত ছবি অপরিবর্তিত থাকবে; নতুন ছবি দিলে সংযুক্তি প্রতিস্থাপিত হবে।",
              "Saved photos remain unless new photos are selected; selecting new photos replaces the attachments.",
            )}
          </p>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || compressing !== null || !villageId}>
          {saving
            ? L("সংরক্ষণ হচ্ছে…", "Saving…")
            : entry
              ? L("সংশোধন সংরক্ষণ", "Save correction")
              : L("নিবন্ধন এন্ট্রি জমা দিন", "Submit registration entry")}
        </Button>
      </div>
    </form>
  );
}

function EpiAttendanceForm({ onSaved }: { onSaved: () => void }) {
  const { L, user, state, addEpiVisit } = useApp();
  const assignedUpazila = user
    ? state.upazilas.find((item) => item.id === user.upazilaId)
    : undefined;
  const assignedUnion = assignedUpazila?.unions.find((item) => item.id === user?.unionId);
  const [name, setName] = useState<Bi>(emptyBi);
  const [mobile, setMobile] = useState("");
  const [villageId, setVillageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !assignedUnion || !assignedUpazila) return;
    if (!name.bn.trim() || !name.en.trim() || !/^01[3-9]\d{8}$/.test(mobile) || !villageId) {
      setError(
        L(
          "নাম, সক্রিয় মোবাইল ও গ্রাম সঠিকভাবে পূরণ করুন",
          "Enter the child's name, active mobile and village",
        ),
      );
      return;
    }
    setSaving(true);
    const insertError = await addEpiVisit({
      child_name_bn: name.bn.trim(),
      child_name_en: name.en.trim(),
      parent_mobile: mobile,
      village_id: villageId,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError);
      toast.error(insertError);
      return;
    }
    toast.success(L("EPI উপস্থিতি সংরক্ষিত হয়েছে", "EPI attendance recorded"));
    onSaved();
  };

  if (!assignedUpazila || !assignedUnion) {
    return (
      <p className="text-sm text-red-700">
        {L("কর্মীর নির্ধারিত এলাকা পাওয়া যায়নি", "Worker's assigned area is unavailable")}
      </p>
    );
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <BiField label={L("শিশুর নাম", "Infant's name")} value={name} onChange={setName} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">
            {L("অভিভাবকের সক্রিয় মোবাইল", "Parent's active mobile")}
          </Label>
          <Input
            inputMode="tel"
            maxLength={11}
            placeholder="01XXXXXXXXX"
            required
            value={mobile}
            onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 11))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">{L("গ্রাম", "Village")}</Label>
          <Select value={villageId} onValueChange={setVillageId}>
            <SelectTrigger>
              <SelectValue placeholder={L("গ্রাম নির্বাচন", "Select village")} />
            </SelectTrigger>
            <SelectContent>
              {assignedUnion.villages.map((village) => (
                <SelectItem key={village.id} value={village.id}>
                  {village.bn} / {village.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? L("সংরক্ষণ হচ্ছে…", "Saving…") : L("উপস্থিতি সংরক্ষণ", "Record attendance")}
        </Button>
      </div>
    </form>
  );
}

export function WorkerDashboard() {
  const { L, n, user, state, refresh, demoMode, epiVisits } = useApp();
  const { address, date, rows } = useCaseHelpers();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [visits, setVisits] = useState<EpiVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const mine = scopedCases(state, user);
  const workerCases = useMemo(
    () => mine.filter((item) => item.createdBy === user?.id),
    [mine, user?.id],
  );
  const births = workerCases.filter((item) => item.type === "birth");
  const deaths = workerCases.filter((item) => item.type === "death");
  const adminMessages = workerCases.flatMap((entry) =>
    entry.remarks.filter((remark) => remark.role === "admin").map((remark) => ({ entry, remark })),
  );

  const loadVisits = useCallback(async () => {
    if (!user?.id) return;
    setLoadingVisits(true);
    if (demoMode) {
      setVisits(epiVisits.filter((visit) => visit.created_by === user.id));
      setLoadingVisits(false);
      return;
    }
    const { data, error } = await supabase
      .from("epi_visits")
      .select("*")
      .eq("created_by", user.id)
      .order("attended_at", { ascending: false })
      .limit(50);
    setLoadingVisits(false);
    if (error) {
      console.error("Failed to load EPI attendance records", error);
      toast.error(
        L("EPI উপস্থিতির তালিকা লোড করা যায়নি", "Could not load EPI attendance records"),
      );
      return;
    }
    setVisits(data);
  }, [L, user?.id, demoMode, epiVisits]);

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    if (!user?.id) return;
    if (demoMode) return;
    const channel = supabase
      .channel(`worker-admin-notices-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "case_remarks",
          filter: "role=eq.admin",
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cases",
        },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Live administrative notice subscription failed", status);
          toast.error(
            L("লাইভ প্রশাসনিক বার্তা সংযোগ বিচ্ছিন্ন", "Live officer-notice connection failed"),
          );
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [L, refresh, user?.id, demoMode]);

  const pendingVisits = visits.filter((visit) => {
    const linkedCase = visit.registration_case_id
      ? state.cases.find((item) => item.id === visit.registration_case_id)
      : undefined;
    return !linkedCase || linkedCase.status !== "completed";
  });

  const urgency = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0, expired: 0 };
    for (const entry of workerCases) {
      if (entry.status === "completed") continue;
      const deadline = getCaseDeadline(entry);
      if (!deadline) continue;
      if (deadline.elapsedDays <= 30) counts.green++;
      else if (deadline.elapsedDays <= 180) counts.yellow++;
      else if (deadline.elapsedDays <= 365) counts.red++;
      else counts.expired++;
    }
    return counts;
  }, [workerCases]);

  if (!user) return null;
  const goToForm = (type: CaseType, entry?: RegCase) =>
    setDialog(entry ? { kind: "form", type, entry } : { kind: "form", type });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-2 text-slate-900 sm:gap-3 sm:p-4">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800 sm:text-xs">
            {L("স্বাস্থ্যকর্মী / ইপিআই কর্মী", "Health Worker / EPI Worker")}
          </p>
          <h1 className="truncate font-display text-lg font-bold text-emerald-950 sm:text-2xl">
            {L(`স্বাগতম, ${user.name.bn}`, `Welcome, ${user.name.en}`)}
          </h1>
        </div>
        {demoMode && (
          <span className="inline-flex shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-950">
            <span className="sm:hidden">DEMO</span>
            <span className="hidden sm:inline">LOCAL DEMO · NOT SAVED</span>
          </span>
        )}
        <span className="hidden rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-900 sm:inline-flex">
          {L("ওয়ার্ড", "Ward")} {n(user.ward ?? 1)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-white/90"
          aria-label={L("রিপোর্ট ডাউনলোড", "Download report")}
          onClick={() => downloadCSV(rows(workerCases), "my-report.csv")}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-white/90"
          aria-label={L("রিপোর্ট প্রিন্ট বা PDF", "Print or save report as PDF")}
          onClick={() =>
            printPDF(L("স্বাস্থ্যকর্মী প্রতিবেদন", "Health Worker Report"), rows(workerCases))
          }
        >
          <FileText className="h-4 w-4" />
        </Button>
      </div>

      {adminMessages.length > 0 && (
        <div
          className="flex shrink-0 items-center gap-2 overflow-hidden rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900"
          role="alert"
        >
          <MessageSquareWarning className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <span className="shrink-0">{L("জরুরি প্রশাসনিক বার্তা", "Urgent officer message")}</span>
          <span className="truncate font-normal">
            {L(adminMessages[0]!.remark.text, adminMessages[0]!.remark.text)} ·{" "}
            {L(adminMessages[0]!.entry.name.bn, adminMessages[0]!.entry.name.en)}
          </span>
          {adminMessages.length > 1 && (
            <span className="ml-auto shrink-0">+{n(adminMessages.length - 1)}</span>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-2 overflow-hidden lg:grid-cols-[1.15fr_0.85fr] lg:grid-rows-1 lg:gap-3">
        <section
          className="flex min-h-0 flex-col gap-2 sm:gap-3"
          aria-label={L("সম্মতি ও EPI পর্যবেক্ষণ", "Compliance and EPI monitoring")}
        >
          <div className="shrink-0 rounded-xl border border-emerald-200 bg-white/95 p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h2 className="text-sm font-bold text-emerald-950">
                {L("৩৬৫ দিনের সম্মতি ও বয়স সতর্কতা", "365-day compliance & age alerts")}
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {[
                {
                  label: L("০–৩০ দিন · নিরাপদ", "0–30 days · safe"),
                  count: urgency.green,
                  tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
                  dot: "bg-emerald-500",
                },
                {
                  label: L("৩১–১৮০ দিন · চলমান", "31–180 days · running"),
                  count: urgency.yellow,
                  tone: "border-amber-200 bg-amber-50 text-amber-950",
                  dot: "bg-amber-400",
                },
                {
                  label: L("১৮১–৩৬৫ দিন · জরুরি", "181–365 days · urgent"),
                  count: urgency.red,
                  tone: "border-red-200 bg-red-50 text-red-900",
                  dot: "bg-red-500",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`min-w-0 rounded-lg border px-2 py-2 ${item.tone}`}
                >
                  <p className="flex items-center gap-1 truncate text-[9px] font-semibold sm:text-xs">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                    {item.label}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold leading-none sm:text-2xl">
                    {n(item.count)}
                  </p>
                </div>
              ))}
            </div>
            {urgency.expired > 0 && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-red-800 sm:text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                {L("৩৬৫ দিনের সময়সীমা অতিক্রান্ত", "Past 365-day deadline")}: {n(urgency.expired)}
              </p>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-emerald-200 bg-white/95 shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-100 px-3 py-2.5 sm:px-4">
              <div className="flex items-center gap-2">
                <Syringe className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <div>
                  <h2 className="text-xs font-bold text-emerald-950 sm:text-sm">
                    {L("EPI সেশন · নিবন্ধন অনুসরণ", "EPI session · registration follow-up")}
                  </h2>
                  <p className="text-[9px] text-slate-500 sm:text-[11px]">
                    {L(
                      "টিকা নিতে আসা শিশুদের উপস্থিতি ও জন্ম নিবন্ধন অবস্থা",
                      "Attendance and birth-registration status of infants seen",
                    )}
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-900">
                  {n(pendingVisits.length)}
                </span>
              </div>
              <Button
                size="sm"
                className="h-8 shrink-0 px-2 text-[10px] sm:text-xs"
                onClick={() => setDialog({ kind: "epi" })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {L("উপস্থিতি", "Attendance")}
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 sm:p-3">
              {loadingVisits ? (
                <p className="p-3 text-center text-xs text-slate-500">
                  {L("EPI তালিকা লোড হচ্ছে…", "Loading EPI list…")}
                </p>
              ) : pendingVisits.length ? (
                pendingVisits.map((visit) => {
                  const linkedCase = visit.registration_case_id
                    ? state.cases.find((item) => item.id === visit.registration_case_id)
                    : undefined;
                  const village = state.upazilas
                    .find((item) => item.id === visit.upazila_id)
                    ?.unions.find((item) => item.id === visit.union_id)
                    ?.villages.find((item) => item.id === visit.village_id);
                  return (
                    <div
                      key={visit.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2"
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${linkedCase ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}
                      >
                        {linkedCase ? (
                          <ClipboardList className="h-4 w-4" />
                        ) : (
                          <HeartPulse className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">
                          {L(visit.child_name_bn, visit.child_name_en)}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          {village ? L(village.bn, village.en) : visit.village_id} ·{" "}
                          {date(Date.parse(visit.attended_at))} · {visit.parent_mobile}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${linkedCase ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"}`}
                      >
                        {linkedCase
                          ? L("UP অনুমোদন পেন্ডিং", "UP approval pending")
                          : L("জন্ম এন্ট্রি বাকি", "Entry needed")}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full min-h-16 items-center justify-center text-center text-xs text-slate-500">
                  {L(
                    "সব উপস্থিত শিশু নিবন্ধিত/অনুমোদিত — নতুন EPI উপস্থিতি যোগ করুন",
                    "All infants are registered/approved — add a new EPI attendance",
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          className="flex min-h-0 flex-col gap-2 sm:gap-3"
          aria-label={L("দ্রুত এন্ট্রি ও তালিকা", "Quick entry and registers")}
        >
          <div className="shrink-0 rounded-xl border border-emerald-200 bg-white/95 p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-emerald-950">
                {L("দ্রুত প্রাথমিক এন্ট্রি", "Quick registration entry")}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => goToForm("birth")}
                className="flex min-h-16 cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-left transition-all hover:scale-[1.02] hover:shadow-md sm:min-h-20 sm:px-3"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-700 text-white">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-emerald-950 sm:text-sm">
                    {L("জন্ম নিবন্ধন", "Birth entry")}
                  </span>
                  <span className="block text-[9px] text-emerald-800 sm:text-[11px]">
                    {L("নবজাতকের তথ্য", "Newborn details")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => goToForm("death")}
                className="flex min-h-16 cursor-pointer items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-left transition-all hover:scale-[1.02] hover:shadow-md sm:min-h-20 sm:px-3"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-800 text-white">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-teal-950 sm:text-sm">
                    {L("মৃত্যু নিবন্ধন", "Death entry")}
                  </span>
                  <span className="block text-[9px] text-teal-800 sm:text-[11px]">
                    {L("প্রাথমিক তথ্য", "Initial details")}
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
            {[
              {
                type: "birth" as const,
                title: L("জন্ম এন্ট্রি তালিকা", "Birth registry entries"),
                rows: births,
                tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
              },
              {
                type: "death" as const,
                title: L("মৃত্যু এন্ট্রি তালিকা", "Death registry entries"),
                rows: deaths,
                tone: "border-teal-200 bg-teal-50 text-teal-950",
              },
            ].map((list) => {
              const awaiting = list.rows.filter((entry) => entry.status !== "completed").length;
              return (
                <button
                  key={list.type}
                  type="button"
                  onClick={() => setDialog({ kind: "entries", type: list.type })}
                  className={`flex min-h-0 cursor-pointer flex-col rounded-xl border p-3 text-left shadow-sm transition-all hover:scale-[1.02] hover:shadow-md sm:p-4 ${list.tone}`}
                >
                  <ClipboardList className="mb-2 h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-bold sm:text-sm">{list.title}</span>
                  <span className="mt-auto pt-2 font-display text-2xl font-bold sm:text-3xl">
                    {n(list.rows.length)}
                  </span>
                  <span className="text-[9px] sm:text-[11px]">
                    {L("UP অনুমোদন অপেক্ষমাণ", "Awaiting UP approval")}: {n(awaiting)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden shrink-0 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2 text-[10px] text-slate-600 lg:block lg:text-xs">
            <div className="flex items-center gap-2">
              {workerCases.some((entry) => !entry.synced) ? (
                <CloudOff className="h-4 w-4 text-amber-700" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              )}
              <span>
                {L("মোট এন্ট্রি", "Total entries")}: <b>{n(workerCases.length)}</b>
              </span>
              <span className="ml-auto">
                {L("অপেক্ষমাণ", "Pending")}:{" "}
                <b>{n(workerCases.filter((entry) => entry.status !== "completed").length)}</b>
              </span>
            </div>
          </div>
        </section>
      </div>

      <Footer compact />

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[92svh] max-w-4xl overflow-y-auto rounded-2xl border-emerald-200 p-4 sm:p-6">
          {dialog?.kind === "form" && (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle className="font-display text-xl text-emerald-950">
                  {dialog.entry
                    ? L("এন্ট্রি সংশোধন", "Correct registration entry")
                    : dialog.type === "birth"
                      ? L("জন্ম নিবন্ধন প্রাথমিক এন্ট্রি", "Newborn quick entry")
                      : L("মৃত্যু নিবন্ধন প্রাথমিক এন্ট্রি", "Death registration quick entry")}
                </DialogTitle>
                <DialogDescription>
                  {L(
                    "গ্রাম নির্বাচন করলে নির্ধারিত এলাকার ঠিকানা স্বয়ংক্রিয়ভাবে যুক্ত হবে।",
                    "Selecting a village automatically fills the worker's assigned administrative address.",
                  )}
                </DialogDescription>
              </DialogHeader>
              <RegForm
                key={`${dialog.type}-${dialog.entry?.id ?? "new"}`}
                type={dialog.type}
                entry={dialog.entry}
                onSaved={() => {
                  setDialog(null);
                  void loadVisits();
                }}
              />
            </>
          )}
          {dialog?.kind === "epi" && (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle className="font-display text-xl text-emerald-950">
                  {L("EPI সেশন উপস্থিতি", "EPI session attendance")}
                </DialogTitle>
                <DialogDescription>
                  {L(
                    "টিকা নিতে আসা শিশুর তথ্য ও অভিভাবকের মোবাইল সংরক্ষণ করুন। জন্ম এন্ট্রি জমা হলে এটি স্বয়ংক্রিয়ভাবে যুক্ত হবে।",
                    "Record an infant and parent's mobile. A later birth entry will be linked automatically.",
                  )}
                </DialogDescription>
              </DialogHeader>
              <EpiAttendanceForm
                onSaved={() => {
                  setDialog(null);
                  void loadVisits();
                }}
              />
            </>
          )}
          {dialog?.kind === "entries" && (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle className="font-display text-xl text-emerald-950">
                  {dialog.type === "birth"
                    ? L("জন্ম এন্ট্রি তালিকা", "Birth registry entries")
                    : L("মৃত্যু এন্ট্রি তালিকা", "Death registry entries")}
                </DialogTitle>
                <DialogDescription>
                  {L(
                    "নিবন্ধন সম্পন্ন হওয়ার আগে নিজের পেন্ডিং এন্ট্রি সংশোধন করা যাবে।",
                    "Correct your own entries before final registration approval.",
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {(dialog.type === "birth" ? births : deaths).map((entry) => {
                  const officerNotes = entry.remarks.filter((remark) => remark.role === "admin");
                  return (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{L(entry.name.bn, entry.name.en)}</span>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            entry.status === "completed"
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {entry.status === "completed"
                            ? L("নিবন্ধন সম্পন্ন", "Registration complete")
                            : L("পেন্ডিং", "Pending")}
                        </span>
                        <span className="text-[10px] text-slate-500">{date(entry.createdAt)}</span>
                        {officerNotes.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-800"
                            title={officerNotes.map((remark) => remark.text).join("\n")}
                          >
                            <MessageSquareWarning className="h-3.5 w-3.5" />
                            {L("প্রশাসনিক বার্তা", "Officer message")} · {n(officerNotes.length)}
                          </span>
                        )}
                        {entry.synced ? null : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-[10px]">
                            <CloudOff className="h-3 w-3" />
                            {L("সিঙ্ক অপেক্ষমাণ", "Sync pending")}
                          </span>
                        )}
                        {entry.smsSent && entry.synced && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            {L("অভিভাবককে SMS পাঠানো হয়েছে", "SMS sent to parent")}
                          </span>
                        )}
                        {entry.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto h-8"
                            onClick={() => goToForm(dialog.type, entry)}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            {L("সংশোধন", "Edit")}
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{address(entry)}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-[10px] text-slate-500">
                        <span>
                          {L("মোবাইল", "Mobile")}: {entry.parentMobile ?? "—"}
                        </span>
                        <span>
                          {L("জন্ম তারিখ", "Date of birth")}: {entry.dob}
                        </span>
                        {entry.type === "birth" && (
                          <span>
                            {L("সন্তানের ক্রম", "Child order")}: {n(entry.order ?? "—")}
                          </span>
                        )}
                        {entry.type === "death" && entry.dod && (
                          <span>
                            {L("মৃত্যুর তারিখ", "Date of death")}: {entry.dod}
                          </span>
                        )}
                      </div>
                      {officerNotes.map((remark, index) => (
                        <p
                          key={`${entry.id}-${index}`}
                          className="mt-2 flex items-start gap-1.5 rounded-md border-l-4 border-red-600 bg-red-50 px-2 py-1.5 text-xs text-red-900"
                        >
                          <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {remark.text}
                        </p>
                      ))}
                    </div>
                  );
                })}
                {(dialog.type === "birth" ? births : deaths).length === 0 && (
                  <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">
                    {L("এখনও কোনো এন্ট্রি নেই", "No entries yet")}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
