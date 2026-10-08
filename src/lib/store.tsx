import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { seedState } from "./seed";
import type { AppState, RegCase, Remark, Upazila, User, Village } from "./types";

const KEY = "uert-state-v1";
const PURGE_MS = 90 * 86400000;

function purge(s: AppState): AppState {
  const now = Date.now();
  return {
    ...s,
    cases: s.cases.map((c) =>
      c.status === "completed" && c.regNo && c.completedAt && now - c.completedAt > PURGE_MS && c.files.length
        ? { ...c, files: [], filesPurged: true } : c),
  };
}

type Lang = "bn" | "en";
interface Ctx {
  state: AppState; user: User | null; online: boolean;
  lang: Lang; toggleLang: () => void; L: (bn: string, en: string) => string; n: (v: number | string) => string;
  dark: boolean; toggleTheme: () => void;
  login: (id: string) => void; logout: () => void;
  addCase: (c: Omit<RegCase, "id" | "createdAt" | "synced" | "smsSent" | "remarks" | "status" | "createdBy" | "upazilaId" | "unionId" | "ward">) => string | null;
  patchCase: (id: string, patch: Partial<RegCase>, action: string) => void;
  addRemark: (id: string, text: string) => void;
  addUpazila: (u: Upazila) => void; addUser: (u: User) => void;
  findVillage: (id: string) => { v: Village; un: Upazila["unions"][number]; up: Upazila } | null;
}
const C = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(seedState);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [lang, setLang] = useState<Lang>("bn");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setState(purge(raw ? JSON.parse(raw) : seedState()));
      setLang((localStorage.getItem("uert-lang") as Lang) || "bn");
      setDark(localStorage.getItem("uert-theme") === "dark");
    } catch { /* ignore */ }
    setReady(true);
    setOnline(navigator.onLine);
    const up = () => {
      setOnline(true);
      setState((p) => {
        const n = p.cases.filter((c) => !c.synced).length;
        if (n) toast.success(`${n} offline entries synced`);
        return { ...p, cases: p.cases.map((c) => (c.synced ? c : { ...c, synced: true })) };
      });
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(state)); }, [state, ready]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.lang = lang;
    if (ready) { localStorage.setItem("uert-theme", dark ? "dark" : "light"); localStorage.setItem("uert-lang", lang); }
  }, [dark, lang, ready]);

  const user = state.users.find((u) => u.id === state.sessionId) ?? null;
  const audit = (s: AppState, action: string, caseId?: string): AppState =>
    ({ ...s, audit: [...s.audit, { at: Date.now(), userId: s.sessionId ?? "system", action, caseId }] });

  const L = useCallback((bn: string, en: string) => (lang === "bn" ? bn : en), [lang]);
  const n = useCallback((v: number | string) => lang === "bn" ? String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]) : String(v), [lang]);

  const findVillage = useCallback((id: string) => {
    for (const up of state.upazilas) for (const un of up.unions) {
      const v = un.villages.find((x) => x.id === id); if (v) return { v, un, up };
    }
    return null;
  }, [state.upazilas]);

  const value: Ctx = {
    state, user, online, lang, L, n, dark,
    toggleLang: () => setLang((l) => (l === "bn" ? "en" : "bn")),
    toggleTheme: () => setDark((d) => !d),
    login: (id) => setState((s) => audit({ ...s, sessionId: id }, "login")),
    logout: () => setState((s) => audit({ ...s, sessionId: null }, "logout")),
    addCase: (c) => {
      if (!user || user.role !== "worker") return L("শুধু স্বাস্থ্যকর্মী তথ্য দিতে পারবেন", "Only health workers can enter data");
      const dup = state.cases.find((x) => x.type === c.type && x.nid === c.nid && (c.type === "death" || x.order === c.order));
      if (dup) return c.type === "birth"
        ? L("এই পিতা/মাতার NID ও সন্তানের ক্রমে আগেই নিবন্ধন হয়েছে", "A birth with this parent NID and child order already exists")
        : L("এই NID/জন্ম নিবন্ধন নম্বরে মৃত্যু নিবন্ধন আগেই হয়েছে", "A death with this NID/birth certificate number already exists");
      const id = `c${Date.now()}`;
      const nc: RegCase = { ...c, id, createdAt: Date.now(), synced: navigator.onLine, smsSent: true, remarks: [], status: "pending",
        createdBy: user.id, upazilaId: user.upazilaId, unionId: user.unionId!, ward: user.ward ?? 1 };
      setState((s) => audit({ ...s, cases: [nc, ...s.cases] }, `create:${c.type}`, id));
      return null;
    },
    patchCase: (id, patch, action) =>
      setState((s) => audit({ ...s, cases: s.cases.map((c) => (c.id === id ? { ...c, ...patch } : c)) }, action, id)),
    addRemark: (id, text) => {
      if (!user) return;
      const r: Remark = { by: user.name.bn + " / " + user.name.en, role: user.role, text, at: Date.now() };
      setState((s) => audit({ ...s, cases: s.cases.map((c) => (c.id === id ? { ...c, remarks: [...c.remarks, r] } : c)) }, "remark", id));
    },
    addUpazila: (u) => setState((s) => audit({ ...s, upazilas: [...s.upazilas, u] }, `onboard:${u.id}`)),
    addUser: (u) => setState((s) => audit({ ...s, users: [...s.users, u] }, `user:${u.id}`)),
    findVillage,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp() {
  const c = useContext(C); if (!c) throw new Error("StoreProvider missing"); return c;
}

/** Cases visible to the user — strict tenant isolation. */
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
