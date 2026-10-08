import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleLabel, useApp } from "@/lib/store";
import { makeUnions } from "@/lib/seed";
import type { Role } from "@/lib/types";
import { PageTitle, Stat } from "../shared";

export function SuperDashboard() {
  const { L, n, state, addUpazila, addUser } = useApp();
  const [f, setF] = useState({ bn: "", en: "", dBn: "", dEn: "", vBn: "", vEn: "", unions: "" });
  const [sel, setSel] = useState(state.upazilas[0]?.id ?? "");
  const [nu, setNu] = useState({ bn: "", en: "", role: "worker" as Role, contact: "", unionId: "", ward: "1" });
  const selUp = state.upazilas.find((u) => u.id === sel);

  const onboard = () => {
    const lines = f.unions.split("\n").map((l) => l.split("|").map((s) => s.trim())).filter((l) => l[0]);
    if (!f.bn || !f.en || !f.dBn || !lines.length) { toast.error(L("সব ঘর পূরণ করুন", "Fill all fields")); return; }
    const id = f.en.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (state.upazilas.some((u) => u.id === id)) { toast.error(L("উপজেলা আগে থেকেই আছে", "Upazila already exists")); return; }
    addUpazila({ id, bn: f.bn, en: f.en, districtBn: f.dBn, districtEn: f.dEn, divisionBn: f.vBn, divisionEn: f.vEn,
      unions: makeUnions(lines.map((l, i) => [`u${i}`, l[0], l[1] || l[0]] as [string, string, string]), id) });
    toast.success(L("উপজেলা যুক্ত হয়েছে", "Upazila onboarded")); setSel(id);
    setF({ bn: "", en: "", dBn: "", dEn: "", vBn: "", vEn: "", unions: "" });
  };
  const createUser = () => {
    if (!nu.bn || !nu.contact || (["worker", "admin", "police"].includes(nu.role) && !nu.unionId)) { toast.error(L("সব ঘর পূরণ করুন", "Fill all fields")); return; }
    const pwRole = ["admin", "uno"].includes(nu.role);
    addUser({ id: `u${Date.now()}`, name: { bn: nu.bn, en: nu.en || nu.bn }, role: nu.role, upazilaId: sel,
      unionId: nu.unionId || undefined, ward: +nu.ward || 1,
      ...(pwRole ? { email: nu.contact.toLowerCase(), password: "123456" } : { mobile: nu.contact }) });
    toast.success(pwRole ? L("ব্যবহারকারী তৈরি · পাসওয়ার্ড 123456", "User created · password 123456") : L("ব্যবহারকারী তৈরি", "User created"));
    setNu({ ...nu, bn: "", en: "", contact: "" });
  };

  return (
    <>
      <PageTitle title={L("সুপার অ্যাডমিন প্যানেল", "Super Admin Panel")} sub={L("জেলা ও উপজেলা অনবোর্ডিং", "District & Upazila onboarding")} />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label={L("উপজেলা", "Upazilas")} value={n(state.upazilas.length)} />
        <Stat label={L("ব্যবহারকারী", "Users")} value={n(state.users.length)} />
        <Stat label={L("অডিট লগ", "Audit entries")} value={n(state.audit.length)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">{L("নতুন উপজেলা যুক্ত করুন", "Onboard new Upazila")}</h2>
          {([["bn", "en", L("উপজেলা", "Upazila")], ["dBn", "dEn", L("জেলা", "District")], ["vBn", "vEn", L("বিভাগ", "Division")]] as const).map(([a, b, lbl]) => (
            <div key={a}><Label>{lbl}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="বাংলা" value={f[a]} onChange={(e) => setF({ ...f, [a]: e.target.value })} />
                <Input placeholder="English" value={f[b]} onChange={(e) => setF({ ...f, [b]: e.target.value })} />
              </div></div>
          ))}
          <div><Label>{L("ইউনিয়ন (প্রতি লাইনে একটি: বাংলা | English)", "Unions (one per line: বাংলা | English)")}</Label>
            <Textarea rows={5} value={f.unions} onChange={(e) => setF({ ...f, unions: e.target.value })} placeholder={"০১ নং ত্রিমোহিনী | 01 No. Trimohini"} /></div>
          <Button onClick={onboard}>{L("যুক্ত করুন", "Onboard")}</Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">{L("ডাইনামিক ড্রপডাউন ও ব্যবহারকারী", "Dynamic dropdown & users")}</h2>
          <Select value={sel} onValueChange={(v) => { setSel(v); setNu({ ...nu, unionId: "" }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{state.upazilas.map((u) => <SelectItem key={u.id} value={u.id}>{L(`${u.bn}, ${u.districtBn}`, `${u.en}, ${u.districtEn}`)}</SelectItem>)}</SelectContent>
          </Select>
          <ol className="max-h-48 overflow-y-auto rounded-lg bg-muted p-2 text-sm">
            {selUp?.unions.map((u) => <li key={u.id}>{L(u.bn, u.en)}</li>)}
          </ol>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={L("নাম (বাংলা)", "Name (Bangla)")} value={nu.bn} onChange={(e) => setNu({ ...nu, bn: e.target.value })} />
            <Input placeholder={L("নাম (English)", "Name (English)")} value={nu.en} onChange={(e) => setNu({ ...nu, en: e.target.value })} />
            <Select value={nu.role} onValueChange={(r) => setNu({ ...nu, role: r as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["worker", "police", "admin", "uno"] as Role[]).map((r) => <SelectItem key={r} value={r}>{roleLabel(r, L)}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder={["admin", "uno"].includes(nu.role) ? L("ইমেইল", "Email") : L("মোবাইল", "Mobile")} value={nu.contact} onChange={(e) => setNu({ ...nu, contact: e.target.value })} />
            {nu.role !== "uno" && (<>
              <Select value={nu.unionId} onValueChange={(v) => setNu({ ...nu, unionId: v })}>
                <SelectTrigger><SelectValue placeholder={L("ইউনিয়ন", "Union")} /></SelectTrigger>
                <SelectContent>{selUp?.unions.map((u) => <SelectItem key={u.id} value={u.id}>{L(u.bn, u.en)}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min={1} max={9} placeholder={L("ওয়ার্ড", "Ward")} value={nu.ward} onChange={(e) => setNu({ ...nu, ward: e.target.value })} />
            </>)}
          </div>
          <Button onClick={createUser}>{L("ব্যবহারকারী তৈরি", "Create user")}</Button>
        </div>
      </div>
    </>
  );
}
