import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AppState, RegCase, Role, Upazila, User, Village, Union } from "./types";

type Lang = "bn" | "en";
export type Mfa = "ok" | "enroll" | "challenge";
type NewCase = Omit<RegCase, "id" | "createdAt" | "synced" | "smsSent" | "remarks" | "status" | "createdBy" | "upazilaId" | "unionId" | "ward" | "files"> & { files: File[] };

interface Ctx {
  state: AppState; user: User | null; authReady: boolean; mfa: Mfa; online: boolean;
  lang: Lang; toggleLang: () => void; L: (bn: string, en: string) => string; n: (v: number | string) => string;
  dark: boolean; toggleTheme: () => void;
  logout: () => Promise<void>; refresh: () => Promise<void>; refreshAuth: () => Promise<void>;
  addCase: (c: NewCase) => Promise<string | null>;
  patchCase: (id: string, patch: { status?: RegCase["status"]; regNo?: string; police?: RegCase["police"] }) => Promise<boolean>;
  addRemark: (id: string, text: string) => Promise<void>;
  addUpazila: (u: Upazila) => Promise<boolean>;
  findVillage: (id: string) => { v: Village; un: Union; up: Upazila } | null;
}
const C = createContext<Ctx | null>(null);
const QUEUE = "uert-offline-queue";
const PRIV: Role[] = ["admin", "uno", "super"];
const empty: AppState = { upazilas: [], users: [], cases: [], audit: [], sessionId: null };

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapCase = (r: any, remarks: any[]): RegCase => ({
  id: r.id, type: r.type,
  name: { bn: r.name_bn, en: r.name_en }, father: { bn: r.father_bn, en: r.father_en }, mother: { bn: r.mother_bn, en: r.mother_en },
  nid: r.nid, gender: r.gender, dob: r.dob, order: r.child_order ?? undefined, dod: r.dod ?? undefined,
  cause: r.cause_bn ? { bn: r.cause_bn, en: r.cause_en ?? "" } : undefined,
  villageId: r.village_id, files: r.files ?? [], filesPurged: r.files_purged,
  status: r.status, regNo: r.reg_no ?? undefined,
  remarks: remarks.filter((m) => m.case_id === r.id).map((m) => ({ by: m.author, role: m.role, text: m.text, at: Date.parse(m.created_at) })),
  police: r.police_task ?? undefined,
  createdBy: r.created_by, upazilaId: r.upazila_id, unionId: r.union_id, ward: r.ward,
  createdAt: Date.parse(r.created_at), completedAt: r.completed_at ? Date.parse(r.completed_at) : undefined,
  synced: true, smsSent: r.sms_sent,
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(empty);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mfa, setMfa] = useState<Mfa>("ok");
  const [online, setOnline] = useState(true);
  const [lang, setLang] = useState<Lang>("bn");
  const [dark, setDark] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const prefsReady = useRef(false);

  const L = useCallback((bn: string, en: string) => (lang === "bn" ? bn : en), [lang]);
  const n = useCallback((v: number | string) => lang === "bn" ? String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]!) : String(v), [lang]);

  const loadData = useCallback(async () => {
    const [ups, profs, roles, cases, remarks] = await Promise.all([
      supabase.from("upazilas").select("*").order("created_at"),
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("cases").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("case_remarks").select("*").order("created_at"),
    ]);
    const upazilas: Upazila[] = (ups.data ?? []).map((u) => ({ id: u.id, bn: u.bn, en: u.en, districtBn: u.district_bn, districtEn: u.district_en,
      divisionBn: u.division_bn, divisionEn: u.division_en, unions: u.unions as unknown as Union[] }));
    const users: User[] = (profs.data ?? []).map((p) => ({ id: p.id, name: { bn: p.name_bn, en: p.name_en },
      role: (roles.data ?? []).find((r) => r.user_id === p.id)?.role ?? "worker",
      mobile: p.mobile ?? undefined, email: p.email ?? undefined, upazilaId: p.upazila_id ?? "", unionId: p.union_id ?? undefined, ward: p.ward ?? undefined }));
    setState({ upazilas, users, cases: (cases.data ?? []).map((c) => mapCase(c, remarks.data ?? [])), audit: [], sessionId: null });
  }, []);

  const refreshAuth = useCallback(async () => {
    const { data: { user: au } } = await supabase.auth.getUser();
    if (!au) { setUser(null); setState(empty); setMfa("ok"); setAuthReady(true); return; }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", au.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", au.id),
    ]);
    if (!p || !r?.length || !p.active) {
      toast.error(L("এই অ্যাকাউন্টের অনুমতি নেই", "This account has no access"));
      await supabase.auth.signOut(); setUser(null); setAuthReady(true); return;
    }
    const role = r[0]!.role as Role;
    setUser({ id: au.id, name: { bn: p.name_bn, en: p.name_en }, role, mobile: p.mobile ?? undefined, email: p.email ?? undefined,
      upazilaId: p.upazila_id ?? "", unionId: p.union_id ?? undefined, ward: p.ward ?? undefined });
    let m: Mfa = "ok";
    if (PRIV.includes(role)) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== "aal2") m = aal?.nextLevel === "aal2" ? "challenge" : "enroll";
    }
    setMfa(m);
    if (m === "ok") await loadData();
    setAuthReady(true);
  }, [L, loadData]);

  useEffect(() => {
    try {
      setLang((localStorage.getItem("uert-lang") as Lang) || "bn");
      setDark(localStorage.getItem("uert-theme") === "dark");
      setPending(JSON.parse(localStorage.getItem(QUEUE) || "[]"));
    } catch { /* ignore */ }
    prefsReady.current = true;
    setOnline(navigator.onLine);
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "MFA_CHALLENGE_VERIFIED") {
        setTimeout(() => { void refreshAuth(); }, 0);
      }
    });
    void refreshAuth();
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); sub.subscription.unsubscribe(); };
  }, [refreshAuth]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.lang = lang;
    if (prefsReady.current) { localStorage.setItem("uert-theme", dark ? "dark" : "light"); localStorage.setItem("uert-lang", lang); }
  }, [dark, lang]);
  useEffect(() => { if (prefsReady.current) localStorage.setItem(QUEUE, JSON.stringify(pending)); }, [pending]);

  // Offline queue: flush when back online
  useEffect(() => {
    if (!online || !user || user.role !== "worker" || !pending.length) return;
    (async () => {
      const left: any[] = [];
      for (const row of pending) {
        const { error } = await supabase.from("cases").insert(row);
        if (error && error.code !== "23505") left.push(row);
      }
      const synced = pending.length - left.length;
      setPending(left);
      if (synced) { toast.success(L(`${n(synced)}টি অফলাইন এন্ট্রি সিঙ্ক হয়েছে`, `${synced} offline entries synced`)); void loadData(); }
    })();
  }, [online, user, pending, L, n, loadData]);

  const findVillage = useCallback((id: string) => {
    for (const up of state.upazilas) for (const un of up.unions) {
      const v = un.villages.find((x) => x.id === id); if (v) return { v, un, up };
    }
    return null;
  }, [state.upazilas]);

  const dupMsg = (t: string) => t === "birth"
    ? L("এই পিতা/মাতার NID ও সন্তানের ক্রমে আগেই নিবন্ধন হয়েছে", "A birth with this parent NID and child order already exists")
    : L("এই NID/জন্ম নিবন্ধন নম্বরে মৃত্যু নিবন্ধন আগেই হয়েছে", "A death with this NID/birth certificate number already exists");

  const value: Ctx = {
    state: { ...state, cases: [...pending.filter((p) => p.created_by === user?.id).map((p) => ({ ...mapCase({ ...p, created_at: p.queued_at, files: [], files_purged: false, status: "pending", sms_sent: false }, []), synced: false })), ...state.cases] },
    user, authReady, mfa, online, lang, L, n, dark,
    toggleLang: () => setLang((l) => (l === "bn" ? "en" : "bn")),
    toggleTheme: () => setDark((d) => !d),
    refresh: loadData, refreshAuth,
    logout: async () => { await supabase.auth.signOut(); setUser(null); setState(empty); },
    addCase: async (c) => {
      if (!user || user.role !== "worker") return L("শুধু স্বাস্থ্যকর্মী তথ্য দিতে পারবেন", "Only health workers can enter data");
      const id = crypto.randomUUID();
      const row: any = {
        id, client_id: id, type: c.type, name_bn: c.name.bn, name_en: c.name.en, father_bn: c.father.bn, father_en: c.father.en,
        mother_bn: c.mother.bn, mother_en: c.mother.en, nid: c.nid, gender: c.gender, dob: c.dob, child_order: c.order ?? null,
        dod: c.dod ?? null, cause_bn: c.cause?.bn ?? null, cause_en: c.cause?.en ?? null, village_id: c.villageId,
        created_by: user.id, upazila_id: user.upazilaId, union_id: user.unionId, ward: user.ward ?? 1,
      };
      if (state.cases.some((x) => x.type === c.type && x.nid === c.nid && (c.type === "death" || x.order === c.order))) return dupMsg(c.type);
      if (!navigator.onLine) {
        if (c.files.length) return L("অফলাইনে ফাইল যুক্ত করা যায় না — ফাইল ছাড়া জমা দিন বা অনলাইনে আসুন", "Files can't be attached offline — submit without files or reconnect");
        setPending((p) => [...p, { ...row, queued_at: new Date().toISOString() }]);
        return null;
      }
      const files = [];
      for (const f of c.files.slice(0, 3)) {
        const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
        const path = `${user.upazilaId}/${user.unionId}/${id}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("case-files").upload(path, f, { contentType: f.type });
        if (error) return L("ফাইল আপলোড ব্যর্থ", "File upload failed") + `: ${error.message}`;
        files.push({ name: f.name, size: f.size, path });
      }
      const { error } = await supabase.from("cases").insert({ ...row, files });
      if (error) return error.code === "23505" ? dupMsg(c.type) : error.message;
      await loadData();
      return null;
    },
    patchCase: async (id, patch) => {
      const upd: any = {};
      if (patch.status) upd.status = patch.status;
      if (patch.regNo !== undefined) upd.reg_no = patch.regNo;
      if (patch.police !== undefined) upd.police_task = patch.police;
      const { error } = await supabase.from("cases").update(upd).eq("id", id);
      if (error) { toast.error(error.message); return false; }
      await loadData(); return true;
    },
    addRemark: async (id, text) => {
      if (!user) return;
      const { error } = await supabase.from("case_remarks").insert({ case_id: id, role: user.role, text, author: user.id });
      if (error) toast.error(error.message); else await loadData();
    },
    addUpazila: async (u) => {
      const { error } = await supabase.from("upazilas").insert({ id: u.id, bn: u.bn, en: u.en, district_bn: u.districtBn, district_en: u.districtEn,
        division_bn: u.divisionBn, division_en: u.divisionEn, unions: u.unions as any });
      if (error) { toast.error(error.message); return false; }
      await loadData(); return true;
    },
    findVillage,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp() {
  const c = useContext(C); if (!c) throw new Error("StoreProvider missing"); return c;
}

/** Client-side mirror of the database's row-level isolation rules. */
export function scopedCases(state: AppState, u: User | null) {
  if (!u) return [];
  if (u.role === "super") return state.cases;
  return state.cases.filter((c) => {
    if (c.upazilaId !== u.upazilaId) return false;
    if (u.role === "uno") return true;
    if (c.unionId !== u.unionId) return false;
    if (u.role === "admin") return true;
    if (u.role === "police") return c.ward === u.ward && !!c.police;
    return c.createdBy === u.id;
  });
}

export const roleLabel = (r: string, L: (b: string, e: string) => string) => ({
  worker: L("ইপিআই / স্বাস্থ্যকর্মী", "EPI / Health Worker"),
  admin: L("প্রশাসনিক কর্মকর্তা", "Administrative Officer"),
  police: L("গ্রাম পুলিশ", "Village Police"),
  uno: L("ইউএনও", "UNO"),
  super: L("সুপার অ্যাডমিন", "Super Admin"),
}[r] ?? r);
