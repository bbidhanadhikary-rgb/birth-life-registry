import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, MessageSquare, Paperclip, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scopedCases, useApp, roleLabel } from "@/lib/store";
import { downloadCSV, printPDF } from "@/lib/report";
import type { Bi } from "@/lib/types";
import { PageTitle, StatusBadge, useCaseHelpers } from "../shared";

const empty: Bi = { bn: "", en: "" };

function BiField({ label, v, set }: { label: string; v: Bi; set: (b: Bi) => void }) {
  return (
    <div className="sm:col-span-2">
      <Label className="mb-1 block">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="বাংলা" value={v.bn} onChange={(e) => set({ ...v, bn: e.target.value })} maxLength={100} />
        <Input placeholder="English" value={v.en} onChange={(e) => set({ ...v, en: e.target.value })} maxLength={100} />
      </div>
    </div>
  );
}

function RegForm({ type }: { type: "birth" | "death" }) {
  const { L, user, state, addCase } = useApp();
  const up = state.upazilas.find((u) => u.id === user!.upazilaId)!;
  const un = up.unions.find((u) => u.id === user!.unionId)!;
  const [name, setName] = useState(empty); const [father, setFather] = useState(empty); const [mother, setMother] = useState(empty);
  const [cause, setCause] = useState(empty);
  const [nid, setNid] = useState(""); const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [dob, setDob] = useState(""); const [dod, setDod] = useState(""); const [order, setOrder] = useState("1");
  const [villageId, setVillageId] = useState(""); const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [err, setErr] = useState("");
  const v = un.villages.find((x) => x.id === villageId);

  const submit = () => {
    setErr("");
    if (!name.bn.trim() || !name.en.trim() || !father.bn.trim() || !mother.bn.trim()) return setErr(L("নাম (বাংলা ও ইংরেজি) আবশ্যক", "Names in Bangla & English are required"));
    if (!/^(\d{10}|\d{13}|\d{17})$/.test(nid)) return setErr(L("NID/জন্ম নিবন্ধন নম্বর ১০, ১৩ বা ১৭ অঙ্কের হতে হবে", "NID/BRN must be 10, 13 or 17 digits"));
    if (!dob || !villageId || (type === "death" && (!dod || !cause.bn.trim()))) return setErr(L("সব তারিখ ও গ্রাম পূরণ করুন", "Fill in all dates and the village"));
    const e = addCase({
      type, name, father, mother, nid, gender, dob, villageId,
      order: type === "birth" ? order : undefined, dod: type === "death" ? dod : undefined, cause: type === "death" ? cause : undefined,
      files: files.filter(Boolean).map((f) => ({ name: f!.name, size: f!.size })),
    });
    if (e) { setErr(e); toast.error(e); return; }
    toast.success(L("জমা হয়েছে · অভিভাবককে SMS পাঠানো হয়েছে", "Submitted · SMS sent to parent"));
    setName(empty); setFather(empty); setMother(empty); setCause(empty); setNid(""); setDob(""); setDod(""); setVillageId(""); setFiles([null, null, null]);
  };

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-6">
      <BiField label={type === "birth" ? L("শিশুর নাম", "Child's Name") : L("মৃত ব্যক্তির নাম", "Deceased Person's Name")} v={name} set={setName} />
      <BiField label={L("পিতার নাম", "Father's Name")} v={father} set={setFather} />
      <BiField label={L("মাতার নাম", "Mother's Name")} v={mother} set={setMother} />
      <div>
        <Label className="mb-1 block">{type === "birth" ? L("পিতা/মাতার NID", "Parent's NID") : L("মৃত ব্যক্তির NID / জন্ম নিবন্ধন নং", "Deceased's NID / Birth Cert. No.")}</Label>
        <Input inputMode="numeric" maxLength={17} value={nid} onChange={(e) => setNid(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div>
        <Label className="mb-1 block">{L("লিঙ্গ", "Gender")}</Label>
        <Select value={gender} onValueChange={(x) => setGender(x as typeof gender)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="male">{L("পুরুষ / Male", "Male / পুরুষ")}</SelectItem>
            <SelectItem value="female">{L("মহিলা / Female", "Female / মহিলা")}</SelectItem>
            <SelectItem value="other">{L("অন্যান্য / Other", "Other / অন্যান্য")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label className="mb-1 block">{L("জন্ম তারিখ", "Date of Birth")}</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
      {type === "birth" ? (
        <div><Label className="mb-1 block">{L("সন্তানের ক্রম", "Order of Child")}</Label><Input type="number" min={1} max={20} value={order} onChange={(e) => setOrder(e.target.value)} /></div>
      ) : (
        <div><Label className="mb-1 block">{L("মৃত্যুর তারিখ", "Date of Death")}</Label><Input type="date" value={dod} onChange={(e) => setDod(e.target.value)} /></div>
      )}
      {type === "death" && <BiField label={L("মৃত্যুর কারণ", "Cause of Death")} v={cause} set={setCause} />}

      <div className="sm:col-span-2">
        <Label className="mb-1 block">{L("গ্রামের নাম (শুধু এটি বেছে নিন)", "Village name (only pick this)")}</Label>
        <Select value={villageId} onValueChange={setVillageId}>
          <SelectTrigger><SelectValue placeholder={L("গ্রাম বেছে নিন", "Select village")} /></SelectTrigger>
          <SelectContent>{un.villages.map((x) => <SelectItem key={x.id} value={x.id}>{x.bn} / {x.en}</SelectItem>)}</SelectContent>
        </Select>
        {v && (
          <div className="mt-2 grid gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground sm:grid-cols-2">
            <div>ডাকঘর: {v.poBn} · ওয়ার্ড: {v.ward} · {un.bn} · {up.bn} · {up.districtBn} · {up.divisionBn} · বাংলাদেশ</div>
            <div>PO: {v.poEn} · Ward: {v.ward} · {un.en} · {up.en} · {up.districtEn} · {up.divisionEn} · Bangladesh</div>
          </div>
        )}
      </div>

      <div className="sm:col-span-2">
        <Label className="mb-1 block">{L("সংযুক্তি (সর্বোচ্চ ৩টি)", "Attachments (up to 3)")}</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {files.map((f, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2 truncate rounded-lg border border-dashed border-border p-3 text-sm hover:bg-muted">
              <Paperclip className="h-4 w-4 shrink-0" /><span className="truncate">{f?.name ?? L(`ফাইল ${i + 1}`, `File ${i + 1}`)}</span>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const nf = [...files]; nf[i] = e.target.files?.[0] ?? null; setFiles(nf); }} />
            </label>
          ))}
        </div>
      </div>
      {err && <p className="text-sm font-medium text-destructive sm:col-span-2">{err}</p>}
      <Button size="lg" className="sm:col-span-2" onClick={submit}>{L("জমা দিন", "Submit")}</Button>
    </div>
  );
}

export function WorkerDashboard() {
  const { L, n, user, state } = useApp();
  const { address, date, rows } = useCaseHelpers();
  const mine = scopedCases(state, user);
  return (
    <>
      <PageTitle title={L(`স্বাগতম, ${user!.name.bn}`, `Welcome, ${user!.name.en}`)} sub={roleLabel("worker", L) + " · " + L(`ওয়ার্ড ${n(user!.ward ?? 1)}`, `Ward ${user!.ward}`)}
        actions={<>
          <Button variant="outline" onClick={() => downloadCSV(rows(mine), "my-report.csv")}><Download className="mr-1 h-4 w-4" />Excel</Button>
          <Button variant="outline" onClick={() => printPDF("My Report", rows(mine))}><FileText className="mr-1 h-4 w-4" />PDF</Button>
        </>} />
      <Tabs defaultValue="birth">
        <TabsList className="mb-4 grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="birth">{L("জন্ম", "Birth")}</TabsTrigger>
          <TabsTrigger value="death">{L("মৃত্যু", "Death")}</TabsTrigger>
          <TabsTrigger value="history">{L("ইতিহাস", "History")} ({n(mine.length)})</TabsTrigger>
        </TabsList>
        <TabsContent value="birth"><RegForm type="birth" /></TabsContent>
        <TabsContent value="death"><RegForm type="death" /></TabsContent>
        <TabsContent value="history" className="space-y-3">
          {mine.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{L(c.name.bn, c.name.en)}</span>
                <span className="text-xs text-muted-foreground">{c.type === "birth" ? L("জন্ম", "Birth") : L("মৃত্যু", "Death")} · {date(c.createdAt)}</span>
                <span className="ml-auto flex gap-2"><StatusBadge s={c.status} /></span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{address(c)}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {c.smsSent && <span className="rounded bg-success/15 px-2 py-0.5 text-success">✓ {L("অভিভাবককে SMS পাঠানো হয়েছে", "SMS Sent to Parent")}</span>}
                {!c.synced && <span className="flex items-center gap-1 rounded bg-warning/20 px-2 py-0.5"><CloudOff className="h-3 w-3" />{L("সিঙ্কের অপেক্ষায়", "Awaiting sync")}</span>}
                {c.regNo && <span className="rounded bg-muted px-2 py-0.5">{L("নিবন্ধন নং", "Reg. No")}: {c.regNo}</span>}
              </div>
              {c.remarks.map((r, i) => (
                <div key={i} className="mt-2 flex gap-2 rounded-lg bg-muted p-2 text-sm">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div><span className="font-medium">{roleLabel(r.role, L)}:</span> {r.text}</div>
                </div>
              ))}
            </div>
          ))}
          {!mine.length && <p className="text-muted-foreground">{L("এখনও কোনো এন্ট্রি নেই", "No entries yet")}</p>}
        </TabsContent>
      </Tabs>
    </>
  );
}
